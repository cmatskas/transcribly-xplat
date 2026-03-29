const fs = require('fs').promises;
const path = require('path');
const os = require('os');

jest.mock('electron', () => ({ app: { getPath: () => '/tmp' } }));

const ConversationManager = require('../../src/main/models/conversationManager');

describe('ConversationManager', () => {
    let manager;
    let testDir;

    beforeEach(async () => {
        testDir = path.join(os.tmpdir(), `test-conv-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
        manager = new ConversationManager();
        manager.dir = testDir;
    });

    afterEach(async () => {
        await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    });

    describe('create()', () => {
        test('should create conversation with ID and title from prompt', () => {
            const conv = manager.create('Hello world');
            expect(conv.id).toMatch(/^conv_\d+$/);
            expect(conv.title).toBe('Hello world');
            expect(conv.messages).toEqual([]);
            expect(conv.createdAt).toBeDefined();
        });

        test('should truncate long prompts in title', () => {
            const long = 'A'.repeat(100);
            const conv = manager.create(long);
            expect(conv.title.length).toBeLessThanOrEqual(51);
        });

        test('should generate unique IDs', async () => {
            const c1 = manager.create('First');
            await new Promise(r => setTimeout(r, 2));
            const c2 = manager.create('Second');
            expect(c1.id).not.toBe(c2.id);
        });
    });

    describe('save() and load()', () => {
        test('should save and load a conversation', async () => {
            const conv = manager.create('Test');
            conv.messages.push({ role: 'user', content: 'Hello', timestamp: new Date().toISOString() });
            await manager.save(conv);

            const loaded = await manager.load(conv.id);
            expect(loaded.id).toBe(conv.id);
            expect(loaded.messages).toHaveLength(1);
            expect(loaded.messages[0].content).toBe('Hello');
        });

        test('should update updatedAt on save', async () => {
            const conv = manager.create('Test');
            const before = conv.updatedAt;
            await new Promise(r => setTimeout(r, 10));
            await manager.save(conv);
            const loaded = await manager.load(conv.id);
            expect(new Date(loaded.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
        });
    });

    describe('list()', () => {
        test('should return empty array when no conversations', async () => {
            const all = await manager.list();
            expect(all).toEqual([]);
        });

        test('should list saved conversations', async () => {
            await manager.save(manager.create('First'));
            await new Promise(r => setTimeout(r, 2));
            await manager.save(manager.create('Second'));
            const all = await manager.list();
            expect(all).toHaveLength(2);
        });

        test('should sort by updatedAt descending', async () => {
            const c1 = manager.create('First');
            await manager.save(c1);
            await new Promise(r => setTimeout(r, 10));
            const c2 = manager.create('Second');
            await manager.save(c2);
            const all = await manager.list();
            expect(all[0].title).toBe('Second');
        });
    });

    describe('delete()', () => {
        test('should delete a conversation', async () => {
            const conv = manager.create('Test');
            await manager.save(conv);
            await manager.delete(conv.id);
            const all = await manager.list();
            expect(all).toHaveLength(0);
        });
    });

    describe('needsCompression()', () => {
        test('should return true when messages exceed threshold', () => {
            const conv = manager.create('Test');
            for (let i = 0; i < 25; i++) conv.messages.push({ role: 'user', content: `msg ${i}` });
            expect(manager.needsCompression(conv)).toBe(true);
        });

        test('should return false for short conversations', () => {
            const conv = manager.create('Test');
            conv.messages.push({ role: 'user', content: 'hi' });
            expect(manager.needsCompression(conv)).toBe(false);
        });
    });

    describe('applyCompression()', () => {
        test('should replace old messages with summary and keep recent', () => {
            const conv = manager.create('Test');
            for (let i = 0; i < 25; i++) conv.messages.push({ role: 'user', content: `msg ${i}`, timestamp: new Date().toISOString() });
            manager.applyCompression(conv, 'Summary of previous conversation');
            expect(conv.messages.length).toBe(6); // 2 summary + 4 recent
            expect(conv.messages[0].content).toContain('summary');
        });
    });

    describe('toBedrockMessages()', () => {
        test('should format messages for Bedrock API', () => {
            const conv = manager.create('Test');
            conv.messages.push({ role: 'user', content: 'Hello' });
            const formatted = manager.toBedrockMessages(conv);
            expect(formatted[0]).toEqual({ role: 'user', content: [{ text: 'Hello' }] });
        });
    });
});
