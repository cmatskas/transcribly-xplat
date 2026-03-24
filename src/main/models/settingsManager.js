const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');

class SettingsManager {
  constructor() {
    this.settingsDir = app.getPath('userData');
    this.settingsFile = path.join(this.settingsDir, 'settings.json');
    this.defaultSettings = {
      transcriptionLanguage: 'en-US',
      defaultTheme: 'auto',
      bucketName: '',
      outputBucketName: '',
      region: 'us-east-1',
      memoryId: '',
      memoryEnabled: false,
      sagemakerImageEndpoint: '',
      sagemakerImageComponent: '',
    };
  }

  async ensureSettingsDirectory() {
    try {
      await fs.access(this.settingsDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(this.settingsDir, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  async hasSettings() {
    try {
      await fs.access(this.settingsFile);
      return true;
    } catch (error) {
      return false;
    }
  }

  async loadSettings() {
    try {
      const hasSettings = await this.hasSettings();
      if (!hasSettings) {
        return this.defaultSettings;
      }

      const settingsData = await fs.readFile(this.settingsFile, 'utf8');
      const settings = JSON.parse(settingsData);
      
      // Merge with defaults to ensure all required fields exist
      return { ...this.defaultSettings, ...settings };
    } catch (error) {
      console.error('Error loading settings:', error);
      return this.defaultSettings;
    }
  }

  async saveSettings(settings) {
    try {
      await this.ensureSettingsDirectory();
      
      // Validate required fields
      const validatedSettings = this.validateSettings(settings);
      
      await fs.writeFile(
        this.settingsFile,
        JSON.stringify(validatedSettings, null, 2),
        'utf8'
      );
      
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      throw new Error(`Failed to save settings: ${error.message}`);
    }
  }

  validateSettings(settings) {
    const validated = { ...this.defaultSettings };
    
    // Validate transcription language
    if (settings.transcriptionLanguage && typeof settings.transcriptionLanguage === 'string') {
      validated.transcriptionLanguage = settings.transcriptionLanguage.trim();
    }
    
    // Validate theme
    if (settings.defaultTheme && ['light', 'dark', 'auto'].includes(settings.defaultTheme)) {
      validated.defaultTheme = settings.defaultTheme;
    }
    
    // Validate bucket names (allow empty strings)
    if (typeof settings.bucketName === 'string') {
      validated.bucketName = settings.bucketName.trim();
    }
    
    if (typeof settings.outputBucketName === 'string') {
      validated.outputBucketName = settings.outputBucketName.trim();
    }
    
    // Validate region
    if (settings.region && typeof settings.region === 'string') {
      validated.region = settings.region.trim();
    }

    // Validate memoryId
    if (typeof settings.memoryId === 'string') {
      validated.memoryId = settings.memoryId.trim();
    }
    if (typeof settings.memoryEnabled === 'boolean') {
      validated.memoryEnabled = settings.memoryEnabled;
    }

    // Validate SageMaker image generation
    if (typeof settings.sagemakerImageEndpoint === 'string') {
      validated.sagemakerImageEndpoint = settings.sagemakerImageEndpoint.trim();
    }
    if (typeof settings.sagemakerImageComponent === 'string') {
      validated.sagemakerImageComponent = settings.sagemakerImageComponent.trim();
    }
    
    return validated;
  }

  async deleteSettings() {
    try {
      const hasSettings = await this.hasSettings();
      if (hasSettings) {
        await fs.unlink(this.settingsFile);
      }
      return true;
    } catch (error) {
      console.error('Error deleting settings:', error);
      throw new Error(`Failed to delete settings: ${error.message}`);
    }
  }

  getDefaultSettings() {
    return { ...this.defaultSettings };
  }
}

module.exports = SettingsManager;