// Credentials page renderer script

function showSuccessToast(message) {
    Toastify({
        text: message,
        duration: 4000,
        gravity: "top",
        position: "right",
        className: "toast-success",
        stopOnFocus: true
    }).showToast();
}

function showErrorToast(message) {
    Toastify({
        text: message,
        duration: 6000,
        gravity: "top",
        position: "right",
        className: "toast-error",
        stopOnFocus: true
    }).showToast();
}

function showInfoToast(message) {
    Toastify({
        text: message,
        duration: 3000,
        gravity: "top",
        position: "right",
        className: "toast-info",
        stopOnFocus: true
    }).showToast();
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize theme first
    if (window.themeManager) {
        await window.themeManager.initializeFromSettings();
    }
    
    // Check if credentials already exist
    const hasCredentials = await window.electronAPI.invoke('has-credentials');
    if (hasCredentials) {
        await loadExistingCredentials();
    }

    // Add paste event listeners to detect credential pasting
    setupPasteDetection();
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

        // Validate required fields
        if (!credentials.accessKeyId || !credentials.secretAccessKey || !credentials.region) {
            throw new Error('Please fill in all required fields');
        }

        // Save credentials
        await window.electronAPI.invoke('save-credentials', credentials);

        // Test the connection
        await testConnection();

        showSuccessToast('Credentials saved successfully!');

    } catch (error) {
        console.error('Error saving credentials:', error);
        showErrorToast(`Error: ${error.message}`);
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
        const result = await window.electronAPI.invoke('validate-credentials');

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
            statusHtml += `<div class="d-flex align-items-center mb-1">
                <i class="bi bi-${result.permissions.transcribe ? 'check-circle text-success' : 'x-circle text-danger'} me-2"></i>
                <span>Transcribe Access</span>
            </div>`;
            statusHtml += `<div class="d-flex align-items-center">
                <i class="bi bi-${result.permissions.s3 ? 'check-circle text-success' : 'x-circle text-danger'} me-2"></i>
                <span>S3 Access</span>
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

            // Show continue button if all services work
            if (result.permissions.bedrock && result.permissions.transcribe && result.permissions.s3) {
                document.getElementById('continueBtn').style.display = 'block';
            }

        } else {
            statusHtml += `
                <div class="d-flex align-items-center mb-2">
                    <span class="badge bg-danger status-badge me-2">Failed</span>
                    <small class="text-muted">Connection failed</small>
                </div>
            `;

            if (result.errors.length > 0) {
                statusHtml += '<div class="mt-2">';
                result.errors.forEach(error => {
                    statusHtml += `<div class="text-danger small"><i class="bi bi-exclamation-triangle me-1"></i>${error}</div>`;
                });
                statusHtml += '</div>';
            }
        }

        connectionStatus.innerHTML = statusHtml;

    } catch (error) {
        console.error('Error testing connection:', error);
        connectionStatus.innerHTML = `
            <div class="d-flex align-items-center mb-2">
                <span class="badge bg-danger status-badge me-2">Error</span>
                <small class="text-muted">Test failed</small>
            </div>
            <div class="text-danger small">
                <i class="bi bi-exclamation-triangle me-1"></i>${error.message}
            </div>
        `;
    }
}

async function loadExistingCredentials() {
    try {
        const credentials = await window.electronAPI.invoke('load-credentials');
        if (credentials) {
            document.getElementById('accessKeyId').value = credentials.accessKeyId || '';
            document.getElementById('secretAccessKey').value = credentials.secretAccessKey || '';
            document.getElementById('region').value = credentials.region || 'us-east-1';
            document.getElementById('sessionToken').value = credentials.sessionToken || '';
            document.getElementById('profileName').value = credentials.profileName || 'default';

            showInfoToast('Existing credentials loaded');
            
            // Auto-test the loaded credentials
            await testConnection();
        }
    } catch (error) {
        console.error('Error loading existing credentials:', error);
        showErrorToast('Failed to load existing credentials');
    }
}

function continueToApp() {
    window.electronAPI.invoke('navigate-to-main');
}

// Paste detection and credential parsing functionality
function setupPasteDetection() {
    // Add paste event listeners to all input fields
    const inputFields = ['accessKeyId', 'secretAccessKey', 'sessionToken'];
    
    inputFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('paste', handlePaste);
        }
    });

    // Also add a global paste listener for the form
    document.getElementById('credentialsForm').addEventListener('paste', handlePaste);
}

function handlePaste(event) {
    // Get the pasted text
    const pastedText = (event.clipboardData || window.clipboardData).getData('text');
    
    // Check if the pasted text contains AWS credentials in batch format
    if (isAwsCredentialFormat(pastedText)) {
        event.preventDefault(); // Prevent default paste behavior
        
        const credentials = parseAwsCredentials(pastedText);
        if (credentials) {
            populateCredentialFields(credentials);
            showSuccessToast('AWS credentials detected and populated automatically!');
        }
    }
}

function isAwsCredentialFormat(text) {
    // Check for Windows batch format (set AWS_ACCESS_KEY_ID=...)
    const hasBatchFormat = /set\s+AWS_ACCESS_KEY_ID\s*=\s*[A-Z0-9]+/i.test(text) && 
                          /set\s+AWS_SECRET_ACCESS_KEY\s*=\s*[A-Za-z0-9+/=]+/i.test(text);
    
    // Check for export format (export AWS_ACCESS_KEY_ID=...)
    const hasExportFormat = /export\s+AWS_ACCESS_KEY_ID\s*=\s*[A-Z0-9]+/i.test(text) && 
                           /export\s+AWS_SECRET_ACCESS_KEY\s*=\s*[A-Za-z0-9+/=]+/i.test(text);
    
    // Check for simple assignment format (AWS_ACCESS_KEY_ID=...)
    const hasSimpleFormat = /AWS_ACCESS_KEY_ID\s*=\s*[A-Z0-9]+/i.test(text) && 
                           /AWS_SECRET_ACCESS_KEY\s*=\s*[A-Za-z0-9+/=]+/i.test(text);
    
    return hasBatchFormat || hasExportFormat || hasSimpleFormat;
}

function parseAwsCredentials(text) {
    const credentials = {};
    
    try {
        // Parse Access Key ID - support multiple formats
        let accessKeyMatch = text.match(/(?:set\s+|export\s+|^|\s)AWS_ACCESS_KEY_ID\s*=\s*([A-Z0-9]+)/im);
        if (accessKeyMatch) {
            credentials.accessKeyId = accessKeyMatch[1].trim();
        }
        
        // Parse Secret Access Key - support multiple formats
        let secretKeyMatch = text.match(/(?:set\s+|export\s+|^|\s)AWS_SECRET_ACCESS_KEY\s*=\s*([A-Za-z0-9+/=]+)/im);
        if (secretKeyMatch) {
            credentials.secretAccessKey = secretKeyMatch[1].trim();
        }
        
        // Parse Session Token (optional) - support multiple formats
        let sessionTokenMatch = text.match(/(?:set\s+|export\s+|^|\s)AWS_SESSION_TOKEN\s*=\s*([A-Za-z0-9+/=]+)/im);
        if (sessionTokenMatch) {
            credentials.sessionToken = sessionTokenMatch[1].trim();
        }
        
        // Parse Region (optional) - support multiple formats
        let regionMatch = text.match(/(?:set\s+|export\s+|^|\s)AWS_(?:DEFAULT_)?REGION\s*=\s*([a-z0-9-]+)/im);
        if (regionMatch) {
            credentials.region = regionMatch[1].trim();
        }
        
        return credentials;
    } catch (error) {
        console.error('Error parsing AWS credentials:', error);
        showErrorToast('Failed to parse pasted credentials');
        return null;
    }
}

function populateCredentialFields(credentials) {
    // Populate Access Key ID
    if (credentials.accessKeyId) {
        document.getElementById('accessKeyId').value = credentials.accessKeyId;
    }
    
    // Populate Secret Access Key
    if (credentials.secretAccessKey) {
        document.getElementById('secretAccessKey').value = credentials.secretAccessKey;
    }
    
    // Populate Session Token if present
    if (credentials.sessionToken) {
        document.getElementById('sessionToken').value = credentials.sessionToken;
    }
    
    // Populate Region if present and valid
    if (credentials.region) {
        const regionSelect = document.getElementById('region');
        const regionOption = Array.from(regionSelect.options).find(option => 
            option.value === credentials.region
        );
        if (regionOption) {
            regionSelect.value = credentials.region;
        }
    }
    
    // Add visual feedback to show fields were populated
    const populatedFields = ['accessKeyId', 'secretAccessKey'];
    if (credentials.sessionToken) populatedFields.push('sessionToken');
    
    populatedFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field && field.value) {
            // Add a temporary highlight effect
            field.classList.add('border-success');
            setTimeout(() => {
                field.classList.remove('border-success');
            }, 2000);
        }
    });
}

// Manual paste credentials function for the button
async function pasteCredentialsFromClipboard() {
    try {
        // Use the Clipboard API if available
        if (navigator.clipboard && navigator.clipboard.readText) {
            const clipboardText = await navigator.clipboard.readText();
            
            if (isAwsCredentialFormat(clipboardText)) {
                const credentials = parseAwsCredentials(clipboardText);
                if (credentials) {
                    populateCredentialFields(credentials);
                    showSuccessToast('AWS credentials pasted and populated successfully!');
                } else {
                    showErrorToast('Failed to parse credentials from clipboard');
                }
            } else {
                showInfoToast('No AWS credentials found in clipboard. Please copy credentials in the format: set AWS_ACCESS_KEY_ID=...');
            }
        } else {
            // Fallback: show instructions for manual paste
            showInfoToast('Please paste your AWS credentials directly into any field. The app will auto-detect and populate all fields.');
        }
    } catch (error) {
        console.error('Error reading clipboard:', error);
        showInfoToast('Please paste your AWS credentials directly into any field. The app will auto-detect and populate all fields.');
    }
}
