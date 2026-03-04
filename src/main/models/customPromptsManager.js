const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');

class CustomPromptsManager {
  constructor() {
    this.promptsFile = path.join(app.getPath('userData'), 'custom-prompts.json');
    this.defaultPrompts = [
      {
        name: 'Summarize Text',
        prompt: 'Analyze and summarize the following text, highlighting the key points and main themes.'
      },
      {
        name: 'Analyze Sentiment',
        prompt: 'Analyze the sentiment of the following text, identifying emotional tone, key attitudes, and overall sentiment.'
      },
      {
        name: 'Extract Key Points',
        prompt: 'Extract and list the key points, important insights, and main takeaways from the following text.'
      },
      {
        name: 'Generate Action Items',
        prompt: 'Identify and list actionable items, tasks, and next steps from the following text.'
      }
    ];
  }

  async ensureDefaultPrompts() {
    const prompts = await this.load();
    
    // If no prompts exist, initialize with defaults
    if (prompts.length === 0) {
      const initialPrompts = this.defaultPrompts.map((p, index) => ({
        id: `prompt_${Date.now()}_${index}`,
        name: p.name,
        prompt: p.prompt,
        createdAt: new Date().toISOString(),
        isCustom: false
      }));
      await this.save(initialPrompts);
      return initialPrompts;
    }
    
    return prompts;
  }

  async load() {
    try {
      const data = await fs.readFile(this.promptsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async save(prompts) {
    await fs.writeFile(this.promptsFile, JSON.stringify(prompts, null, 2));
  }

  async add(prompt) {
    const prompts = await this.load();
    const newPrompt = {
      id: `custom_${Date.now()}`,
      name: prompt.name,
      prompt: prompt.prompt,
      createdAt: new Date().toISOString(),
      isCustom: true
    };
    prompts.push(newPrompt);
    await this.save(prompts);
    return newPrompt;
  }

  async update(id, updates) {
    const prompts = await this.load();
    const index = prompts.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Prompt not found');
    }
    prompts[index] = { ...prompts[index], ...updates, updatedAt: new Date().toISOString() };
    await this.save(prompts);
    return prompts[index];
  }

  async delete(id) {
    const prompts = await this.load();
    const filtered = prompts.filter(p => p.id !== id);
    if (filtered.length === prompts.length) {
      throw new Error('Prompt not found');
    }
    await this.save(filtered);
    return true;
  }

  async getAll() {
    return await this.ensureDefaultPrompts();
  }
}

module.exports = CustomPromptsManager;
