const { ConverseStreamCommand } = require('@aws-sdk/client-bedrock-runtime');
const { SageMakerRuntimeClient, InvokeEndpointCommand } = require('@aws-sdk/client-sagemaker-runtime');
const { sanitizeFileName } = require('../utils');
const { region } = require('../../../config');
const fs = require('fs').promises;
const path = require('path');

/**
 * AgentToolExecutor — runs the agentic Converse loop with tool use.
 *
 * Flow: user prompt → Converse (with tools) → if tool_use → execute tool →
 *       feed toolResult back → Converse again → repeat until end_turn.
 */
class AgentToolExecutor {
  constructor({ bedrockClient, skillsManager, codeInterpreterManager, browserManager, memoryManager, sessionId, settings, onStatus, onChunk }) {
    this.bedrock = bedrockClient;
    this.skills = skillsManager;
    this.codeInterpreter = codeInterpreterManager;
    this.browser = browserManager;
    this.memory = memoryManager;
    this.sessionId = sessionId;
    this.settings = settings || {};
    this.onStatus = onStatus || (() => {});
    this.onChunk = onChunk || (() => {});
  }

  buildSystemPrompt(memoryContext = '') {
    const catalog = this.skills.getCatalog();
    const base = catalog.length === 0
      ? `You are a powerful work agent that completes complex, multi-step tasks. You can execute Python code via execute_code, read local files via read_local_file, and save files to the user's filesystem via save_file_locally. After generating any file, you MUST call save_file_locally to deliver it to the user and tell them the full local path where it was saved. Never leave generated files only in the sandbox.`
      : `You are a powerful work agent that completes complex, multi-step tasks using tools.

<available_skills>
${catalog.map(s => `  <skill>\n    <name>${s.name}</name>\n    <description>${s.description}</description>\n  </skill>`).join('\n')}
</available_skills>

<instructions>
- When a task matches a skill's description, call activate_skill to load its full instructions before proceeding.
- You can execute arbitrary Python code via execute_code for any task — not just skills. Write code to solve problems even when no skill covers the task.
- When the user mentions a local file path in their prompt, use read_local_file to load it into the sandbox before processing.
- When the user provides a working directory, use list_directory to discover files, then read_local_file to load the ones you need.
- After generating files in the sandbox (always save to /tmp/), you MUST call save_file_locally to deliver them to the user's local filesystem. Never leave generated files only in the sandbox.
- After saving a file locally, you MUST tell the user the full local path where the file was saved. Example: "I've saved the document to /Users/name/Documents/report.docx"
- Break complex tasks into steps. Execute code, inspect results, and iterate until the task is complete.
- You can browse the web using the web tool. Pass a URL to read a page, or a query to search Google. For research: search first, then browse specific result URLs for deeper content.
- If a library is missing in the sandbox, install it with pip via execute_code before using it.
</instructions>`;

    return memoryContext
      ? `${base}\n\nYou have persistent memory of past conversations with this user. Use the context below to personalise your responses and recall previous interactions when relevant.\n\n${memoryContext}`
      : base;
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
                local_path: { type: 'string', description: 'Absolute path on the user\'s local filesystem to save the file. Must be a full absolute path (e.g. C:\\Users\\name\\file.txt or /Users/name/file.txt), never concatenate with the working directory.' },
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
      {
        toolSpec: {
          name: 'generate_image',
          description: 'Generate an image using AI. The system automatically picks the best model. Use for photos, illustrations, backgrounds, icons, or any visual content needed in documents or presentations.',
          inputSchema: {
            json: {
              type: 'object',
              properties: {
                prompt: { type: 'string', description: 'Detailed description of the image to generate' },
                negative_prompt: { type: 'string', description: 'What to avoid in the image (optional)' },
                width: { type: 'integer', description: 'Image width in pixels (default 1024). Must be 320-4096 in increments of 64.' },
                height: { type: 'integer', description: 'Image height in pixels (default 1024). Must be 320-4096 in increments of 64.' },
              },
              required: ['prompt'],
            },
          },
        },
      },
      {
        toolSpec: {
          name: 'web',
          description: 'Browse the web. Provide a URL to navigate directly, or a search query to search Google first. For research tasks: search first, then browse specific result URLs for details.',
          inputSchema: {
            json: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'A URL to navigate to directly (e.g. https://example.com)' },
                query: { type: 'string', description: 'A search query to search Google (e.g. "python-docx latest version")' },
              },
            },
          },
        },
      },
      {
        toolSpec: {
          name: 'list_directory',
          description: 'List files and subdirectories in a local directory. Use when the user provides a workspace or you need to discover files before reading them.',
          inputSchema: {
            json: {
              type: 'object',
              properties: {
                dir_path: { type: 'string', description: 'Absolute path to the directory to list' },
              },
              required: ['dir_path'],
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

    // Load memory context if available
    let memoryContext = '';
    if (this.memory && this.sessionId) {
      try {
        this.onStatus({ tool: 'memory', detail: 'Loading context...', state: 'running' });
        memoryContext = await this.memory.buildContext(this.sessionId, prompt);
        this.onStatus({ tool: 'memory', detail: 'Context loaded', state: 'done' });
      } catch (err) {
        console.warn('Memory load failed:', err.message);
      }
    }

    // Build user message content
    const userContent = [{ text: prompt }];
    for (const file of files) {
      const ext = file.name.toLowerCase().split('.').pop();
      if (['pptx', 'ppt'].includes(ext)) {
        // Extract via code interpreter — start session if not already running
        if (!this.codeInterpreter.sessionId) {
          await this.codeInterpreter.startSession();
        }
        await this.codeInterpreter.writeFiles([{ path: file.name, content: Array.isArray(file.content) ? file.content : Array.from(file.content) }]);
        const result = await this.codeInterpreter.executeCode(`
from pptx import Presentation
prs = Presentation("${file.name}")
slides = []
for i, slide in enumerate(prs.slides):
    texts = [shape.text_frame.text for shape in slide.shapes if shape.has_text_frame and shape.text_frame.text.strip()]
    if texts:
        slides.append(f"Slide {i+1}:\\n" + "\\n".join(texts))
print("\\n\\n".join(slides))
`);
        userContent.push({ text: `\n--- Content from ${file.name} ---\n${result.text}\n--- End ---\n` });
      } else if (['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)) {
        const bytes = Array.isArray(file.content) ? new Uint8Array(file.content) : file.content;
        userContent.push({
          document: { name: sanitizeFileName(file.name), format: ext, source: { bytes } },
        });
      } else {
        userContent.push({ text: `\n--- Content from ${file.name} ---\n${file.content}\n--- End ---\n` });
      }
    }
    messages.push({ role: 'user', content: userContent });

    // Store the system prompt with memory context for this run
    this._memoryContext = memoryContext;

    let sessionStarted = false;
    const maxIterations = 15;
    let finalText = '';

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
          finalText = textParts.map(p => p.text).join('');
          return finalText;
        }

        // Process tool calls
        const toolResults = [];
        for (const block of assistantContent) {
          if (!block.toolUse) continue;

          const { toolUseId, name, input } = block.toolUse;
          const detail = this._toolDetail(name, input);
          this.onStatus({ tool: name, detail, state: 'running' });

          let result;
          try {
            result = await this._executeTool(name, input, { sessionStarted });
            if (name === 'execute_code' && !sessionStarted) sessionStarted = true;
            this.onStatus({ tool: name, detail, state: 'done' });
          } catch (err) {
            result = { error: err.message };
            this.onStatus({ tool: name, detail: err.message, state: 'done' });
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

      finalText = 'Agent reached maximum iterations without completing.';
      return finalText;
    } finally {
      // Save conversation to memory
      if (this.memory && this.sessionId && finalText) {
        try {
          await this.memory.saveEvent(this.sessionId, [
            { role: 'user', content: prompt },
            { role: 'assistant', content: finalText },
          ]);
        } catch (err) {
          console.warn('Memory save failed:', err.message);
        }
      }

      if (sessionStarted) {
        this.onStatus({ tool: 'cleanup', detail: 'Closing sandbox', state: 'running' });
        await this.codeInterpreter.stopSession().catch(() => {});
      }
      if (this.browser.sessionId) {
        this.onStatus({ tool: 'cleanup', detail: 'Closing browser', state: 'running' });
        await this.browser.stopSession().catch(() => {});
      }
    }
  }

  async _converse(model, messages) {
    const command = new ConverseStreamCommand({
      modelId: model,
      system: [{ text: this.buildSystemPrompt(this._memoryContext) }],
      messages,
      toolConfig: this.getToolConfig(),
      inferenceConfig: { maxTokens: model.includes('claude') ? 16384 : 8192, temperature: 0.7 },
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

  _toolDetail(name, input) {
    switch (name) {
      case 'activate_skill': return input.name;
      case 'execute_code': return (input.code || '').split('\n')[0].slice(0, 60);
      case 'save_file_locally': return input.local_path?.split('/').pop();
      case 'read_local_file': return input.local_path?.split('/').pop();
      case 'generate_image': return input.prompt?.slice(0, 60);
      case 'web': return input.url || input.query?.slice(0, 60);
      case 'list_directory': return input.dir_path?.split('/').pop();
      default: return '';
    }
  }

  async _executeTool(name, input, state) {
    switch (name) {
      case 'activate_skill':
        return this._handleActivateSkill(input.name);

      case 'execute_code':
        if (!this.codeInterpreter.sessionId) {
          this.onStatus({ tool: 'sandbox', detail: 'Starting sandbox...', state: 'running' });
          await this.codeInterpreter.startSession();
          this.onStatus({ tool: 'sandbox', detail: 'Sandbox ready', state: 'done' });
        }
        const result = await this.codeInterpreter.executeCode(input.code);
        if (!result.success) return { error: result.errors.join('\n'), output: result.text };
        return { output: result.text };

      case 'save_file_locally':
        return this._handleSaveFile(input.sandbox_path, input.local_path);

      case 'read_local_file':
        return this._handleReadFile(input.local_path, input.sandbox_path);

      case 'generate_image':
        return this._handleGenerateImage(input);

      case 'web':
        return this._handleWeb(input);

      case 'list_directory':
        return this._handleListDirectory(input.dir_path);

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
    // Fix double-path bug: agent may concatenate working dir with an absolute path
    // e.g. "C:\Users\a\Documents\C:\Users\a\Desktop\file.txt"
    const driveMatch = localPath.match(/^[A-Za-z]:\\.*?([A-Za-z]:\\.*)/);
    if (driveMatch) localPath = driveMatch[1];

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

  async _handleGenerateImage({ prompt, negative_prompt, width, height }) {
    const w = width || 1024;
    const h = height || 1024;

    this.onStatus({ tool: 'generate_image', detail: prompt?.slice(0, 40), state: 'running' });

    let base64Image;
    let modelUsed;
    const smEndpoint = this.settings.sagemakerImageEndpoint;

    if (smEndpoint) {
      try {
        // Primary: SageMaker SDXL endpoint
        const smClient = new SageMakerRuntimeClient({ region });
        const payload = JSON.stringify({
          text_prompts: [
            { text: prompt },
            ...(negative_prompt ? [{ text: negative_prompt, weight: -1 }] : []),
          ],
          width: w,
          height: h,
          samples: 1,
          steps: 30,
          cfg_scale: 7.5,
        });

        const params = {
          EndpointName: smEndpoint,
          ContentType: 'application/json',
          Accept: 'application/json',
          Body: Buffer.from(payload),
        };
        if (this.settings.sagemakerImageComponent) {
          params.InferenceComponentName = this.settings.sagemakerImageComponent;
        }

        const response = await smClient.send(new InvokeEndpointCommand(params));
        const body = JSON.parse(Buffer.from(response.Body).toString());
        base64Image = body.generated_image;
        modelUsed = 'sdxl-1.0-sagemaker';
      } catch (err) {
        console.warn('SageMaker image gen failed, falling back to Nova Canvas:', err.message);
      }
    }

    if (!base64Image) {
      // Fallback: Nova Canvas via Bedrock
      const { InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
      const fallbackModel = 'amazon.nova-canvas-v1:0';
      const body = JSON.stringify({
        taskType: 'TEXT_IMAGE',
        textToImageParams: {
          text: prompt,
          ...(negative_prompt && { negativeText: negative_prompt }),
        },
        imageGenerationConfig: { numberOfImages: 1, width: w, height: h, cfgScale: 8.0 },
      });

      const response = await this.bedrock.send(new InvokeModelCommand({
        modelId: fallbackModel, body, accept: 'application/json', contentType: 'application/json',
      }));

      base64Image = JSON.parse(new TextDecoder().decode(response.body)).images[0];
      modelUsed = fallbackModel;
    }

    const buffer = Buffer.from(base64Image, 'base64');
    const result = { success: true, model: modelUsed, width: w, height: h, size: buffer.length };

    // If sandbox is running, write there for document embedding
    if (this.codeInterpreter.sessionId) {
      const sandboxPath = `/tmp/generated_${Date.now()}.png`;
      const code = `import base64\ndata = base64.b64decode("""${base64Image}""")\nwith open("${sandboxPath}", "wb") as f:\n    f.write(data)\nprint(f"Image saved: ${sandboxPath} ({len(data)} bytes)")`;
      await this.codeInterpreter.executeCode(code);
      result.sandbox_path = sandboxPath;
    }

    return result;
  }

  async _handleWeb({ url, query }) {
    if (!this.browser.sessionId) {
      this.onStatus('Starting browser session...');
      await this.browser.startSession();
    }

    const targetUrl = url || `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    this.onStatus(url ? `Navigating to ${url}...` : `Searching: ${query}...`);
    const nav = await this.browser.navigate(targetUrl);

    this.onStatus('Extracting page content...');
    const content = await this.browser.getPageContent();

    const maxLen = url ? 15000 : 10000;
    const truncated = content.length > maxLen
      ? content.substring(0, maxLen) + '\n\n[Content truncated]'
      : content;

    return { url: targetUrl, title: nav.title, content: truncated };
  }

  async _handleListDirectory(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const items = entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'directory' : 'file',
    }));
    return { path: dirPath, count: items.length, entries: items };
  }

}

module.exports = AgentToolExecutor;
