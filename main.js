const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const config = require('./config.js');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { S3TransferManager, Upload } = require('@aws-sdk/lib-storage');
const logger = require('./logger');

const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const { BedrockClient } = require('@aws-sdk/client-bedrock');
const { BedrockAgentClient, ListKnowledgeBasesCommand } = require('@aws-sdk/client-bedrock-agent');
const { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { TranscribeClient, StartTranscriptionJobCommand } = require('@aws-sdk/client-transcribe');

// initialize aws clients
const bedrockClient = new BedrockRuntimeClient({ region: config.region });
const bedrockAgentClient = new BedrockAgentClient({ region: config.region });
const bedrockAgentRuntime = new BedrockAgentRuntimeClient({ region: config.region });
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
// Handle Bedrock API calls
ipcMain.handle('send-to-bedrock', async (event, { model, prompt, knowledgeBaseId }) => {
   // Add knowledge base configuration if a knowledge base ID is provided
  if (knowledgeBaseId) {
    return await invokeBedrockWithKB(model, prompt, knowledgeBaseId);
  }
  else {
    return await invokeBedrockNoKB(model, prompt);
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

// Add handler to get Bedrock models from config
ipcMain.handle('get-bedrock-models', () => {
  return config.bedrockModels;
})

// Add handler to get Bedrock knowledge bases
ipcMain.handle('get-knowledge-bases', async () => {
  try {
    const command = new ListKnowledgeBasesCommand({
      maxResults: 20 // Adjust as needed
    });

    const response = await bedrockAgentClient.send(command);

    // Format the knowledge bases for the dropdown
    const knowledgeBases = response.knowledgeBaseSummaries.map(kb => ({
      id: kb.knowledgeBaseId,
      name: kb.name || kb.knowledgeBaseId,
      description: kb.description || ''
    }));

    return knowledgeBases;
  } catch (error) {
    console.error('Error retrieving knowledge bases:', error);
    throw new Error(`Failed to retrieve knowledge bases: ${error.message}`);
  }
});

async function startTranscription(file) {
  const bigFileSize = 20 * 1024 * 1024;
  let mediaUri;

  if (file.buffer.length >= bigFileSize) {
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
  } catch (error) {
    console.error('Small file upload to S3 failed: ', error);
    throw error;
  }
}

async function invokeBedrockNoKB(model, prompt) {
  try {
    // Create the base request object
    const request = {
      modelId: model,
      messages: [
        {
          role: "user",
          content: [
            { 
              text: prompt 
            }
          ]
        }
      ],
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0.7,
        topP: 0.9
      }
    };
    // Create the command with the request
    const command = new ConverseCommand(request);

    // Send the request to Bedrock
    const response = await bedrockClient.send(command);

    // Parse the response - ConverseCommand returns a structured response
    // with the model's output in the 'message' property
    return response.output.message.content[0].text;
  } catch (error) {
    logger.log('error', `Bedrock query failed: ${error.message}`);
    throw new Error(`Bedrock query failed: ${error.message}`);
  }
}

async function invokeBedrockWithKB (model, prompt, knowledgeBaseId){
  const params = {
    input: {
      text: prompt // The user's question or request
    },
    retrieveAndGenerateConfiguration: {
      knowledgeBaseConfiguration: {
          knowledgeBaseId: knowledgeBaseId, // The ID of your knowledge base
          modelArn: model // The ARN of the model to use (e.g., Anthropic Claude)
      },
      type: "KNOWLEDGE_BASE"
    }
  };

  const command = new RetrieveAndGenerateCommand(params);

  try {
      const response = await bedrockAgentRuntime.send(command);
      return response;
  } catch (error) {
    logger.log('error', `Bedrock retrieve and generate call failed: ${error.message}`);
    throw new Error(`Bedrock retrieve and generate call failed: ${error.message}`);
  }
}
