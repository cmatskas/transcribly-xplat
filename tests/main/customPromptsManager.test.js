const CustomPromptsManager = require('../../src/main/models/customPromptsManager');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

// Mock electron app
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/userData')
  }
}));

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
}));

describe('CustomPromptsManager', () => {
  let manager;
  const mockPromptsFile = '/mock/userData/custom-prompts.json';

  beforeEach(() => {
    manager = new CustomPromptsManager();
    jest.clearAllMocks();
  });

  describe('load', () => {
    it('should load prompts from file', async () => {
      const mockPrompts = [
        { id: 'custom_1', name: 'Test', prompt: 'Test prompt', isCustom: true }
      ];
      fs.readFile.mockResolvedValue(JSON.stringify(mockPrompts));

      const result = await manager.load();

      expect(fs.readFile).toHaveBeenCalledWith(mockPromptsFile, 'utf8');
      expect(result).toEqual(mockPrompts);
    });

    it('should return empty array if file does not exist', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValue(error);

      const result = await manager.load();

      expect(result).toEqual([]);
    });

    it('should throw error for other file read errors', async () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fs.readFile.mockRejectedValue(error);

      await expect(manager.load()).rejects.toThrow('Permission denied');
    });
  });

  describe('save', () => {
    it('should save prompts to file', async () => {
      const prompts = [
        { id: 'custom_1', name: 'Test', prompt: 'Test prompt', isCustom: true }
      ];

      await manager.save(prompts);

      expect(fs.writeFile).toHaveBeenCalledWith(
        mockPromptsFile,
        JSON.stringify(prompts, null, 2)
      );
    });
  });

  describe('add', () => {
    it('should add a new prompt', async () => {
      fs.readFile.mockResolvedValue('[]');
      fs.writeFile.mockResolvedValue();

      const newPrompt = {
        name: 'Technical Summary',
        prompt: 'Provide a technical summary of the following'
      };

      const result = await manager.add(newPrompt);

      expect(result).toMatchObject({
        name: 'Technical Summary',
        prompt: 'Provide a technical summary of the following',
        isCustom: true
      });
      expect(result.id).toMatch(/^custom_\d+$/);
      expect(result.createdAt).toBeDefined();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should add prompt to existing list', async () => {
      const existing = [
        { id: 'custom_1', name: 'Existing', prompt: 'Existing prompt', isCustom: true }
      ];
      fs.readFile.mockResolvedValue(JSON.stringify(existing));
      fs.writeFile.mockResolvedValue();

      const newPrompt = {
        name: 'New Prompt',
        prompt: 'New prompt text'
      };

      await manager.add(newPrompt);

      const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);
      expect(savedData).toHaveLength(2);
      expect(savedData[0]).toEqual(existing[0]);
      expect(savedData[1].name).toBe('New Prompt');
    });
  });

  describe('update', () => {
    it('should update an existing prompt', async () => {
      const existing = [
        { id: 'custom_1', name: 'Old Name', prompt: 'Old prompt', isCustom: true, createdAt: '2024-01-01' }
      ];
      fs.readFile.mockResolvedValue(JSON.stringify(existing));
      fs.writeFile.mockResolvedValue();

      const updates = {
        name: 'New Name',
        prompt: 'New prompt text'
      };

      const result = await manager.update('custom_1', updates);

      expect(result.name).toBe('New Name');
      expect(result.prompt).toBe('New prompt text');
      expect(result.updatedAt).toBeDefined();
      expect(result.createdAt).toBe('2024-01-01');
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should throw error if prompt not found', async () => {
      fs.readFile.mockResolvedValue('[]');

      await expect(manager.update('nonexistent', { name: 'Test' }))
        .rejects.toThrow('Prompt not found');
    });
  });

  describe('delete', () => {
    it('should delete a prompt', async () => {
      const existing = [
        { id: 'custom_1', name: 'Prompt 1', prompt: 'Text 1', isCustom: true },
        { id: 'custom_2', name: 'Prompt 2', prompt: 'Text 2', isCustom: true }
      ];
      fs.readFile.mockResolvedValue(JSON.stringify(existing));
      fs.writeFile.mockResolvedValue();

      const result = await manager.delete('custom_1');

      expect(result).toBe(true);
      const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe('custom_2');
    });

    it('should throw error if prompt not found', async () => {
      fs.readFile.mockResolvedValue('[]');

      await expect(manager.delete('nonexistent'))
        .rejects.toThrow('Prompt not found');
    });
  });

  describe('getAll', () => {
    it('should return all prompts', async () => {
      const mockPrompts = [
        { id: 'custom_1', name: 'Prompt 1', prompt: 'Text 1', isCustom: true },
        { id: 'custom_2', name: 'Prompt 2', prompt: 'Text 2', isCustom: true }
      ];
      fs.readFile.mockResolvedValue(JSON.stringify(mockPrompts));

      const result = await manager.getAll();

      expect(result).toEqual(mockPrompts);
    });

    it('should return empty array if no prompts exist', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValue(error);

      const result = await manager.getAll();

      expect(result).toEqual([]);
    });
  });
});
