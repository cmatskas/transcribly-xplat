/**
 * Tests for ConversationManager
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock electron app
jest.mock('electron', () => ({
    app: {
        getPath: () => '/tmp'
    }
}));

const ConversationManager = require('../../src/main/models/conversationManager');

describe('ConversationManager', () => {
    let manager;
    let testDir;

    beforeEach(async () => {
        testDir = path.join(os.tmpdir(), `test-conversations-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
        manager = new ConversationManager();
        manager.conversationsFile = path.join(testDir, 'conversations.json');
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (e) {
            // Ignore cleanup errors
        }
    });

    describe('create()', () => {
        test('should create new conversation with unique ID', async () => {
            const conv = await manager.create();
            expect(conv).toHaveProperty('id');
            expect(conv).toHaveProperty('messages');
            expect(conv).toHaveProperty('createdAt');
            expect(conv.messages).toEqual([]);
        });

        test('should generate unique IDs for multiple conversations', async () => {
            const conv1 = await manager.create();
            const conv2 = await manager.create();
            expect(conv1.id).not.toBe(conv2.id);
        });

        test('should save conversation to file', async () => {
            const conv = await manager.create();
            const all = await manager.getAll();
            expect(all).toHaveLength(1);
            expect(all[0].id).toBe(conv.id);
        });
    });

    describe('addMessage()', () => {
        test('should add user message to conversation', async () => {
            const conv = await manager.create();
            await manager.addMessage(conv.id, 'user', 'Hello');
            
            const updated = await manager.get(conv.id);
            expect(updated.messages).toHaveLength(1);
            expect(updated.messages[0]).toMatchObject({
                role: 'user',
                content: 'Hello'
            });
        });

        test('should add assistant message to conversation', async () => {
            const conv = await manager.create();
            await manager.addMessage(conv.id, 'assistant', 'Hi there');
            
            const updated = await manager.get(conv.id);
            expect(updated.messages[0]).toMatchObject({
                role: 'assistant',
                content: 'Hi there'
            });
        });

        test('should add timestamp to messages', async () => {
            const conv = await manager.create();
            await manager.addMessage(conv.id, 'user', 'Test');
            
            const updated = await manager.get(conv.id);
            expect(updated.messages[0]).toHaveProperty('timestamp');
        });

        test('should throw error for non-existent conversation', async () => {
            await expect(
                manager.addMessage('invalid-id', 'user', 'Test')
            ).rejects.toThrow('Conversation not found');
        });
    });

    describe('get()', () => {
        test('should retrieve conversation by ID', async () => {
            const conv = await manager.create();
            const retrieved = await manager.get(conv.id);
            expect(retrieved.id).toBe(conv.id);
        });

        test('should return null for non-existent conversation', async () => {
            const result = await manager.get('invalid-id');
            expect(result).toBeNull();
        });
    });

    describe('getAll()', () => {
        test('should return empty array when no conversations', async () => {
            const all = await manager.getAll();
            expect(all).toEqual([]);
        });

        test('should return all conversations', async () => {
            await manager.create();
            await manager.create();
            await manager.create();
            
            const all = await manager.getAll();
            expect(all).toHaveLength(3);
        });

        test('should return conversations sorted by creation date', async () => {
            const conv1 = await manager.create();
            await new Promise(resolve => setTimeout(resolve, 10));
            const conv2 = await manager.create();
            
            const all = await manager.getAll();
            expect(all[0].id).toBe(conv2.id);
            expect(all[1].id).toBe(conv1.id);
        });
    });

    describe('delete()', () => {
        test('should delete conversation by ID', async () => {
            const conv = await manager.create();
            await manager.delete(conv.id);
            
            const result = await manager.get(conv.id);
            expect(result).toBeNull();
        });

        test('should not throw error when deleting non-existent conversation', async () => {
            await expect(manager.delete('invalid-id')).resolves.not.toThrow();
        });

        test('should only delete specified conversation', async () => {
            const conv1 = await manager.create();
            const conv2 = await manager.create();
            
            await manager.delete(conv1.id);
            
            const all = await manager.getAll();
            expect(all).toHaveLength(1);
            expect(all[0].id).toBe(conv2.id);
        });
    });

    describe('compress()', () => {
        test('should compress long conversations', async () => {
            const conv = await manager.create();
            
            // Add many messages
            for (let i = 0; i < 20; i++) {
                await manager.addMessage(conv.id, 'user', `Message ${i}`);
                await manager.addMessage(conv.id, 'assistant', `Response ${i}`);
            }
            
            await manager.compress(conv.id, 10);
            
            const updated = await manager.get(conv.id);
            expect(updated.messages.length).toBeLessThan(40);
        });

        test('should keep system messages during compression', async () => {
            const conv = await manager.create();
            await manager.addMessage(conv.id, 'system', 'System prompt');
            
            for (let i = 0; i < 10; i++) {
                await manager.addMessage(conv.id, 'user', `Message ${i}`);
            }
            
            await manager.compress(conv.id, 5);
            
            const updated = await manager.get(conv.id);
            const systemMsg = updated.messages.find(m => m.role === 'system');
            expect(systemMsg).toBeTruthy();
        });
    });

    describe('Error Handling', () => {
        test('should handle file read errors gracefully', async () => {
            manager.conversationsFile = '/invalid/path/conversations.json';
            const all = await manager.getAll();
            expect(all).toEqual([]);
        });

        test('should handle corrupted JSON file', async () => {
            await fs.writeFile(manager.conversationsFile, 'invalid json');
            const all = await manager.getAll();
            expect(all).toEqual([]);
        });
    });
});
