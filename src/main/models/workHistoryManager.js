const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');

class WorkHistoryManager {
  constructor() {
    this.dir = path.join(app.getPath('userData'), 'work-history');
  }

  async _ensureDir() {
    await fs.mkdir(this.dir, { recursive: true });
  }

  _filePath(id) {
    return path.join(this.dir, `${id}.json`);
  }

  async save(session) {
    await this._ensureDir();
    session.updatedAt = new Date().toISOString();
    if (!session.title && session.messages.length > 0) {
      const first = session.messages.find(m => m.role === 'user');
      session.title = first ? first.content.slice(0, 50) : 'Untitled';
    }
    await fs.writeFile(this._filePath(session.id), JSON.stringify(session));
  }

  async load(id) {
    const data = await fs.readFile(this._filePath(id), 'utf8');
    return JSON.parse(data);
  }

  async list() {
    await this._ensureDir();
    const files = await fs.readdir(this.dir);
    const sessions = [];
    for (const f of files.filter(f => f.endsWith('.json'))) {
      try {
        const data = JSON.parse(await fs.readFile(path.join(this.dir, f), 'utf8'));
        sessions.push({ id: data.id, title: data.title, createdAt: data.createdAt, updatedAt: data.updatedAt });
      } catch { /* skip corrupt */ }
    }
    return sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async remove(id) {
    try { await fs.unlink(this._filePath(id)); } catch { /* already gone */ }
  }
}

module.exports = WorkHistoryManager;
