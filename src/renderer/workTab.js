/**
 * Work tab — agentic chat interface using AgentCore Code Interpreter.
 * Uses shared ChatRenderer and FileManager modules.
 */

(function () {
  const CR = window.ChatRenderer;
  const FM = window.FileManager;

  let workMessages = [];
  let isProcessing = false;
  let workingDirectory = null;
  let sessionId = localStorage.getItem('workSessionId') || generateSessionId();

  function generateSessionId() {
    const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('workSessionId', id);
    return id;
  }

  // File manager for the Work tab's own file input
  const workFiles = FM.createFileManager({
    fileInputId: 'workFileUpload',
    attachBtnId: 'workAttachFiles',
    clearBtnId: 'workClearFiles',
    listSectionId: 'workFileListSection',
    listId: 'workFileList',
    countId: 'workFileCount',
    maxFiles: 5,
  });

  function getContainer() {
    return document.getElementById('workChatHistory');
  }

  function showToast(msg, type) {
    if (window.electronAPI && window.electronAPI.showToast) {
      window.electronAPI.showToast(msg, type);
    }
  }

  function init() {
    workFiles.setup(showToast);

    const sendBtn = document.getElementById('workSendBtn');
    const promptInput = document.getElementById('workPromptEditor');
    const attachBtn = document.getElementById('workAttachFileBtn');
    const attachMenu = document.getElementById('workAttachMenu');

    sendBtn.addEventListener('click', sendWorkMessage);
    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendWorkMessage();
      }
    });
    promptInput.addEventListener('input', () => {
      promptInput.style.height = 'auto';
      promptInput.style.height = Math.min(promptInput.scrollHeight, 200) + 'px';
    });

    // Popover menu toggle
    attachBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      attachMenu.classList.toggle('open');
    });
    document.addEventListener('click', () => attachMenu.classList.remove('open'));

    // Attach files option — fileManager.setup() already triggers the file picker,
    // so we only need to close the popover menu here.
    document.getElementById('workAttachFiles').addEventListener('click', () => {
      attachMenu.classList.remove('open');
    });

    // Select workspace option
    document.getElementById('workSelectDir').addEventListener('click', async () => {
      attachMenu.classList.remove('open');
      const dir = await window.electronAPI.invoke('select-directory');
      if (dir) {
        workingDirectory = dir;
        const badge = document.getElementById('workDirBadge');
        badge.textContent = dir.split('/').pop() || dir;
        badge.title = dir;
        badge.classList.remove('d-none');
        showToast(`Workspace: ${dir}`, 'info');
      }
    });

    // New Chat button — triggers LTM extraction on old session, resets state
    const newChatBtn = document.getElementById('workNewChatBtn');
    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => {
        // Trigger extraction on the old session (fire-and-forget)
        if (workMessages.length > 0) {
          window.electronAPI.invoke('memory-extract', { sessionId }).catch(() => {});
        }
        // Reset state
        sessionId = generateSessionId();
        workMessages = [];
        streamingEl = null;
        streamingText = '';
        activityLog = null;
        lastEntry = null;
        const container = getContainer();
        container.innerHTML = `
          <div id="workPlaceholder" class="work-greeting">
            <div class="work-greeting-icon">✦</div>
            <div class="work-greeting-text">What can I help you create?</div>
          </div>`;
      });
    }

    // Listen for agent status updates — build activity log
    window.electronAPI.receive('agent-status', (status) => {
      const container = getContainer();

      // Rich status object: { tool, detail, state }
      if (typeof status === 'object' && status.tool) {
        if (!activityLog) {
          activityLog = CR.createActivityLog(container);
        }
        if (status.state === 'running') {
          lastEntry = CR.addActivityEntry(activityLog, status);
        } else if (status.state === 'done' && lastEntry) {
          CR.completeActivityEntry(lastEntry);
          lastEntry = null;
        }
      } else {
        // Legacy string status fallback
        const prev = container.querySelector('.chat-status-message:last-child');
        if (prev) prev.remove();
        CR.appendStatusMessage(container, status);
      }
    });

    // Listen for agent stream chunks
    window.electronAPI.receive('agent-stream-chunk', (chunk) => {
      updateStreamingBubble(chunk);
    });
  }

  let streamingEl = null;
  let streamingText = '';
  let activityLog = null;
  let lastEntry = null;

  function updateStreamingBubble(chunk) {
    const container = getContainer();
    streamingText += chunk;

    if (!streamingEl) {
      const msg = { role: 'assistant', content: '', timestamp: new Date().toISOString() };
      streamingEl = CR.appendChatMessage(container, msg, {
        onCopy: () => navigator.clipboard.writeText(streamingText).then(
          () => showToast('Copied to clipboard', 'success'),
          () => showToast('Failed to copy', 'error')
        ),
      });
    }

    const bubble = streamingEl.querySelector('.chat-bubble');
    const contentEl = bubble.querySelector('.chat-bubble-content');
    if (contentEl) {
      contentEl.innerHTML = CR.formatText(streamingText);
    }

    container.scrollTop = container.scrollHeight;
  }

  let credentialsVerified = false;

  async function sendWorkMessage() {
    if (isProcessing) return;

    const promptInput = document.getElementById('workPromptEditor');
    const model = document.getElementById('workModelSelect').value;
    const prompt = promptInput.value.trim();

    if (!prompt) {
      showToast('Please enter a message', 'error');
      return;
    }

    // Lazy credential check — once per session
    if (!credentialsVerified) {
      const check = await window.electronAPI.invoke('quick-validate-credentials');
      if (!check.valid) {
        showToast('AWS credentials are invalid or expired. Update in Settings → AWS Credentials.', 'error');
        return;
      }
      credentialsVerified = true;
    }

    // Prepend working directory context if set
    const fullPrompt = workingDirectory
      ? `[Working directory: ${workingDirectory}]\n\n${prompt}`
      : prompt;

    isProcessing = true;
    const container = getContainer();

    // Remove placeholder/greeting
    const placeholder = container.querySelector('.work-greeting') || container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    // Show user message
    const userMsg = { role: 'user', content: prompt, timestamp: new Date().toISOString() };
    workMessages.push(userMsg);
    CR.appendChatMessage(container, userMsg);
    promptInput.value = '';
    promptInput.style.height = 'auto';

    // Show thinking
    const thinkingEl = CR.appendThinking(container);

    // Reset streaming and activity state
    streamingEl = null;
    streamingText = '';
    activityLog = null;
    lastEntry = null;

    // Build history for Bedrock (exclude current message)
    const history = workMessages.slice(0, -1).map(m => ({
      role: m.role,
      content: [{ text: m.content }],
    }));

    try {
      const files = workFiles.getFiles();

      const response = await window.electronAPI.invoke('invoke-agent', {
        model,
        prompt: fullPrompt,
        conversationHistory: history,
        files,
        sessionId,
      });

      thinkingEl.remove();

      // Finish activity log
      CR.finishActivityLog(activityLog);

      // Remove any remaining legacy status messages
      container.querySelectorAll('.chat-status-message').forEach(el => el.remove());

      // If streaming didn't produce a bubble, create one from the response
      if (!streamingEl && response) {
        const assistantMsg = { role: 'assistant', content: response, timestamp: new Date().toISOString() };
        CR.appendChatMessage(container, assistantMsg, {
          onCopy: () => navigator.clipboard.writeText(response).then(
            () => showToast('Copied to clipboard', 'success'),
            () => showToast('Failed to copy', 'error')
          ),
        });
        workMessages.push(assistantMsg);
      } else if (streamingText) {
        workMessages.push({ role: 'assistant', content: streamingText, timestamp: new Date().toISOString() });
      }

      // Clear files after send
      if (files.length > 0) {
        workFiles.clearFiles();
      }

    } catch (error) {
      thinkingEl.remove();
      CR.finishActivityLog(activityLog);
      container.querySelectorAll('.chat-status-message').forEach(el => el.remove());
      CR.appendChatError(container, error.message);
      showToast(`Agent error: ${error.message}`, 'error');
    } finally {
      isProcessing = false;
    }
  }

  // Expose for initialization from index.js
  if (typeof window !== 'undefined') {
    window.WorkTab = { init };
  }
})();
