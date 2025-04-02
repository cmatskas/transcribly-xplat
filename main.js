const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const config = require('./config.js');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { S3TransferManager, Upload } = require('@aws-sdk/lib-storage');
const logger = require('./logger');

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { BedrockClient, ListFoundationModelsCommand} = require('@aws-sdk/client-bedrock');
const { TranscribeClient, StartTranscriptionJobCommand } = require('@aws-sdk/client-transcribe');

// initialize aws clients
const bedrockClient = new BedrockRuntimeClient({ region: config.region });
const bedrockManager = new BedrockClient({ region: config.region });
const transcribeClient = new TranscribeClient({ region: config.region });
const s3Client = new S3Client({
  region: config.region,
  endpoint: `https://s3.${config.region}.amazonaws.com`
});

// Cache for storing Bedrock models
let modelCache = null;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('src/pages/index.html');
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle Bedrock API calls
ipcMain.handle('send-to-bedrock', async (event, { model, prompt }) => {
  try {
    const command = new InvokeModelCommand({
      modelId: model,
      body: JSON.stringify({
        prompt: prompt,
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    const response = await bedrockClient.send(command);
    return JSON.parse(Buffer.from(response.body).toString('utf-8')).completion;
  } catch (error) {
    throw new Error(`Bedrock API error: ${error.message}`);
  }
});

// Handle Transcribe API calls
ipcMain.handle('transcribe-media', async (event, { filePath }) => {
  try {
    const jobName = `transcription-${Date.now()}`;
    const command = new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      Media: { MediaFileUri: filePath },
      MediaFormat: path.extname(filePath).substring(1),
      LanguageCode: 'en-US'
    });

    await transcribeClient.send(command);
    return `Transcription job started: ${jobName}`;
  } catch (error) {
    throw new Error(`Transcribe API error: ${error.message}`);
  }
});

ipcMain.handle('get-prompt-templates', () => {
  return config.defaultPrompts;
})

// Modified to use cache
ipcMain.handle('get-bedrock-models', async () => {
  try {
    // Return cached models if available
    if (modelCache) {
      return modelCache;
    }

    const command = new ListFoundationModelsCommand({
      filters: {  // Changed from inputFilter to filters
        byOutputModality: "TEXT",
        byInferenceType: "ON_DEMAND",
        byLifecycleStatus: "ACTIVE"
      }
    });

    const response = await bedrockManager.send(command);

    // Store in cache
    modelCache = response.modelSummaries.map(model => ({
      id: model.modelId,
      name: model.modelName,
      provider: model.providerName
    }));

    return modelCache;
  } catch (error) {
    console.error('Error fetching Bedrock models:', error);
    throw error;
  }
});

// Add handler to force refresh models
ipcMain.handle('refresh-bedrock-models', async () => {
  // Clear the cache
  modelCache = null;
  // Fetch fresh models
  return await ipcMain.handle('get-bedrock-models');
});

async function startTranscription(file) {
  const bigFileSize = 20 * 1024 * 1024;
  let mediaUri;

  if (file.buffer.length >= bigFileSize){
    console.info("File is larger than 20MB, using multipart upload");
    mediaUri = await uploadLargeFile(
      file,
      config.bucketName,
      `${Date.now()}-${file.originalname}`
    );
  } else {
    console.info("File is smaller than 20MB, using regular upload");
    mediaUri = await uploadToS3(
      file,
      config.bucketName,
      `${Date.now()}-${file.originalname}`
    );
  }
  // Determine media format from the file extension
  const mediaFormat = mediaUri.toLowerCase().endsWith('.mp4') ? 'mp4' :
    mediaUri.toLowerCase().endsWith('.mp3') ? 'mp3' :
      mediaUri.toLowerCase().endsWith('.wav') ? 'wav' : 'mp4';

  const jobName = `transcription-${Date.now()}`;

  const command = new StartTranscriptionJobCommand({
    TranscriptionJobName: jobName,
    Media: { MediaFileUri: mediaUri },
    MediaFormat: mediaFormat,
    LanguageCode: 'en-US',
    OutputBucketName: config.outputBucketName,
    Settings: {
      ShowSpeakerLabels: true,
      MaxSpeakerLabels: 5
    }
  });

  let jobId;
  try {
    const transcribeJob = await transcribeClient.send(command);
    jobId = transcribeJob.TranscriptionJob.TranscriptionJobName;
  } catch (error) {
    console.error('Error starting transcription job:', error);
    throw error;
  }

  return jobId;
}

// Get transcription results
async function getTranscriptionResults(outputUri) {
  // Extract bucket and key from the output URI
  const url = new URL(outputUri);
  const bucket = url.pathname.split("/")[1]; // Extract bucket name from pathname
  const key = url.pathname.split("/").slice(2).join("/"); // Extract the key from the pathname

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  });

  try {
    console.info("Retrieving trascription results from storage");
    const response = await s3Client.send(command);
    const transcript = await response.Body.transformToString();
    return JSON.parse(transcript);
  } catch (error) {
    console.error('Error getting transcription results from storage:', error);
    throw error;
  }
}

async function uploadLargeFile(file, bucket, key) {
  const chunkSize = 5 * 1024 * 1024; // 5MB chunks

  try {
    const multipartUpload = new Upload({
        client: s3Client,
        params: {
          Bucket: bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype
        },
        queueSize: 4, // number of concurrent uploads
        partSize: chunkSize
    });

    multipartUpload.on('httpUploadProgress', (progress) => {
        const percentage = Math.round((progress.loaded / progress.total) * 100);
        console.log(`Upload progress: ${percentage}%`);
    });

    await multipartUpload.done();
    return `s3://${bucket}/${key}`;
  } catch (error) {
      console.error('Large file upload to S3 failed: ', error);
      throw error;
  }
}

async function uploadToS3(file, bucket, key) {
  try {
    const upload = new Upload({
        client: s3Client,  // Use S3Client directly
        params: {
            Bucket: bucket,
            Key: key,
            Body: file.buffer,
            ContentType: 'audio/mpeg'
        }
    });
       
    upload.on('httpUploadProgress', (progress) => {
      const percentage = Math.round((progress.loaded / progress.total) * 100);
      console.log(`Upload progress: ${percentage}%`);
    });
      
    await upload.done();
    return `s3://${bucket}/${key}`;
   }catch (error) {
      console.error('Small file upload to S3 failed: ', error);
      throw error;
   }
}