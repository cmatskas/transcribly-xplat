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
      newChatBtn.addEventListener('click', startNewChat);
    }

    // Sidebar
    const sidebar = document.getElementById('workSidebar');
    const sidebarState = localStorage.getItem('sidebarOpen') === 'true';
    if (sidebarState) sidebar.classList.remove('collapsed');

    document.getElementById('workSidebarToggle').addEventListener('click', toggleSidebar);
    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
    document.getElementById('sidebarNewChat').addEventListener('click', startNewChat);

    refreshSidebar();

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

      // Auto-save session and refresh sidebar
      saveSession();
      refreshSidebar();

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

  // ── Sidebar & History ─────────────────────────────────────

  function toggleSidebar() {
    const sidebar = document.getElementById('workSidebar');
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebarOpen', !sidebar.classList.contains('collapsed'));
  }

  function startNewChat() {
    // Save current session before starting new one
    saveSession();
    if (workMessages.length > 0) {
      window.electronAPI.invoke('memory-extract', { sessionId }).catch(() => {});
    }
    sessionId = generateSessionId();
    workMessages = [];
    streamingEl = null;
    streamingText = '';
    activityLog = null;
    lastEntry = null;
    const container = getContainer();
    container.innerHTML = `
      <div id="workPlaceholder" class="work-greeting">
        <div class="work-greeting-icon"><img src="../assets/agentic-tool-icon-light.svg" alt="Agent" class="greeting-icon-img greeting-icon-light"><img src="../assets/agentic-tool-icon-dark.svg" alt="Agent" class="greeting-icon-img greeting-icon-dark"></div>
        <div class="work-greeting-text">What can I help you build today?</div>
      </div>`;
    refreshSidebar();
  }

  async function saveSession() {
    if (workMessages.length === 0) return;
    try {
      await window.electronAPI.invoke('work-history-save', {
        id: sessionId,
        messages: workMessages,
        createdAt: workMessages[0]?.timestamp || new Date().toISOString(),
      });
    } catch { /* non-critical */ }
  }

  async function refreshSidebar() {
    const list = document.getElementById('sidebarList');
    try {
      const sessions = await window.electronAPI.invoke('work-history-list');
      if (sessions.length === 0) {
        list.innerHTML = '<div class="sidebar-empty">No conversations yet</div>';
        return;
      }

      const starred = sessions.filter(s => s.starred);
      const unstarred = sessions.filter(s => !s.starred);
      const groups = groupByDate(unstarred);

      let html = '';
      if (starred.length > 0) {
        html += '<div class="sidebar-group-label">Starred</div>';
        html += starred.map(s => renderItem(s)).join('');
      }
      html += groups.map(g => `
        <div class="sidebar-group-label">${g.label}</div>
        ${g.items.map(s => renderItem(s)).join('')}
      `).join('');

      list.innerHTML = html;

      list.querySelectorAll('.sidebar-item').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('.sidebar-menu-btn')) return;
          loadSession(el.dataset.id);
        });
      });

      list.querySelectorAll('.sidebar-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          showContextMenu(e, btn.dataset.id, !!btn.dataset.starred);
        });
      });
    } catch { list.innerHTML = '<div class="sidebar-empty">Error loading history</div>'; }
  }

  function renderItem(s) {
    return `<div class="sidebar-item${s.id === sessionId ? ' active' : ''}" data-id="${s.id}">
      ${s.starred ? '<i class="bi bi-star-fill sidebar-item-star"></i>' : ''}
      <span class="sidebar-item-title">${escapeHtml(s.title || 'Untitled')}</span>
      <button class="sidebar-menu-btn" data-id="${s.id}" data-starred="${s.starred ? '1' : ''}" title="More"><i class="bi bi-three-dots"></i></button>
    </div>`;
  }

  // ── Context Menu ──────────────────────────────────────────
  let ctxTargetId = null;

  function showContextMenu(e, id, isStarred) {
    ctxTargetId = id;
    const menu = document.getElementById('sidebarContextMenu');
    const starBtn = menu.querySelector('[data-action="star"]');
    starBtn.innerHTML = isStarred
      ? '<i class="bi bi-star-fill"></i> <span>Unstar</span>'
      : '<i class="bi bi-star"></i> <span>Star</span>';
    menu.style.display = 'block';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    // Keep menu in viewport
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 8}px`;
      if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 8}px`;
    });
  }

  function hideContextMenu() {
    document.getElementById('sidebarContextMenu').style.display = 'none';
    ctxTargetId = null;
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.sidebar-context-menu')) hideContextMenu();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hideContextMenu(); hideRenameModal(); } });

  document.querySelectorAll('#sidebarContextMenu .ctx-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const id = ctxTargetId;
      hideContextMenu();
      if (!id) return;
      if (action === 'star') {
        await window.electronAPI.invoke('work-history-star', { id });
        refreshSidebar();
      } else if (action === 'rename') {
        showRenameModal(id);
      } else if (action === 'delete') {
        if (!confirm('Delete this conversation?')) return;
        await window.electronAPI.invoke('work-history-delete', { id });
        if (id === sessionId) startNewChat();
        else refreshSidebar();
      }
    });
  });

  // ── Rename Modal ──────────────────────────────────────────
  let renameTargetId = null;

  function showRenameModal(id) {
    renameTargetId = id;
    const item = document.querySelector(`.sidebar-item[data-id="${id}"] .sidebar-item-title`);
    const modal = document.getElementById('renameModal');
    const input = document.getElementById('renameInput');
    input.value = item ? item.textContent : '';
    modal.style.display = 'flex';
    input.focus();
    input.select();
  }

  function hideRenameModal() {
    document.getElementById('renameModal').style.display = 'none';
    renameTargetId = null;
  }

  document.getElementById('renameCancelBtn').addEventListener('click', hideRenameModal);
  document.getElementById('renameSaveBtn').addEventListener('click', async () => {
    const title = document.getElementById('renameInput').value.trim();
    if (title && renameTargetId) {
      await window.electronAPI.invoke('work-history-rename', { id: renameTargetId, title });
      refreshSidebar();
    }
    hideRenameModal();
  });
  document.getElementById('renameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('renameSaveBtn').click();
  });

  async function loadSession(id) {
    saveSession(); // save current first
    try {
      const session = await window.electronAPI.invoke('work-history-load', { id });
      sessionId = session.id;
      localStorage.setItem('workSessionId', sessionId);
      workMessages = session.messages || [];
      streamingEl = null;
      streamingText = '';
      activityLog = null;
      lastEntry = null;

      const container = getContainer();
      container.innerHTML = '';
      workMessages.forEach(msg => {
        CR.appendChatMessage(container, msg, {
          onCopy: () => navigator.clipboard.writeText(msg.content).then(
            () => showToast('Copied to clipboard', 'success'),
            () => showToast('Failed to copy', 'error')
          ),
        });
      });
      container.scrollTop = container.scrollHeight;
      refreshSidebar();
    } catch (err) {
      showToast(`Failed to load session: ${err.message}`, 'error');
    }
  }

  function groupByDate(sessions) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today - 86400000);
    const weekAgo = new Date(today - 7 * 86400000);

    const groups = { Today: [], Yesterday: [], 'This Week': [], Older: [] };
    for (const s of sessions) {
      const d = new Date(s.updatedAt);
      if (d >= today) groups.Today.push(s);
      else if (d >= yesterday) groups.Yesterday.push(s);
      else if (d >= weekAgo) groups['This Week'].push(s);
      else groups.Older.push(s);
    }
    return Object.entries(groups).filter(([, items]) => items.length > 0).map(([label, items]) => ({ label, items }));
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Trigger LTM extraction on app quit if there are messages in the current session
  window.electronAPI.receive('app-before-quit', () => {
    if (workMessages.length > 0) {
      window.electronAPI.invoke('memory-extract', { sessionId }).catch(() => {});
    }
  });

  // Expose for initialization from index.js
  if (typeof window !== 'undefined') {
    window.WorkTab = { init };
  }
})();
