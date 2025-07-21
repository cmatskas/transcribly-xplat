const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const CredentialsManager = require('../../src/main/models/credentialsManager');

// Mock Electron's safeStorage
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/test-app-data')
  },
  safeStorage: {
    encryptString: jest.fn((str) => Buffer.from(`encrypted_${str}`)),
    decryptString: jest.fn((buffer) => {
      if (Buffer.isBuffer(buffer)) {
        return buffer.toString().replace('encrypted_', '');
      }
      return buffer.toString().replace('encrypted_', '');
    })
  }
}));

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
    readFile: jest.fn(),
    access: jest.fn(),
    unlink: jest.fn()
  }
}));

describe('CredentialsManager', () => {
  let credentialsManager;
  const mockCredentials = {
    accessKeyId: 'AKIATEST123',
    secretAccessKey: 'secret123',
    region: 'us-east-1',
    sessionToken: 'token123',
    profileName: 'test-profile'
  };

  beforeEach(() => {
    credentialsManager = new CredentialsManager();
    jest.clearAllMocks();
  });

  describe('saveCredentials', () => {
    it('should save encrypted credentials successfully', async () => {
      fs.writeFile.mockResolvedValue();

      const result = await credentialsManager.saveCredentials(mockCredentials);

      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/tmp/test-app-data', 'aws-credentials.json'),
        expect.any(String)
      );
      
      // Verify the structure of the saved data
      const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);
      expect(savedData).toHaveProperty('accessKeyId');
      expect(savedData).toHaveProperty('secretAccessKey');
      expect(savedData.region).toBe('us-east-1');
      expect(savedData.profileName).toBe('test-profile');
    });

    it('should throw error for missing required fields', async () => {
      const incompleteCredentials = {
        accessKeyId: 'AKIATEST123'
        // missing secretAccessKey and region
      };

      await expect(credentialsManager.saveCredentials(incompleteCredentials))
        .rejects.toThrow('Missing required AWS credentials');
    });
  });

  describe('loadCredentials', () => {
    it('should load and decrypt credentials successfully', async () => {
      // Simulate how Buffer gets serialized/deserialized through JSON
      const encryptedData = {
        accessKeyId: JSON.parse(JSON.stringify(Buffer.from('encrypted_AKIATEST123'))),
        secretAccessKey: JSON.parse(JSON.stringify(Buffer.from('encrypted_secret123'))),
        region: 'us-east-1',
        sessionToken: JSON.parse(JSON.stringify(Buffer.from('encrypted_token123'))),
        profileName: 'test-profile'
      };

      fs.readFile.mockResolvedValue(JSON.stringify(encryptedData));

      const result = await credentialsManager.loadCredentials();

      expect(result).toEqual(mockCredentials);
    });

    it('should return null when credentials file does not exist', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValue(error);

      const result = await credentialsManager.loadCredentials();

      expect(result).toBeNull();
    });
  });

  describe('hasCredentials', () => {
    it('should return true when credentials file exists', async () => {
      fs.access.mockResolvedValue();

      const result = await credentialsManager.hasCredentials();

      expect(result).toBe(true);
    });

    it('should return false when credentials file does not exist', async () => {
      fs.access.mockRejectedValue(new Error('File not found'));

      const result = await credentialsManager.hasCredentials();

      expect(result).toBe(false);
    });
  });

  describe('deleteCredentials', () => {
    it('should delete credentials file successfully', async () => {
      fs.unlink.mockResolvedValue();

      const result = await credentialsManager.deleteCredentials();

      expect(result).toBe(true);
      expect(fs.unlink).toHaveBeenCalledWith(
        path.join('/tmp/test-app-data', 'aws-credentials.json')
      );
    });

    it('should return true when file does not exist', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.unlink.mockRejectedValue(error);

      const result = await credentialsManager.deleteCredentials();

      expect(result).toBe(true);
    });
  });
});