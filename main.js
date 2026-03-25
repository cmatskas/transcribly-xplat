const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const config = require('./config.js');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const logger = require('./logger');

const { BedrockRuntimeClient, ConverseCommand, ConverseStreamCommand } = require('@aws-sdk/client-bedrock-runtime');
//const { BedrockClient } = require('@aws-sdk/client-bedrock');
const { BedrockAgentClient, ListKnowledgeBasesCommand } = require('@aws-sdk/client-bedrock-agent');
const { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } = require('@aws-sdk/client-transcribe');

// Import credential management
const CredentialsManager = require('./src/main/models/credentialsManager');
const AWSValidator = require('./src/main/models/awsValidator');
const TranscriptMapper = require('./src/main/models/transcriptMapper.js');
const SettingsManager = require('./src/main/models/settingsManager');
const ConversationManager = require('./src/main/models/conversationManager');
const CustomPromptsManager = require('./src/main/models/customPromptsManager');
const SkillsManager = require('./src/main/models/skillsManager');
const CodeInterpreterManager = require('./src/main/models/codeInterpreterManager');
const AgentToolExecutor = require('./src/main/models/agentToolExecutor');
const BrowserManager = require('./src/main/models/browserManager');
const MemoryManager = require('./src/main/models/memoryManager');
const WorkHistoryManager = require('./src/main/models/workHistoryManager');

let conversationManager;
let customPromptsManager;
let skillsManager;
let workHistoryManager;

// Global variables for credential and settings management
let credentialsManager;
let settingsManager;
let currentCredentials = null;
let currentSettings = null;
let awsClients = {};

// Initialize credential and settings managers
function initializeCredentialsManager() {
  credentialsManager = new CredentialsManager();
}

function initializeSettingsManager() {
  settingsManager = new SettingsManager();
}

function initializeConversationManager() {
  conversationManager = new ConversationManager();
}

function initializeCustomPromptsManager() {
  customPromptsManager = new CustomPromptsManager();
}

function initializeSkillsManager() {
  skillsManager = new SkillsManager();
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
    }),
    agentCoreConfig: clientConfig, // stored for CodeInterpreterManager
  };
}

let mainWindow;

// Helper function to get the appropriate icon path for the current platform
function getIconPath() {
  const fs = require('fs');
  
  let iconPath;
  if (process.platform === 'win32') {
    iconPath = path.join(__dirname, 'src/assets/favicon.ico');
  } else if (process.platform === 'darwin') {
    iconPath = path.join(__dirname, 'src/assets/favicon.icns');
  } else {
    // Use the largest PNG for Linux
    iconPath = path.join(__dirname, 'src/assets/favicon_512x512.png');
  }
  
  // Fallback to SVG if the platform-specific icon doesn't exist
  if (!fs.existsSync(iconPath)) {
    iconPath = path.join(__dirname, 'src/assets/favicon.svg');
  }
  
  return iconPath;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('src/pages/index.html');
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.transcribely.app');
  }
  
  initializeCredentialsManager();
  initializeSettingsManager();
  initializeConversationManager();
  initializeCustomPromptsManager();
  initializeSkillsManager();
  workHistoryManager = new WorkHistoryManager();

  // Load skills and settings in parallel
  const [, loadedSettings] = await Promise.all([
    skillsManager.init().then(() => console.info(`Loaded ${skillsManager.getSkills().length} skills`)).catch(err => console.error('Error loading skills:', err)),
    settingsManager.loadSettings().catch(err => { console.error('Error loading settings:', err); return settingsManager.getDefaultSettings(); }),
  ]);
  currentSettings = loadedSettings;

  // Generate a unique userId for this installation if not already set
  if (!currentSettings.userId) {
    currentSettings.userId = require('crypto').randomUUID();
    await settingsManager.saveSettings(currentSettings);
  }

  // Check if credentials exist
  const hasCredentials = await credentialsManager.hasCredentials();

  if (hasCredentials) {
    try {
      currentCredentials = await credentialsManager.loadCredentials();
      initializeAWSClients(currentCredentials);
    } catch (error) {
      console.error('Error loading credentials:', error);
    }
  }

  // Always show main window — settings are in-page now
  createWindow();
  mainWindow.loadFile('src/pages/index.html');

  // If no credentials, tell renderer to show settings page
  if (!hasCredentials) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('show-settings');
    });
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

app.on('before-quit', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app-before-quit');
  }
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

// Quick credential check — single STS call, ~100ms
ipcMain.handle('quick-validate-credentials', async () => {
  try {
    if (!currentCredentials) {
      currentCredentials = await credentialsManager.loadCredentials();
    }
    const validator = new AWSValidator(currentCredentials);
    return await validator.quickValidate();
  } catch (error) {
    return { valid: false, identity: null, errors: [error.message] };
  }
});

// ── AgentCore Memory handlers ──────────────────────────────────

ipcMain.handle('memory-enable', async () => {
  if (!awsClients.agentCoreConfig) throw new Error('AWS credentials not configured');
  const settings = await settingsManager.loadSettings();

  // If memoryId already exists, just re-enable — no need to create
  if (settings.memoryId) {
    settings.memoryEnabled = true;
    await settingsManager.saveSettings(settings);
    return { id: settings.memoryId, status: 'ACTIVE', alreadyExisted: true };
  }

  const mm = new MemoryManager(awsClients.agentCoreConfig);
  mm.setActorId(settings.userId);
  const result = await mm.createMemory();
  if (result.status !== 'ACTIVE' && !result.alreadyExisted) {
    await mm.waitForActive();
  }
  settings.memoryId = result.id;
  settings.memoryEnabled = true;
  await settingsManager.saveSettings(settings);
  return result;
});

ipcMain.handle('memory-disable', async () => {
  const settings = await settingsManager.loadSettings();
  settings.memoryEnabled = false;
  await settingsManager.saveSettings(settings);
  return { enabled: false };
});

ipcMain.handle('memory-delete', async () => {
  const settings = await settingsManager.loadSettings();
  if (settings.memoryId && awsClients.agentCoreConfig) {
    const mm = new MemoryManager(awsClients.agentCoreConfig);
    mm.setMemoryId(settings.memoryId);
    await mm.deleteMemory();
  }
  settings.memoryId = '';
  settings.memoryEnabled = false;
  await settingsManager.saveSettings(settings);
  return { enabled: false };
});

ipcMain.handle('memory-status', async () => {
  const settings = await settingsManager.loadSettings();
  if (!settings.memoryId) return { enabled: false, memoryEnabled: false };
  if (!awsClients.agentCoreConfig) return { enabled: false, memoryEnabled: false };
  try {
    const mm = new MemoryManager(awsClients.agentCoreConfig);
    mm.setMemoryId(settings.memoryId);
    const status = await mm.getStatus();
    return { enabled: true, memoryEnabled: settings.memoryEnabled, memoryId: settings.memoryId, status };
  } catch {
    return { enabled: false, memoryEnabled: false, memoryId: settings.memoryId, status: 'UNREACHABLE' };
  }
});

ipcMain.handle('memory-extract', async (event, { sessionId }) => {
  const settings = await settingsManager.loadSettings();
  if (!settings.memoryId || !awsClients.agentCoreConfig) return;
  const mm = new MemoryManager(awsClients.agentCoreConfig);
  mm.setMemoryId(settings.memoryId);
  mm.setActorId(settings.userId);
  await mm.startExtraction(sessionId);
});

// ── Work History handlers ──────────────────────────────────

ipcMain.handle('work-history-list', async () => {
  return await workHistoryManager.list();
});

ipcMain.handle('work-history-load', async (event, { id }) => {
  return await workHistoryManager.load(id);
});

ipcMain.handle('work-history-save', async (event, session) => {
  await workHistoryManager.save(session);
});

ipcMain.handle('work-history-delete', async (event, { id }) => {
  await workHistoryManager.remove(id);
});

ipcMain.handle('work-history-rename', async (event, { id, title }) => {
  await workHistoryManager.rename(id, title);
});

ipcMain.handle('work-history-star', async (event, { id }) => {
  return await workHistoryManager.toggleStar(id);
});

ipcMain.handle('navigate-to-main', async () => {
  // Close child windows without reloading the main window (preserves chat state)
  const allWindows = BrowserWindow.getAllWindows();
  allWindows.forEach(window => {
    if (window !== mainWindow) {
      window.close();
    }
  });
});

// Settings management IPC handlers
ipcMain.handle('save-settings', async (event, settings) => {
  try {
    // Merge with existing settings to preserve fields not managed by the UI (e.g. memoryId)
    const existing = await settingsManager.loadSettings();
    const merged = { ...existing, ...settings };
    await settingsManager.saveSettings(merged);
    currentSettings = merged;
    return true;
  } catch (error) {
    throw new Error(`Failed to save settings: ${error.message}`);
  }
});

ipcMain.handle('load-settings', async () => {
  try {
    return await settingsManager.loadSettings();
  } catch (error) {
    throw new Error(`Failed to load settings: ${error.message}`);
  }
});

ipcMain.handle('get-default-settings', async () => {
  return settingsManager.getDefaultSettings();
});

ipcMain.handle('delete-settings', async () => {
  try {
    await settingsManager.deleteSettings();
    currentSettings = settingsManager.getDefaultSettings();
    return true;
  } catch (error) {
    throw new Error(`Failed to delete settings: ${error.message}`);
  }
});

ipcMain.handle('send-to-bedrock', async (event, { model, prompt, knowledgeBaseId, conversationHistory, files = [] }) => {
  if (knowledgeBaseId) {
    return await invokeBedrockWithKB(model, prompt, knowledgeBaseId);
  } else {
    return await invokeBedrockNoKB(model, prompt, conversationHistory, files, event);
  }
});

// Conversation management IPC handlers
ipcMain.handle('list-conversations', async () => {
  return await conversationManager.list();
});

ipcMain.handle('load-conversation', async (event, id) => {
  return await conversationManager.load(id);
});

ipcMain.handle('save-conversation', async (event, conversation) => {
  return await conversationManager.save(conversation);
});

ipcMain.handle('delete-conversation', async (event, id) => {
  await conversationManager.delete(id);
  return true;
});

ipcMain.handle('create-conversation', async (event, firstPrompt) => {
  return conversationManager.create(firstPrompt);
});

ipcMain.handle('compress-conversation', async (event, { model, conversation }) => {
  const oldMessages = conversation.messages.slice(0, -4);
  const historyText = oldMessages.map(m => `${m.role}: ${m.content}`).join('\n\n');
  const summaryPrompt = `Summarize the following conversation history concisely, preserving all key facts, decisions, and context that would be needed to continue the conversation:\n\n${historyText}`;
  const summary = await invokeBedrockNoKB(model, summaryPrompt);
  return conversationManager.applyCompression(conversation, summary);
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

ipcMain.handle('get-prompt-templates', async () => {
  return await customPromptsManager.getAll();
});

// Custom prompts handlers
ipcMain.handle('add-custom-prompt', async (event, prompt) => {
  return await customPromptsManager.add(prompt);
});

ipcMain.handle('update-custom-prompt', async (event, { id, updates }) => {
  return await customPromptsManager.update(id, updates);
});

ipcMain.handle('delete-custom-prompt', async (event, id) => {
  return await customPromptsManager.delete(id);
});

ipcMain.handle('get-custom-prompts', async () => {
  return await customPromptsManager.getAll();
});

// Skills handlers
ipcMain.handle('get-skills', async () => {
  return skillsManager.getSkills();
});

ipcMain.handle('toggle-skill', async (event, { name, enabled }) => {
  return await skillsManager.toggleSkill(name, enabled);
});

ipcMain.handle('refresh-skills', async () => {
  return await skillsManager.refresh();
});

ipcMain.handle('open-skills-folder', async () => {
  await skillsManager.openSkillsFolder();
});

// Directory picker
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select workspace directory',
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

// Agent handler — runs the agentic tool-use loop
ipcMain.handle('invoke-agent', async (event, { model, prompt, conversationHistory, files = [], sessionId }) => {
  if (!awsClients.bedrock) {
    throw new Error('AWS credentials not configured');
  }

  // Set up memory if configured
  const settings = await settingsManager.loadSettings();
  let memManager = null;
  if (settings.memoryId && settings.memoryEnabled && awsClients.agentCoreConfig) {
    memManager = new MemoryManager(awsClients.agentCoreConfig);
    memManager.setMemoryId(settings.memoryId);
    memManager.setActorId(settings.userId);
  }

  const ciManager = new CodeInterpreterManager(awsClients.agentCoreConfig);
  const brManager = new BrowserManager(awsClients.agentCoreConfig);
  const executor = new AgentToolExecutor({
    bedrockClient: awsClients.bedrock,
    skillsManager,
    codeInterpreterManager: ciManager,
    browserManager: brManager,
    memoryManager: memManager,
    sessionId,
    settings,
    onStatus: (status) => event.sender.send('agent-status', { sessionId, status }),
    onChunk: (chunk) => event.sender.send('agent-stream-chunk', { sessionId, chunk }),
  });

  skillsManager.resetActivations();
  return await executor.run(model, prompt, conversationHistory, files);
});

// Add handler to get Bedrock models from config
ipcMain.handle('get-bedrock-models', () => {
  return config.bedrockModels;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

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

  // Get current settings for bucket names
  const settings = currentSettings || await settingsManager.loadSettings();

  if (file.buffer.length >= bigFileSize) {
    console.info("File is larger than 20MB, using multipart upload");
    mediaUri = await uploadLargeFile(
      file,
      settings.bucketName,
      `${Date.now()}-${file.originalname}`
    );
  } else {
    console.info("File is smaller than 20MB, using regular upload");
    mediaUri = await uploadToS3(
      file,
      settings.bucketName,
      `${Date.now()}-${file.originalname}`
    );
  }
  // Determine media format from the file extension - supports all Amazon Transcribe formats
  const getMediaFormat = (uri) => {
    const lowerUri = uri.toLowerCase();

    // Audio formats
    if (lowerUri.endsWith('.mp3')) return 'mp3';
    if (lowerUri.endsWith('.wav')) return 'wav';
    if (lowerUri.endsWith('.flac')) return 'flac';
    if (lowerUri.endsWith('.ogg')) return 'ogg';
    if (lowerUri.endsWith('.amr')) return 'amr';
    if (lowerUri.endsWith('.webm')) return 'webm';

    // Video formats (audio will be extracted)
    if (lowerUri.endsWith('.mp4')) return 'mp4';
    if (lowerUri.endsWith('.mov')) return 'mov';
    if (lowerUri.endsWith('.avi')) return 'avi';
    if (lowerUri.endsWith('.mkv')) return 'mkv';
    if (lowerUri.endsWith('.flv')) return 'flv';

    // Default fallback
    return 'mp4';
  };

  const mediaFormat = getMediaFormat(mediaUri);

  const jobName = `transcription-${Date.now()}`;

  const command = new StartTranscriptionJobCommand({
    TranscriptionJobName: jobName,
    Media: { MediaFileUri: mediaUri },
    MediaFormat: mediaFormat,
    LanguageCode: settings.transcriptionLanguage,
    OutputBucketName: settings.outputBucketName,
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

async function invokeBedrockNoKB(model, prompt, conversationHistory, files = [], event = null) {
  try {
    if (!awsClients.bedrock) {
      throw new Error('AWS credentials not configured');
    }

    // Validate file count for Converse API
    if (files && files.length > 5) {
      throw new Error('Maximum 5 documents allowed for Bedrock Converse API');
    }

    // Build the message content starting with the prompt
    const messageContent = [{ text: prompt }];

    // Add documents if provided
    if (files && files.length > 0) {
      logger.log('info', `Processing ${files.length} files for Bedrock analysis`);

      // Extract pptx/ppt files via code interpreter sandbox
      const pptxFiles = files.filter(f => ['pptx', 'ppt'].includes(f.name.toLowerCase().split('.').pop()));
      if (pptxFiles.length > 0) {
        const clientConfig = { region: currentCredentials.region, credentials: { accessKeyId: currentCredentials.accessKeyId, secretAccessKey: currentCredentials.secretAccessKey, sessionToken: currentCredentials.sessionToken } };
        const ci = new CodeInterpreterManager(clientConfig);
        try {
          await ci.startSession(300);
          await ci.writeFiles(pptxFiles.map(f => ({ path: f.name, content: Array.isArray(f.content) ? f.content : Array.from(f.content) })));
          for (const file of pptxFiles) {
            const result = await ci.executeCode(`
from pptx import Presentation
prs = Presentation("${file.name}")
slides = []
for i, slide in enumerate(prs.slides):
    texts = [shape.text_frame.text for shape in slide.shapes if shape.has_text_frame and shape.text_frame.text.strip()]
    if texts:
        slides.append(f"Slide {i+1}:\\n" + "\\n".join(texts))
print("\\n\\n".join(slides))
`);
            messageContent.push({ text: `\n\n--- Content from ${file.name} ---\n${result.text}\n--- End of ${file.name} ---\n` });
          }
        } finally {
          await ci.stopSession();
        }
      }

      for (const file of files) {
        const fileExtension = file.name.toLowerCase().split('.').pop();
        if (['pptx', 'ppt'].includes(fileExtension)) continue; // already handled above

        if (fileExtension === 'pdf') {
          const bytes = Array.isArray(file.content) ? new Uint8Array(file.content) : file.content;
          messageContent.push({
            document: {
              name: sanitizeFileName(file.name),
              format: 'pdf',
              source: { bytes }
            }
          });
        } else if (['doc', 'docx'].includes(fileExtension)) {
          const bytes = Array.isArray(file.content) ? new Uint8Array(file.content) : file.content;
          messageContent.push({
            document: {
              name: sanitizeFileName(file.name),
              format: fileExtension,
              source: { bytes }
            }
          });
        } else if (['xls', 'xlsx'].includes(fileExtension)) {
          const bytes = Array.isArray(file.content) ? new Uint8Array(file.content) : file.content;
          messageContent.push({
            document: {
              name: sanitizeFileName(file.name),
              format: fileExtension,
              source: { bytes }
            }
          });
        } else if (['txt', 'md', 'csv', 'html'].includes(fileExtension)) {
          let formattedContent = file.content;
          
          if (fileExtension === 'csv') {
            formattedContent = `CSV Data from ${file.name}:\n${file.content}`;
          } else if (fileExtension === 'html') {
            formattedContent = `HTML Content from ${file.name}:\n${file.content}`;
          } else if (fileExtension === 'md') {
            formattedContent = `Markdown Content from ${file.name}:\n${file.content}`;
          }

          messageContent.push({
            text: `\n\n--- Content from ${file.name} ---\n${formattedContent}\n--- End of ${file.name} ---\n`
          });
        }
      }
    }

    // Build messages: prior history + new user message with content
    const messages = [
      ...(conversationHistory || []),
      { role: 'user', content: messageContent }
    ];

    const command = new ConverseStreamCommand({
      modelId: model,
      messages,
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0.7
      }
    });

    const response = await awsClients.bedrock.send(command);
    
    // Stream the response
    let fullText = '';
    for await (const chunk of response.stream) {
      if (chunk.contentBlockDelta?.delta?.text) {
        const textChunk = chunk.contentBlockDelta.delta.text;
        fullText += textChunk;
        
        // Send chunk to renderer if event is provided
        if (event) {
          event.sender.send('bedrock-stream-chunk', textChunk);
        }
      }
    }
    
    // Send completion signal
    if (event) {
      event.sender.send('bedrock-stream-complete');
    }
    
    return fullText;
  } catch (error) {
    logger.log('error', `Bedrock query failed: ${error.message}`);
    throw new Error(`Bedrock query failed: ${error.message}`);
  }
}

// Helper function to sanitize file names for Bedrock
const { sanitizeFileName } = require('./src/main/utils');

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
