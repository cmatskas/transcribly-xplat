/**
 * Shared chat rendering utilities.
 * All functions take a container element as parameter — no hardcoded IDs.
 */

function formatText(text) {
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
      ${copyBtn}
      ${formatText(msg.content)}
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

// Export for both browser and test environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatText, cleanupAnalysisText, appendChatMessage, appendThinking,
    appendChatError, appendStatusMessage, showPlaceholder, renderChatHistory,
  };
}
if (typeof window !== 'undefined') {
  window.ChatRenderer = {
    formatText, cleanupAnalysisText, appendChatMessage, appendThinking,
    appendChatError, appendStatusMessage, showPlaceholder, renderChatHistory,
  };
}
