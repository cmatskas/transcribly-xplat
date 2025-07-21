// Credentials page renderer script

document.addEventListener('DOMContentLoaded', async () => {
    // Check if credentials already exist
    const hasCredentials = await window.electronAPI.hasCredentials();
    if (hasCredentials) {
        await loadExistingCredentials();
    }
});

document.getElementById('credentialsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveCredentials();
});

async function saveCredentials() {
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.innerHTML;

    try {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving & Testing...';

        const credentials = {
            accessKeyId: document.getElementById('accessKeyId').value.trim(),
            secretAccessKey: document.getElementById('secretAccessKey').value.trim(),
            region: document.getElementById('region').value,
            sessionToken: document.getElementById('sessionToken').value.trim() || null,
            profileName: document.getElementById('profileName').value.trim() || 'default'
        };

        // Save credentials
        await window.electronAPI.saveCredentials(credentials);

        // Test the connection
        await testConnection();

        window.electronAPI.showToast('Credentials saved successfully!', 'success');

    } catch (error) {
        window.electronAPI.showToast(`Error: ${error.message}`, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

async function testConnection() {
    const statusCard = document.getElementById('statusCard');
    const connectionStatus = document.getElementById('connectionStatus');

    statusCard.style.display = 'block';
    connectionStatus.innerHTML = '<div class="spinner-border spinner-border-sm me-2"></div>Testing connection...';

    try {
        const result = await window.electronAPI.validateCredentials();

        let statusHtml = '';

        if (result.valid) {
            statusHtml += `
                <div class="d-flex align-items-center mb-2">
                    <span class="badge bg-success status-badge me-2">Connected</span>
                    <small class="text-muted">Account: ${result.identity.account}</small>
                </div>
            `;

            // Show permissions status
            statusHtml += '<div class="mt-2">';
            statusHtml += `<div class="d-flex align-items-center mb-1">
                <i class="bi bi-${result.permissions.bedrock ? 'check-circle text-success' : 'x-circle text-danger'} me-2"></i>
                <span>Bedrock Access</span>
            </div>`;
            statusHtml += `<div class="d-flex align-items-center">
                <i class="bi bi-${result.permissions.transcribe ? 'check-circle text-success' : 'x-circle text-danger'} me-2"></i>
                <span>Transcribe Access</span>
            </div>`;
            statusHtml += '</div>';

            // Show errors if any
            if (result.errors.length > 0) {
                statusHtml += '<div class="mt-2">';
                result.errors.forEach(error => {
                    statusHtml += `<div class="text-danger small"><i class="bi bi-exclamation-triangle me-1"></i>${error}</div>`;
                });
                statusHtml += '</div>';
            }

            // Show continue button if both services work
            if (result.permissions.bedrock && result.permissions.transcribe) {
                document.getElementById('continueBtn').style.display = 'block';
            }

        } else {
            statusHtml = `
                <div class="d-flex align-items-center">
                    <span class="badge bg-danger status-badge me-2">Failed</span>
                    <span class="text-danger">${result.errors.join(', ')}</span>
                </div>
            `;
        }

        connectionStatus.innerHTML = statusHtml;

    } catch (error) {
        connectionStatus.innerHTML = `
            <div class="d-flex align-items-center">
                <span class="badge bg-danger status-badge me-2">Error</span>
                <span class="text-danger">${error.message}</span>
            </div>
        `;
    }
}

async function loadExistingCredentials() {
    try {
        const credentials = await window.electronAPI.loadCredentials();
        if (credentials) {
            document.getElementById('accessKeyId').value = credentials.accessKeyId;
            document.getElementById('secretAccessKey').value = credentials.secretAccessKey;
            document.getElementById('region').value = credentials.region;
            document.getElementById('sessionToken').value = credentials.sessionToken || '';
            document.getElementById('profileName').value = credentials.profileName || 'default';

            // Test the loaded credentials
            await testConnection();
        }
    } catch (error) {
        window.electronAPI.showToast(`Error loading credentials: ${error.message}`, 'error');
    }
}

function continueToApp() {
    window.electronAPI.navigateToMain();
}