/**
 * Strands tool factory — creates Zod-based Strands tools that wrap
 * Transcribely's existing tool implementations (code interpreter, browser, file I/O).
 */
const { tool } = require('@strands-agents/sdk');
const { z } = require('zod');

function createSwarmTools({ codeInterpreterManager, browserManager, settings, onStatus }, toolNames) {
  const registry = {
    execute_code: () => tool({
      name: 'execute_code',
      description: 'Execute Python code in a secure sandbox. Use for computations, file generation, data processing.',
      inputSchema: z.object({ code: z.string().describe('Python code to execute') }),
      callback: async (input) => {
        if (!codeInterpreterManager.sessionId) {
          onStatus?.('Starting sandbox...');
          await codeInterpreterManager.startSession();
        }
        const result = await codeInterpreterManager.executeCode(input.code);
        if (!result.success) return JSON.stringify({ error: result.errors.join('\n'), output: result.text });
        return result.text || 'Code executed successfully (no output).';
      },
    }),

    save_file_locally: () => tool({
      name: 'save_file_locally',
      description: 'Save a file from the sandbox to the user\'s local filesystem.',
      inputSchema: z.object({
        sandbox_path: z.string().describe('Path in sandbox (e.g. /tmp/output.docx)'),
        local_path: z.string().describe('Absolute path on user filesystem'),
      }),
      callback: async (input) => {
        if (!codeInterpreterManager.sessionId) throw new Error('No sandbox session');
        const content = await codeInterpreterManager.downloadFile(input.sandbox_path);
        const fs = require('fs').promises;
        const path = require('path');
        await fs.mkdir(path.dirname(input.local_path), { recursive: true });
        await fs.writeFile(input.local_path, content);
        return `Saved to ${input.local_path}`;
      },
    }),

    read_local_file: () => tool({
      name: 'read_local_file',
      description: 'Read a file from the user\'s local filesystem into the sandbox.',
      inputSchema: z.object({
        local_path: z.string().describe('Absolute path to local file'),
        sandbox_path: z.string().describe('Path in sandbox to write (e.g. /tmp/input.docx)'),
      }),
      callback: async (input) => {
        const fs = require('fs').promises;
        const content = await fs.readFile(input.local_path);
        if (!codeInterpreterManager.sessionId) await codeInterpreterManager.startSession();
        await codeInterpreterManager.uploadFile(input.sandbox_path, content);
        return `Uploaded ${input.local_path} to sandbox at ${input.sandbox_path}`;
      },
    }),

    web: () => tool({
      name: 'web',
      description: 'Browse the web. Provide a URL to read a page, or a query to search Google.',
      inputSchema: z.object({
        url: z.string().optional().describe('URL to navigate to'),
        query: z.string().optional().describe('Search query for Google'),
      }),
      callback: async (input) => {
        if (!browserManager) throw new Error('Browser not available');
        return await browserManager.browse(input);
      },
    }),

    generate_image: () => tool({
      name: 'generate_image',
      description: 'Generate an image using AI. Returns the sandbox path of the generated image.',
      inputSchema: z.object({
        prompt: z.string().describe('Detailed description of the image'),
        width: z.number().optional().describe('Width in pixels (default 1024)'),
        height: z.number().optional().describe('Height in pixels (default 1024)'),
      }),
      callback: async (input) => {
        // Delegate to the same image generation logic as AgentToolExecutor
        // This is a simplified version — full implementation would need SageMaker/Nova Canvas client
        return JSON.stringify({ error: 'Image generation not yet available in swarm pipelines' });
      },
    }),
  };

  return toolNames
    .filter(name => registry[name])
    .map(name => registry[name]());
}

module.exports = { createSwarmTools };
