const { contextBridge, ipcRenderer } = require('electron');
const Toastify = require('toastify-js');
const { marked } = require('marked');
const DOMPurify = require('dompurify');

// Configure marked for safe rendering
marked.setOptions({ breaks: true, gfm: true });

contextBridge.exposeInMainWorld('marked', { parse: (md) => DOMPurify.sanitize(marked.parse(md)) });

const ALLOWED_INVOKE_CHANNELS = new Set([
    'add-custom-prompt', 'compress-conversation', 'create-conversation', 'delete-conversation',
    'delete-credentials', 'delete-custom-prompt', 'delete-settings', 'get-app-version',
    'get-bedrock-models', 'get-custom-prompts', 'get-default-settings', 'get-knowledge-bases',
    'get-prompt-templates', 'get-skills', 'has-credentials', 'invoke-agent', 'list-conversations',
    'load-conversation', 'load-credentials', 'load-settings', 'memory-delete', 'memory-disable',
    'memory-enable', 'memory-extract', 'memory-status', 'navigate-to-main', 'open-skills-folder',
    'quick-validate-credentials', 'refresh-skills', 'save-conversation', 'save-credentials',
    'save-settings', 'select-directory', 'send-to-bedrock', 'toggle-skill', 'transcribe-media',
    'update-custom-prompt', 'validate-credentials', 'work-history-delete', 'work-history-list',
    'work-history-load', 'work-history-rename', 'work-history-save', 'work-history-star',
]);

const ALLOWED_RECEIVE_CHANNELS = new Set([
    'agent-status', 'agent-stream-chunk', 'bedrock-stream-chunk', 'bedrock-stream-complete',
    'transcription-progress', 'app-before-quit', 'show-settings',
]);

contextBridge.exposeInMainWorld('electronAPI', {
    showToast: (message, type) => {

        const types = {
            success: 'toast-success',
            error: 'toast-error',
            info: 'toast-info',
            warning: 'toast-warning'
        };
        
        Toastify({
            text: message,
            duration: 5000,
            close: true,
            gravity: "top",
            position: "center",
            className: types[type] || '',
            stopOnFocus: true,
            offset: { y: 80 },
            style: {
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "500",
                padding: "12px 20px"
            },
            onClick: function(){}
        }).showToast();
    }, 
    send: (channel, data) => {
        if (ALLOWED_INVOKE_CHANNELS.has(channel)) ipcRenderer.send(channel, data);
    },
    receive: (channel, func) => {
        if (ALLOWED_RECEIVE_CHANNELS.has(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    removeAllListeners: (channel) => {
        if (ALLOWED_RECEIVE_CHANNELS.has(channel)) ipcRenderer.removeAllListeners(channel);
    },
    invoke: (channel, data) => {
        if (!ALLOWED_INVOKE_CHANNELS.has(channel)) return Promise.reject(new Error(`Blocked IPC channel: ${channel}`));
        return ipcRenderer.invoke(channel, data);
    },
    invokeAsync: async (channel, data) => {
        if (!ALLOWED_INVOKE_CHANNELS.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`);
        return await ipcRenderer.invoke(channel, data);
    }
});