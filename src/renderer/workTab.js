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

    // Popover menu toggle
    attachBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      attachMenu.classList.toggle('open');
    });
    document.addEventListener('click', () => attachMenu.classList.remove('open'));

    // Attach files option
    document.getElementById('workAttachFiles').addEventListener('click', () => {
      attachMenu.classList.remove('open');
      document.getElementById('workFileUpload').click();
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

    // Listen for agent status updates
    window.electronAPI.receive('agent-status', (status) => {
      const container = getContainer();
      // Remove previous status message if any
      const prev = container.querySelector('.chat-status-message:last-child');
      if (prev) prev.remove();
      CR.appendStatusMessage(container, status);
    });

    // Listen for agent stream chunks
    window.electronAPI.receive('agent-stream-chunk', (chunk) => {
      updateStreamingBubble(chunk);
    });
  }

  let streamingEl = null;
  let streamingText = '';

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
    const copyBtn = bubble.querySelector('.chat-copy-btn');
    const copyHTML = copyBtn ? copyBtn.outerHTML : '';
    bubble.innerHTML = copyHTML + CR.formatText(streamingText);

    // Reattach copy listener
    const newCopyBtn = bubble.querySelector('.chat-copy-btn');
    if (newCopyBtn) {
      newCopyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(streamingText).then(
          () => showToast('Copied to clipboard', 'success'),
          () => showToast('Failed to copy', 'error')
        );
      });
    }

    container.scrollTop = container.scrollHeight;
  }

  async function sendWorkMessage() {
    if (isProcessing) return;

    const promptInput = document.getElementById('workPromptEditor');
    const model = document.getElementById('workModelSelect').value;
    const prompt = promptInput.value.trim();

    if (!prompt) {
      showToast('Please enter a message', 'error');
      return;
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

    // Show thinking
    const thinkingEl = CR.appendThinking(container);

    // Reset streaming state
    streamingEl = null;
    streamingText = '';

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
      });

      thinkingEl.remove();

      // Remove any remaining status messages
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
