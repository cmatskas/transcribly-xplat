const { ConverseStreamCommand } = require('@aws-sdk/client-bedrock-runtime');
const fs = require('fs').promises;
const path = require('path');

/**
 * AgentToolExecutor — runs the agentic Converse loop with tool use.
 *
 * Flow: user prompt → Converse (with tools) → if tool_use → execute tool →
 *       feed toolResult back → Converse again → repeat until end_turn.
 */
class AgentToolExecutor {
  constructor({ bedrockClient, skillsManager, codeInterpreterManager, onStatus, onChunk }) {
    this.bedrock = bedrockClient;
    this.skills = skillsManager;
    this.codeInterpreter = codeInterpreterManager;
    this.onStatus = onStatus || (() => {});
    this.onChunk = onChunk || (() => {});
  }

  buildSystemPrompt() {
    const catalog = this.skills.getCatalog();
    if (catalog.length === 0) return 'You are a helpful assistant.';

    const skillList = catalog
      .map(s => `  <skill>\n    <name>${s.name}</name>\n    <description>${s.description}</description>\n  </skill>`)
      .join('\n');

    return `You are a helpful assistant with access to specialized skills.

<available_skills>
${skillList}
</available_skills>

When a task matches a skill's description, call the activate_skill tool with the skill's name to load its full instructions before proceeding. After activation, follow the skill's instructions to complete the task using the execute_code tool. Save output files to /tmp/ in the sandbox — the system will transfer them to the user's local filesystem.`;
  }

  getToolConfig() {
    const tools = [
      {
        toolSpec: {
          name: 'activate_skill',
          description: 'Load full instructions for a skill. Call this before using a skill.',
          inputSchema: {
            json: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'The skill name to activate',
                  enum: this.skills.getCatalog().map(s => s.name),
                },
              },
              required: ['name'],
            },
          },
        },
      },
      {
        toolSpec: {
          name: 'execute_code',
          description: 'Execute Python code in a secure sandbox. Use for computations, file generation, data processing.',
          inputSchema: {
            json: {
              type: 'object',
              properties: {
                code: { type: 'string', description: 'Python code to execute' },
              },
              required: ['code'],
            },
          },
        },
      },
      {
        toolSpec: {
          name: 'save_file_locally',
          description: 'Save a file from the sandbox to the user\'s local filesystem.',
          inputSchema: {
            json: {
              type: 'object',
              properties: {
                sandbox_path: { type: 'string', description: 'Path to the file in the sandbox (e.g. /tmp/output.docx)' },
                local_path: { type: 'string', description: 'Absolute path on the user\'s local filesystem to save the file' },
              },
              required: ['sandbox_path', 'local_path'],
            },
          },
        },
      },
      {
        toolSpec: {
          name: 'read_local_file',
          description: 'Read a file from the user\'s local filesystem and upload it to the sandbox.',
          inputSchema: {
            json: {
              type: 'object',
              properties: {
                local_path: { type: 'string', description: 'Absolute path to the local file' },
                sandbox_path: { type: 'string', description: 'Path in the sandbox to write the file (e.g. /tmp/input.docx)' },
              },
              required: ['local_path', 'sandbox_path'],
            },
          },
        },
      },
    ];

    // Only include activate_skill if there are skills
    if (this.skills.getCatalog().length === 0) {
      tools.shift();
    }

    return { tools };
  }

  /**
   * Run the full agent loop. Returns the final assistant text.
   */
  async run(model, prompt, conversationHistory = [], files = []) {
    const messages = [...conversationHistory];

    // Build user message content
    const userContent = [{ text: prompt }];
    for (const file of files) {
      const ext = file.name.toLowerCase().split('.').pop();
      if (['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)) {
        const bytes = Array.isArray(file.content) ? new Uint8Array(file.content) : file.content;
        userContent.push({
          document: { name: this._sanitizeName(file.name), format: ext, source: { bytes } },
        });
      } else {
        userContent.push({ text: `\n--- Content from ${file.name} ---\n${file.content}\n--- End ---\n` });
      }
    }
    messages.push({ role: 'user', content: userContent });

    let sessionStarted = false;
    const maxIterations = 15;

    try {
      for (let i = 0; i < maxIterations; i++) {
        const response = await this._converse(model, messages);

        // Collect assistant response
        const assistantContent = response.content;
        messages.push({ role: 'assistant', content: assistantContent });

        // Stream text chunks
        const textParts = assistantContent.filter(b => b.text);
        for (const part of textParts) {
          this.onChunk(part.text);
        }

        if (response.stopReason !== 'tool_use') {
          // Done — return final text
          return textParts.map(p => p.text).join('');
        }

        // Process tool calls
        const toolResults = [];
        for (const block of assistantContent) {
          if (!block.toolUse) continue;

          const { toolUseId, name, input } = block.toolUse;
          this.onStatus(`Using tool: ${name}`);

          let result;
          try {
            result = await this._executeTool(name, input, { sessionStarted });
            if (name === 'execute_code' && !sessionStarted) sessionStarted = true;
          } catch (err) {
            result = { error: err.message };
          }

          toolResults.push({
            toolResult: {
              toolUseId,
              content: [{ text: typeof result === 'string' ? result : JSON.stringify(result) }],
            },
          });
        }

        messages.push({ role: 'user', content: toolResults });
      }

      return 'Agent reached maximum iterations without completing.';
    } finally {
      if (sessionStarted) {
        this.onStatus('Cleaning up sandbox...');
        await this.codeInterpreter.stopSession().catch(() => {});
      }
    }
  }

  async _converse(model, messages) {
    const command = new ConverseStreamCommand({
      modelId: model,
      system: [{ text: this.buildSystemPrompt() }],
      messages,
      toolConfig: this.getToolConfig(),
      inferenceConfig: { maxTokens: 4096, temperature: 0.7 },
    });

    const response = await this.bedrock.send(command);

    // Collect the full streamed response into content blocks
    const content = [];
    let currentText = '';
    let currentToolUse = null;
    let toolInput = '';

    for await (const event of response.stream) {
      if (event.contentBlockStart?.start?.toolUse) {
        if (currentText) { content.push({ text: currentText }); currentText = ''; }
        currentToolUse = event.contentBlockStart.start.toolUse;
        toolInput = '';
      }
      if (event.contentBlockDelta?.delta?.text) {
        currentText += event.contentBlockDelta.delta.text;
      }
      if (event.contentBlockDelta?.delta?.toolUse) {
        toolInput += event.contentBlockDelta.delta.toolUse.input || '';
      }
      if (event.contentBlockStop) {
        if (currentToolUse) {
          let parsedInput = {};
          try { parsedInput = JSON.parse(toolInput); } catch {}
          content.push({ toolUse: { toolUseId: currentToolUse.toolUseId, name: currentToolUse.name, input: parsedInput } });
          currentToolUse = null;
          toolInput = '';
        }
      }
      if (event.messageStop) {
        if (currentText) { content.push({ text: currentText }); currentText = ''; }
        return { content, stopReason: event.messageStop.stopReason };
      }
    }

    if (currentText) content.push({ text: currentText });
    return { content, stopReason: 'end_turn' };
  }

  async _executeTool(name, input, state) {
    switch (name) {
      case 'activate_skill':
        return this._handleActivateSkill(input.name);

      case 'execute_code':
        if (!this.codeInterpreter.sessionId) {
          this.onStatus('Starting Code Interpreter sandbox...');
          await this.codeInterpreter.startSession();
        }
        this.onStatus('Executing code in sandbox...');
        const result = await this.codeInterpreter.executeCode(input.code);
        if (!result.success) return { error: result.errors.join('\n'), output: result.text };
        return { output: result.text };

      case 'save_file_locally':
        return this._handleSaveFile(input.sandbox_path, input.local_path);

      case 'read_local_file':
        return this._handleReadFile(input.local_path, input.sandbox_path);

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  async _handleActivateSkill(name) {
    if (this.skills.isActivated(name)) {
      return `Skill "${name}" is already activated in this session.`;
    }

    const body = await this.skills.getSkillBody(name);
    if (!body) return { error: `Skill not found: ${name}` };

    this.skills.markActivated(name);
    const resources = await this.skills.listResources(name);
    const dir = this.skills.getSkillDir(name);

    let wrapped = `<skill_content name="${name}">\n${body}\n\nSkill directory: ${dir}`;
    if (resources.length > 0) {
      wrapped += `\n\n<skill_resources>\n${resources.map(r => `  <file>${r}</file>`).join('\n')}\n</skill_resources>`;
    }
    wrapped += '\n</skill_content>';
    return wrapped;
  }

  async _handleSaveFile(sandboxPath, localPath) {
    this.onStatus(`Saving file to ${localPath}...`);
    const base64 = await this.codeInterpreter.readFileBase64(sandboxPath);
    const buffer = Buffer.from(base64, 'base64');
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, buffer);
    return { success: true, path: localPath, size: buffer.length };
  }

  async _handleReadFile(localPath, sandboxPath) {
    this.onStatus(`Reading ${localPath}...`);
    const buffer = await fs.readFile(localPath);
    const base64 = buffer.toString('base64');
    // Write to sandbox via code execution
    const code = `
import base64
data = base64.b64decode("${base64}")
with open("${sandboxPath}", "wb") as f:
    f.write(data)
print(f"Wrote {len(data)} bytes to ${sandboxPath}")
`;
    const result = await this.codeInterpreter.executeCode(code);
    return { success: result.success, output: result.text };
  }

  _sanitizeName(fileName) {
    return fileName.replace(/[^a-zA-Z0-9\s\-().[\]]/g, '_').replace(/\s{2,}/g, ' ').trim();
  }
}

module.exports = AgentToolExecutor;
