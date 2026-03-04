const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

const COMPRESSION_THRESHOLD = 20; // compress when history exceeds this many messages
const MESSAGES_TO_KEEP = 4;       // keep this many recent messages after compression

class ConversationManager {
  constructor() {
    this.dir = path.join(app.getPath('userData'), 'conversations');
  }

  async ensureDir() {
    await fs.mkdir(this.dir, { recursive: true });
  }

  filePath(id) {
    return path.join(this.dir, `${id}.json`);
  }

  async list() {
    await this.ensureDir();
    const files = await fs.readdir(this.dir);
    const conversations = await Promise.all(
      files
        .filter(f => f.endsWith('.json'))
        .map(async f => {
          const data = JSON.parse(await fs.readFile(path.join(this.dir, f), 'utf8'));
          return { id: data.id, title: data.title, createdAt: data.createdAt, updatedAt: data.updatedAt };
        })
    );
    return conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async load(id) {
    const data = await fs.readFile(this.filePath(id), 'utf8');
    return JSON.parse(data);
  }

  async save(conversation) {
    await this.ensureDir();
    conversation.updatedAt = new Date().toISOString();
    await fs.writeFile(this.filePath(conversation.id), JSON.stringify(conversation, null, 2));
    return conversation;
  }

  async delete(id) {
    await fs.unlink(this.filePath(id));
  }

  create(firstPrompt) {
    const id = `conv_${Date.now()}`;
    const title = firstPrompt.length > 50 ? firstPrompt.slice(0, 50) + '…' : firstPrompt;
    return {
      id,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []  // { role: 'user'|'assistant', content: string, timestamp: string }
    };
  }

  needsCompression(conversation) {
    return conversation.messages.length > COMPRESSION_THRESHOLD;
  }

  // Returns messages formatted for Bedrock ConverseCommand
  toBedrockMessages(conversation) {
    return conversation.messages.map(m => ({
      role: m.role,
      content: [{ text: m.content }]
    }));
  }

  // Replace old messages with a summary, keep recent ones intact
  applyCompression(conversation, summary) {
    const recent = conversation.messages.slice(-MESSAGES_TO_KEEP);
    conversation.messages = [
      { role: 'user', content: `[Previous conversation summary]: ${summary}`, timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Understood. I have the context from our previous conversation.', timestamp: new Date().toISOString() },
      ...recent
    ];
    return conversation;
  }
}

module.exports = ConversationManager;
