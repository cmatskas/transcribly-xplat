/**
 * Shared chat rendering utilities.
 * All functions take a container element as parameter — no hardcoded IDs.
 */

function formatText(text) {
  if (typeof window !== 'undefined' && window.marked) {
    return window.marked.parse(text);
  }
  // Fallback for tests or non-browser
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\n/g, '<br>');
  return text;
}

function cleanupAnalysisText(text) {
  let cleaned = text.replace('/\\n/g', '\n');
  cleaned = cleaned.replace(/<br>/g, '\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/(\d+\.) (?=\*\*)/g, '$1\n');
  cleaned = cleaned.replace(/(\n\s*)-\s+/g, '\n   - ');
  return cleaned;
}

function appendChatMessage(container, msg, { onCopy } = {}) {
  const el = document.createElement('div');
  el.className = `chat-message ${msg.role}`;
  const time = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const copyBtn = msg.role === 'assistant'
    ? '<button class="chat-copy-btn" title="Copy response"><i class="bi bi-clipboard"></i></button>'
    : '';

  el.innerHTML = `
    <div class="chat-bubble">
      <div class="chat-bubble-content">${formatText(msg.content)}</div>${copyBtn}
    </div>
    <div class="chat-message-time">${time}</div>`;

  if (msg.role === 'assistant') {
    el.querySelector('.chat-copy-btn').addEventListener('click', () => {
      if (onCopy) onCopy(msg.content);
    });
  }

  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return el;
}

function appendThinking(container) {
  const el = document.createElement('div');
  el.className = 'chat-thinking';
  el.innerHTML = '<span></span><span></span><span></span>';
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return el;
}

function appendChatError(container, message) {
  const el = document.createElement('div');
  el.className = 'chat-message assistant';
  el.innerHTML = `<div class="chat-bubble" style="background:var(--error);color:#fff;">
    <i class="bi bi-exclamation-triangle me-1"></i>${message}</div>`;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

// ── Activity Log (timeline) ──────────────────────────────────

const TOOL_META = {
  'activate_skill':    { icon: '🎯', label: 'Loaded skill' },
  'execute_code':      { icon: '⟩_', label: 'Running code' },
  'save_file_locally': { icon: '💾', label: 'Saving file' },
  'read_local_file':   { icon: '📄', label: 'Reading file' },
  'generate_image':    { icon: '🎨', label: 'Generating image' },
  'web':               { icon: '🌐', label: 'Web' },
  'memory':            { icon: '🧠', label: 'Memory' },
  'sandbox':           { icon: '📦', label: 'Sandbox' },
  'cleanup':           { icon: '🧹', label: 'Cleanup' },
};

function createActivityLog(container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'activity-log';
  wrapper.innerHTML = `
    <div class="activity-header">
      <span class="activity-header-text">Working...</span>
      <span class="activity-counter"></span>
      <button class="activity-toggle" title="Toggle details"><i class="bi bi-chevron-down"></i></button>
    </div>
    <div class="activity-timeline"></div>`;

  wrapper.querySelector('.activity-toggle').addEventListener('click', () => {
    wrapper.classList.toggle('collapsed');
    const icon = wrapper.querySelector('.activity-toggle i');
    icon.className = wrapper.classList.contains('collapsed') ? 'bi bi-chevron-right' : 'bi bi-chevron-down';
  });

  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;
  return wrapper;
}

function addActivityEntry(logEl, { tool, detail, state = 'running' }) {
  const timeline = logEl.querySelector('.activity-timeline');
  const meta = TOOL_META[tool] || { icon: '⚙️', label: tool };
  const detailText = detail ? `<span class="activity-detail">${detail}</span>` : '';

  const entry = document.createElement('div');
  entry.className = `activity-entry ${state}`;
  entry.dataset.tool = tool;
  entry.innerHTML = `
    <span class="activity-dot"></span>
    <span class="activity-icon">${meta.icon}</span>
    <span class="activity-label">${meta.label}</span>
    ${detailText}`;

  timeline.appendChild(entry);

  // Update counter
  const count = timeline.querySelectorAll('.activity-entry').length;
  logEl.querySelector('.activity-counter').textContent = count;

  // Auto-scroll
  const container = logEl.closest('.chat-history');
  if (container) container.scrollTop = container.scrollHeight;

  return entry;
}

function completeActivityEntry(entry) {
  if (entry) {
    entry.classList.remove('running');
    entry.classList.add('done');
  }
}

function finishActivityLog(logEl) {
  if (!logEl) return;
  logEl.querySelector('.activity-header-text').textContent = 'Completed';
  logEl.classList.add('finished', 'collapsed');
  const icon = logEl.querySelector('.activity-toggle i');
  icon.className = 'bi bi-chevron-right';
  // Mark any remaining running entries as done
  logEl.querySelectorAll('.activity-entry.running').forEach(e => {
    e.classList.remove('running');
    e.classList.add('done');
  });
}

// ── Legacy compat ────────────────────────────────────────────

function appendStatusMessage(container, message) {
  const el = document.createElement('div');
  el.className = 'chat-status-message';
  el.innerHTML = `<i class="bi bi-gear-wide-connected me-1"></i>${message}`;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return el;
}

function showPlaceholder(container, text) {
  container.innerHTML = `<div class="chat-placeholder">
    <i class="bi bi-chat-dots fs-1 mb-3 d-block"></i>${text}</div>`;
}

function renderChatHistory(container, messages, opts) {
  container.innerHTML = '';
  if (!messages || messages.length === 0) {
    showPlaceholder(container, 'No messages yet');
    return;
  }
  messages.forEach(msg => appendChatMessage(container, msg, opts));
  container.scrollTop = container.scrollHeight;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatText, cleanupAnalysisText, appendChatMessage, appendThinking,
    appendChatError, appendStatusMessage, showPlaceholder, renderChatHistory,
    createActivityLog, addActivityEntry, completeActivityEntry, finishActivityLog,
  };
}
if (typeof window !== 'undefined') {
  window.ChatRenderer = {
    formatText, cleanupAnalysisText, appendChatMessage, appendThinking,
    appendChatError, appendStatusMessage, showPlaceholder, renderChatHistory,
    createActivityLog, addActivityEntry, completeActivityEntry, finishActivityLog,
  };
}
