const { contextBridge, ipcRenderer } = require('electron');
const Toastify = require('toastify-js');
const { marked } = require('marked');

// Configure marked for safe rendering
marked.setOptions({ breaks: true, gfm: true });

contextBridge.exposeInMainWorld('marked', { parse: (md) => marked.parse(md) });

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
            gravity: "top", // Position top
            position: "center", // Center it
            className: types[type] || '',
            stopOnFocus: true, // Stop timer on hover
            offset: { y: 80 }, // Position it just below the header banner
            style: {
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "500",
                padding: "12px 20px"
            },
            onClick: function(){} // Callback after click
        }).showToast();
    }, 
    send: (channel, data) => {
        ipcRenderer.send(channel, data);
    },
    receive: (channel, func) => {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
    invoke: (channel, data) => {
        return ipcRenderer.invoke(channel, data);
    },
    invokeAsync: async (channel, data) => {
        return await ipcRenderer.invoke(channel, data);
    }
});