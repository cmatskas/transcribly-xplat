const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const config = require('./config.js');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const logger = require('./logger');

const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
//const { BedrockClient } = require('@aws-sdk/client-bedrock');
const { BedrockAgentClient, ListKnowledgeBasesCommand } = require('@aws-sdk/client-bedrock-agent');
const { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } = require('@aws-sdk/client-transcribe');

// Import credential management
const CredentialsManager = require('./src/main/models/credentialsManager');
const AWSValidator = require('./src/main/models/awsValidator');
const TranscriptMapper = require('./src/main/models/transcriptMapper.js');

// Global variables for credential management
let credentialsManager;
let currentCredentials = null;
let awsClients = {};

// Initialize credential manager
function initializeCredentialsManager() {
  credentialsManager = new CredentialsManager();
}

// Initialize AWS clients with credentials
function initializeAWSClients(credentials) {
  const clientConfig = {
    region: credentials.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken
    }
  };

  awsClients = {
    bedrock: new BedrockRuntimeClient(clientConfig),
    bedrockAgent: new BedrockAgentClient(clientConfig),
    bedrockAgentRuntime: new BedrockAgentRuntimeClient(clientConfig),
    transcribe: new TranscribeClient(clientConfig),
    s3: new S3Client({
      ...clientConfig,
      endpoint: `https://s3.${credentials.region}.amazonaws.com`
    })
  };
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.webContents.openDevTools();
}

async function createCredentialsWindow() {
  const credentialsWindow = new BrowserWindow({
    width: 800,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    modal: true,
    parent: mainWindow,
    show: false
  });

  credentialsWindow.loadFile('src/pages/credentials.html');
  credentialsWindow.once('ready-to-show', () => {
    credentialsWindow.show();
  });

  return credentialsWindow;
}

app.whenReady().then(async () => {
  initializeCredentialsManager();

  // Check if credentials exist and are valid
  const hasCredentials = await credentialsManager.hasCredentials();

  if (hasCredentials) {
    try {
      currentCredentials = await credentialsManager.loadCredentials();
      initializeAWSClients(currentCredentials);

      // Validate credentials
      const validator = new AWSValidator(currentCredentials);
      const validation = await validator.validateCredentials();

      if (validation.valid && validation.permissions.bedrock && validation.permissions.transcribe) {
        // Credentials are valid, load main app
        createWindow();
        mainWindow.loadFile('src/pages/index.html');
      } else {
        // Credentials exist but are invalid, show credentials setup
        createWindow();
        await createCredentialsWindow();
      }
    } catch (error) {
      console.error('Error loading credentials:', error);
      createWindow();
      await createCredentialsWindow();
    }
  } else {
    // No credentials, show setup
    createWindow();
    await createCredentialsWindow();
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Credential management IPC handlers
ipcMain.handle('save-credentials', async (event, credentials) => {
  try {
    await credentialsManager.saveCredentials(credentials);
    currentCredentials = credentials;
    initializeAWSClients(credentials);
    return true;
  } catch (error) {
    throw new Error(`Failed to save credentials: ${error.message}`);
  }
});

ipcMain.handle('load-credentials', async () => {
  try {
    return await credentialsManager.loadCredentials();
  } catch (error) {
    throw new Error(`Failed to load credentials: ${error.message}`);
  }
});

ipcMain.handle('has-credentials', async () => {
  return await credentialsManager.hasCredentials();
});

ipcMain.handle('delete-credentials', async () => {
  try {
    await credentialsManager.deleteCredentials();
    currentCredentials = null;
    awsClients = {};
    return true;
  } catch (error) {
    throw new Error(`Failed to delete credentials: ${error.message}`);
  }
});

ipcMain.handle('validate-credentials', async () => {
  try {
    if (!currentCredentials) {
      currentCredentials = await credentialsManager.loadCredentials();
    }
    const validator = new AWSValidator(currentCredentials);
    return await validator.validateCredentials();
  } catch (error) {
    throw new Error(`Failed to validate credentials: ${error.message}`);
  }
});

ipcMain.handle('navigate-to-main', async () => {
  if (mainWindow) {
    mainWindow.loadFile('src/pages/index.html');
    // Close any credential windows
    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach(window => {
      if (window !== mainWindow) {
        window.close();
      }
    });
  }
});

ipcMain.handle('open-credentials-window', async () => {
  try {
    await createCredentialsWindow();
    return true;
  } catch (error) {
    throw new Error(`Failed to open credentials window: ${error.message}`);
  }
});

ipcMain.handle('send-to-bedrock', async (event, { model, prompt, knowledgeBaseId }) => {
  if (knowledgeBaseId) {
    return await invokeBedrockWithKB(model, prompt, knowledgeBaseId);
  }
  else {
    return await invokeBedrockNoKB(model, prompt);
  }
});

ipcMain.handle('transcribe-media', async (event, { file }) => {
  try {
    if (!awsClients.transcribe) {
      throw new Error('AWS credentials not configured');
    }

    // Convert the array buffer back to Buffer for processing
    const fileBuffer = Buffer.from(file.buffer);
    const fileObj = {
      buffer: fileBuffer,
      originalname: file.name,
      mimetype: file.type
    };

    // Send progress update
    event.sender.send('transcription-progress', { 
      status: 'UPLOADING', 
      message: 'Uploading file to S3...' 
    });

    // Start transcription job
    const jobName = await startTranscription(fileObj);
    
    // Send progress update
    event.sender.send('transcription-progress', { 
      status: 'IN_PROGRESS', 
      message: 'Transcription job started. Processing audio...' 
    });
    
    // Poll for job completion
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    const pollInterval = 5000; // 5 seconds
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const jobStatus = await checkTranscriptionJobStatus(jobName);
      
      if (jobStatus.status === 'COMPLETED') {
        // Send progress update
        event.sender.send('transcription-progress', { 
          status: 'RETRIEVING', 
          message: 'Retrieving transcription results...' 
        });
        
        // Get the transcription results
        const results = await getTranscriptionResults(jobStatus.outputUri);
        const transcriptMapper = new TranscriptMapper(results);
        const transcript = transcriptMapper.getAllTimestampedText();
        return {
          status: 'COMPLETED',
          transcript: transcript,
          jobName: jobName
        };
      } else if (jobStatus.status === 'FAILED') {
        throw new Error(`Transcription job failed: ${jobStatus.failureReason || 'Unknown error'}`);
      }
      
      // Send periodic progress updates
      const elapsed = Math.floor((attempt + 1) * pollInterval / 1000);
      event.sender.send('transcription-progress', { 
        status: 'IN_PROGRESS', 
        message: `Processing audio... (${elapsed}s elapsed)` 
      });
      
      // Job is still in progress, wait before next check
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    // If we get here, the job timed out
    throw new Error('Transcription job timed out after 5 minutes');
    
  } catch (error) {
    console.error('Error in transcribe-media:', error);
    throw new Error(`Transcription failed: ${error.message}`);
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
    if (!awsClients.bedrockAgent) {
      throw new Error('AWS credentials not configured');
    }

    const command = new ListKnowledgeBasesCommand({
      maxResults: 20 // Adjust as needed
    });

    const response = await awsClients.bedrockAgent.send(command);

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
    const transcribeJob = await awsClients.transcribe.send(command);
    jobId = transcribeJob.TranscriptionJob.TranscriptionJobName;
  } catch (error) {
    console.error('Error starting transcription job:', error);
    throw error;
  }
 
  return jobId;
}

// Check transcription job status
async function checkTranscriptionJobStatus(jobName) {
  const command = new GetTranscriptionJobCommand({
    TranscriptionJobName: jobName
  });

  try {
    const response = await awsClients.transcribe.send(command);
    const job = response.TranscriptionJob;
    
    return {
      status: job.TranscriptionJobStatus,
      outputUri: job.Transcript?.TranscriptFileUri,
      failureReason: job.FailureReason
    };
  } catch (error) {
    console.error('Error checking transcription job status:', error);
    throw error;
  }
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
    const client = awsClients.s3;
    const response = await client.send(command);
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
    const client = awsClients.s3; // Use dynamic client or fallback
    const multipartUpload = new Upload({
      client: client,
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
    const client = awsClients.s3; // Use dynamic client or fallback
    const upload = new Upload({
      client: client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype
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
    if (!awsClients.bedrock) {
      throw new Error('AWS credentials not configured');
    }

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
    const response = await awsClients.bedrock.send(command);

    // Parse the response - ConverseCommand returns a structured response
    // with the model's output in the 'message' property
    return response.output.message.content[0].text;
  } catch (error) {
    logger.log('error', `Bedrock query failed: ${error.message}`);
    throw new Error(`Bedrock query failed: ${error.message}`);
  }
}

async function invokeBedrockWithKB(model, prompt, knowledgeBaseId) {
  try {
    if (!awsClients.bedrockAgentRuntime) {
      throw new Error('AWS credentials not configured');
    }

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
    const response = await awsClients.bedrockAgentRuntime.send(command);
    return response;
  } catch (error) {
    logger.log('error', `Bedrock retrieve and generate call failed: ${error.message}`);
    throw new Error(`Bedrock retrieve and generate call failed: ${error.message}`);
  }
}
