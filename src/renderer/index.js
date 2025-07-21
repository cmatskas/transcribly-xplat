const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const videoContainer = document.getElementById('videoContainer');
const videoPlayer = document.getElementById('videoPlayer');
const transcriptionContent = document.getElementById('transcriptionContent');
const loadingSpinner = document.getElementById('loadingSpinner');
const transcriptionText = document.getElementById('transcriptionText');
const templateSelect = document.getElementById('promptTemplateSelect');
let currentAnalysis = '';
//test

function showSuccessToast(message) {
    window.electronAPI.showToast(message, 'success');
}

function showErrorToast(message) {
    window.electronAPI.showToast(message, 'error');
}

function showInfoToast(message) {
    window.electronAPI.showToast(message, 'info');
}

function showWarningToast(message) {
    window.electronAPI.showToast(message, 'warning');
}

// Expose functions for testing
if (typeof window !== 'undefined') {
    window.showSuccessToast = showSuccessToast;
    window.showErrorToast = showErrorToast;
    window.showInfoToast = showInfoToast;
    window.showWarningToast = showWarningToast;
    window.showTranscribePage = showTranscribePage;
    window.showAnalyzePage = showAnalyzePage;
    window.downloadAnalysis = downloadAnalysis;
    window.copyAnalysis = copyAnalysis;
    window.uploadFile = uploadFile;
    window.loadKnowledgeBases = loadKnowledgeBases;
    window.simpleCitationParser = simpleCitationParser;
    window.formatText = formatText;
    window.cleanupAnalysisText = cleanupAnalysisText;
    window.openCredentialsWindow = openCredentialsWindow;
    window.checkConnectionStatus = checkConnectionStatus;
    
    // Expose currentAnalysis as a getter/setter to keep it synchronized
    Object.defineProperty(window, 'currentAnalysis', {
        get: () => currentAnalysis,
        set: (value) => { currentAnalysis = value; },
        configurable: true
    });
}

function showTranscribePage() {
    document.getElementById('transcribe-page').style.display = 'block';
    document.getElementById('nav-transcribe').classList.add('active');

    document.getElementById('analyze-page').style.display = 'none';
    document.getElementById('nav-analyze').classList.remove('active');
    // Hide other pages as needed
}

function showAnalyzePage() {
    document.getElementById('transcribe-page').style.display = 'none';
    document.getElementById('nav-transcribe').classList.remove('active');

    document.getElementById('analyze-page').style.display = 'block';
    document.getElementById('nav-analyze').classList.add('active');
}

function downloadAnalysis() {
    if (!currentAnalysis) {
        showWarningToast('No analysis available to download');
        return;
    }

    // Create a Blob with the analysis text
    const analysisText = cleanupAnalysisText(currentAnalysis);
    const blob = new Blob([analysisText], { type: 'text/plain' });

    // Create a download link
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'analysis_results.txt'; // Default file name
    link.click();

    // Clean up
    URL.revokeObjectURL(link.href);

    // Show success toast
    showSuccessToast('Analysis downloaded successfully');
}

function copyAnalysis() {
    if (!currentAnalysis) {
        showWarningToast('No analysis available to copy');
        return Promise.resolve();
    }

    const analysisText = cleanupAnalysisText(currentAnalysis);

    return navigator.clipboard.writeText(analysisText)
        .then(() => {
            // Show success toast
            showSuccessToast('Analysis copied to clipboard');

            // Optional: Show a brief success message
            const copyBtn = document.querySelector('.header-button');
            if (copyBtn) {
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                }, 2000);
            }
        })
        .catch(err => {
            console.error('Failed to copy text:', err);
            showErrorToast('Failed to copy to clipboard');
        });
}

document.getElementById('nav-analyze').addEventListener('click', showAnalyzePage);
document.getElementById('nav-transcribe').addEventListener('click', showTranscribePage);
document.getElementById('nav-credentials').addEventListener('click', openCredentialsWindow);
document.getElementById('nav-connection-status').addEventListener('click', checkConnectionStatus);

templateSelect.addEventListener('change', () => {
    const selectedOption = templateSelect.options[templateSelect.selectedIndex];
    const selectedPrompt = selectedOption.getAttribute('value');
    const promptInput = document.getElementById('promptEditor');
    promptInput.value = selectedPrompt;
});

// Add this to handle the checkbox toggle
document.getElementById('useKnowledgeBase').addEventListener('change', async () => {
    await loadKnowledgeBases();
});

// Store the knowledge base selection
document.getElementById('knowledgeBaseSelect').addEventListener('change', function () {
    const selectedKnowledgeBaseId = this.value;
    localStorage.setItem('selectedKnowledgeBaseId', selectedKnowledgeBaseId);
    localStorage.setItem('useKnowledgeBase', 'true');
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // Show info toast when file is selected
        showInfoToast(`File selected: ${file.name}`);

        const mediaUrl = URL.createObjectURL(file);
        videoPlayer.src = mediaUrl;
        uploadZone.classList.add('d-none');
        videoContainer.classList.remove('d-none');
        uploadFile(file);

        // Match transcription height to video
        const updateTranscriptionHeight = () => {
            transcriptionContent.style.height = `${videoContainer.offsetHeight}px`;
        };
        updateTranscriptionHeight();
        window.addEventListener('resize', updateTranscriptionHeight);
    }
});

// Handle click to upload
uploadZone.addEventListener('click', () => fileInput.click());

// Handle drag and drop
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = '#3b82f6';
});

uploadZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = '#ccc';
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('video/') || file.type.startsWith('audio/'))) {
        fileInput.files = e.dataTransfer.files;
        const event = new Event('change');
        fileInput.dispatchEvent(event);
    } else {
        showErrorToast('Please upload a valid video or audio file');
    }
});

async function uploadFile(file) {
    try {
        // Show loading state
        loadingSpinner.style.display = 'flex';
        transcriptionText.style.display = 'none';

        // Show info toast when starting transcription
        showInfoToast('Starting transcription process...');

        const formData = new FormData();
        formData.append('mediaFile', file);

        // Step 1: Start the transcription job
        const startResponse = await fetch('api/transcribe/start', {
            method: 'POST',
            body: formData
        });

        if (!startResponse.ok) {
            throw new Error(`HTTP error! status: ${startResponse.status}`);
        }

        const jobData = await startResponse.json();
        const jobId = jobData.jobId; // The server should return a job ID

        // Step 2: Poll for results with exponential backoff
        let pollInterval = 2000; // Start with 2 seconds
        const maxPollInterval = 10000; // Max interval of 10 seconds
        const maxAttempts = 90; // ~15 minutes max at varying intervals
        let attempts = 0;

        // Update the UI to show polling status
        const updateStatus = (message) => {
            console.info(message);
        };

        // Function to poll for transcription results
        const pollForResults = async () => {
            try {
                attempts++;
                updateStatus(`Checking transcription status... (Attempt ${attempts})`);

                const pollResponse = await fetch(`/api/transcribe/status/${jobId}`);

                if (!pollResponse.ok) {
                    throw new Error(`HTTP error! status: ${pollResponse.status}`);
                }

                const pollData = await pollResponse.json();

                if (pollData.status === 'completed') {
                    // Transcription is done - show success notification
                    showSuccessToast('Transcription completed successfully!');

                    // Display the transcript
                    displayTranscript(pollData.data);

                    // If full view is selected, perform analysis
                    if (document.querySelector('input[name="viewMode"]:checked').value === 'full') {
                        await analyzeTranscript(pollData.data);
                    }

                    return; // Exit the polling loop
                } else if (pollData.status === 'failed') {
                    // Show error notification
                    showErrorToast(`Transcription failed: ${pollData.error || 'Unknown error'}`);
                    throw new Error(pollData.error || 'Transcription failed');
                } else if (attempts >= maxAttempts) {
                    // Show timeout notification
                    showErrorToast('Transcription timed out. Please try again with a smaller file.');
                    throw new Error('Maximum polling attempts reached');
                } else {
                    // Still in progress, continue polling with exponential backoff
                    pollInterval = Math.min(pollInterval * 1.5, maxPollInterval);

                    // Every 10 attempts, show an info toast to keep user updated
                    if (attempts % 10 === 0) {
                        showInfoToast(`Transcription in progress... (${Math.round(attempts / 6)} minute(s) elapsed)`);
                    }

                    updateStatus(`Transcription in progress... (${Math.round(attempts / 6)} minute(s) elapsed)`);
                    setTimeout(pollForResults, pollInterval);
                }
            } catch (error) {
                console.error('Polling failed:', error);
                showErrorToast(`Error checking transcription status: ${error.message}`);
                transcriptionText.textContent = `Error checking transcription status: ${error.message}`;
                transcriptionText.style.display = 'block';
            }
        };

        // Start polling
        setTimeout(pollForResults, 1000); // Start first poll after 1 second

    } catch (error) {
        console.error('Upload failed:', error);

        // Provide more helpful error message based on error type
        if (error.name === 'AbortError') {
            showErrorToast('The transcription request was aborted. Please try with a smaller file.');
            transcriptionText.textContent = 'The transcription request was aborted. Please try with a smaller file or try again later.';
        } else {
            showErrorToast(`Error uploading file: ${error.message}`);
            transcriptionText.textContent = `Error uploading file: ${error.message}`;
        }

        transcriptionText.style.display = 'block';
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

// Handle prompt submission
document.getElementById('invokeBedrockBtn').addEventListener('click', async () => {
    const model = document.getElementById('modelSelect').value;
    const prompt = document.getElementById('promptEditor').value;
    const responseArea = document.getElementById('analysisText');
    const useKnowledgeBase = document.getElementById('useKnowledgeBase').checked;

    // Check if prompt is empty
    if (!prompt) {
        showErrorToast('Please enter a prompt');
        return;
    }

    // Get knowledge base ID if checkbox is checked
    let knowledgeBaseId = null;
    if (useKnowledgeBase) {
        const knowledgeBaseSelect = document.getElementById('knowledgeBaseSelect');
        knowledgeBaseId = knowledgeBaseSelect.value;

        // Check if a valid knowledge base is selected (not the placeholder)
        if (!knowledgeBaseId || knowledgeBaseSelect.selectedIndex === 0) {
            knowledgeBaseId = null;
        }
    }

    if (useKnowledgeBase && !knowledgeBaseId) {
        showErrorToast('Please select a knowledge base or uncheck the "Use Knowledge Base" checkbox');
        return;
    }

    try {
        // Show the processing modal
        const modal = new bootstrap.Modal(document.getElementById('bedrockProcessingModal'));
        modal.show();

        // Pass the knowledge base ID to the backend
        const response = await window.electronAPI.invoke('send-to-bedrock', {
            model,
            prompt,
            knowledgeBaseId
        });
        
        // Hide the modal
        modal.hide();
        
        if (useKnowledgeBase) {
            responseArea.innerHTML = simpleCitationParser(response);
        }
        else {
            responseArea.innerHTML = response;
        }
        currentAnalysis = response;
        // Also update window.currentAnalysis if it exists
        if (typeof window !== 'undefined' && window.currentAnalysis !== undefined) {
            window.currentAnalysis = response;
        }
        
        // Show success toast
        showSuccessToast('Bedrock analysis completed successfully!');
        
    } catch (error) {
        // Hide the modal in case of error
        const modal = bootstrap.Modal.getInstance(document.getElementById('bedrockProcessingModal'));
        if (modal) {
            modal.hide();
        }
        
        responseArea.innerHTML = `Error: ${error.message}`;
        showErrorToast(`Bedrock analysis failed: ${error.message}`);
    }
});

/*
// Handle transcription
document.getElementById('transcribeButton').addEventListener('click', async () => {
    const mediaFile = document.getElementById('mediaFile').files[0];
    const transcriptionArea = document.getElementById('transcriptionResult');

    if (!mediaFile) {
        alert('Please select a media file first');
        return;
    }

    transcriptionArea.innerHTML = 'Starting transcription...';
    try {
        const response = await ipcRenderer.invoke('transcribe-media', {
            filePath: mediaFile.path
        });
        transcriptionArea.innerHTML = response;
    } catch (error) {
        transcriptionArea.innerHTML = `Error: ${error.message}`;
    }
});
*/

// Load available Bedrock models on startup
async function loadBedrockModels() {
    try {
        // Get models from config instead of API call
        const bedrockModels = await window.electronAPI.invoke('get-bedrock-models');
        const modelSelect = document.getElementById('modelSelect');
        modelSelect.innerHTML = '';

        bedrockModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.inferenceArn;
            option.text = model.id;
            modelSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading Bedrock models:', error);
    }
}

async function loadPromptTemplates() {
    try {
        const templates = await window.electronAPI.invoke('get-prompt-templates');
        templateSelect.innerHTML = '';

        //add a default option
        const option = document.createElement('option');
        option.value = '';
        option.text = 'Select a prompt template or write a custom one';
        option.disabled = true;
        option.selected = true;
        templateSelect.appendChild(option);

        templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.prompt;
            option.text = template.id;
            templateSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading prompt templates:', error);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    showInfoToast('Welcome to Transcribely! Upload a video or audio file to get started.');
    loadPromptTemplates();
    loadBedrockModels();
});

// Function to load knowledge bases
async function loadKnowledgeBases() {
    try {
        let knowledgeBases = localStorage.getItem('knowledgeBases');
        if (knowledgeBases === null) {
            knowledgeBases = await window.electronAPI.invoke('get-knowledge-bases');
            localStorage.setItem('knowledgeBases', JSON.stringify(knowledgeBases));
        }
        else {
            knowledgeBases = JSON.parse(knowledgeBases);
        }

        const knowledgeBaseSelect = document.getElementById('knowledgeBaseSelect');

        // Clear existing options except the first one (placeholder)
        while (knowledgeBaseSelect.options.length > 1) {
            knowledgeBaseSelect.remove(1);
        }

        // Add knowledge bases to the dropdown
        knowledgeBases.forEach(kb => {
            const option = document.createElement('option');
            option.value = kb.id;
            option.textContent = kb.name;
            option.title = kb.description || '';
            knowledgeBaseSelect.appendChild(option);
        });

        const useKnowledgeBaseCheckbox = document.getElementById('useKnowledgeBase');
        if (useKnowledgeBaseCheckbox.checked) {
            document.getElementById('useKnowledgeBase').checked = true;
            document.getElementById('knowledgeBaseSection').style.display = 'block';
        }
        else {
            document.getElementById('useKnowledgeBase').checked = false;
            document.getElementById('knowledgeBaseSection').style.display = 'none';
        }

        showSuccessToast('Knowledge bases loaded successfully');
    } catch (error) {
        console.error('Error loading knowledge bases:', error);
        showErrorToast('Failed to load knowledge bases: ' + error.message);
    }
}

function simpleCitationParser(responseData) {
    // Check if we have valid data
    if (!responseData || !responseData.citations || !Array.isArray(responseData.citations)) {
        return '<div class="error">No citation data found</div>';
    }

    let htmlOutput = '';

    // Loop through each citation
    responseData.citations.forEach((citation, index) => {
        // Extract the text content if available
        let citationText = '';
        if (citation.generatedResponsePart &&
            citation.generatedResponsePart.textResponsePart &&
            citation.generatedResponsePart.textResponsePart.text) {
            citationText = citation.generatedResponsePart.textResponsePart.text;
        }

        // Skip if no text content
        if (!citationText) return;

        // Start building the citation block
        htmlOutput += `<div class="citation-item">`;

        // Add the citation text
        htmlOutput += `<div class="citation-content">${formatText(citationText)}</div>`;

        // Add citation sources if available
        if (citation.retrievedReferences && Array.isArray(citation.retrievedReferences)) {
            htmlOutput += `<div class="citation-sources">`;

            citation.retrievedReferences.forEach(reference => {
                if (reference.location && reference.location.s3Location) {
                    const sourceUrl = reference.location.s3Location;
                    const fileName = sourceUrl.uri.split('/').pop();

                    htmlOutput += `<a href="${sourceUrl}" class="source-link" title="${sourceUrl}">`;
                    htmlOutput += `[Source: ${fileName}]`;
                    htmlOutput += `</a>`;
                }
            });

            htmlOutput += `</div>`;
        }

        htmlOutput += `</div>`;
    });

    // If no content was processed, show a message
    if (!htmlOutput) {
        return '<div class="no-data">No citation content found in the data</div>';
    }

    return htmlOutput;
}

function formatText(text) {
    // Handle bold markdown
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Handle line breaks
    text = text.replace(/\n/g, '<br>');

    return text;
}

function cleanupAnalysisText(text) {
    // Replace erroneous /\n/g pattern
    let cleaned = text.replace('/\\n/g', '\n');

    // Replace <br> tags with newlines
    cleaned = cleaned.replace(/<br>/g, '\n');

    // Fix multiple consecutive newlines to maximum of two
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Ensure proper spacing after numbered list items
    cleaned = cleaned.replace(/(\d+\.) (?=\*\*)/g, '$1\n');

    // Add proper spacing for bullet points
    cleaned = cleaned.replace(/(\n\s*)-\s+/g, '\n   - ');

    return cleaned;
}

// Credentials management functions
async function openCredentialsWindow() {
    try {
        showInfoToast('Opening credentials management...');
        await window.electronAPI.invoke('open-credentials-window');
    } catch (error) {
        console.error('Error opening credentials window:', error);
        showErrorToast(`Failed to open credentials window: ${error.message}`);
    }
}

async function checkConnectionStatus() {
    try {
        showInfoToast('Checking AWS connection status...');
        
        const hasCredentials = await window.electronAPI.invoke('has-credentials');
        
        if (!hasCredentials) {
            showWarningToast('No AWS credentials configured. Please set up your credentials first.');
            return;
        }

        const validation = await window.electronAPI.invoke('validate-credentials');
        
        if (validation.valid) {
            let statusMessage = `Connected to AWS Account: ${validation.identity.account}`;
            
            if (validation.permissions.bedrock && validation.permissions.transcribe) {
                statusMessage += '\n All required permissions available';
                showSuccessToast(statusMessage);
            } else {
                statusMessage += '\n⚠️ Some permissions missing:';
                if (!validation.permissions.bedrock) statusMessage += '\n Bedrock access denied';
                if (!validation.permissions.transcribe) statusMessage += '\n Transcribe access denied';
                showWarningToast(statusMessage);
            }
            
            if (validation.errors.length > 0) {
                console.warn('Permission errors:', validation.errors);
            }
        } else {
            showErrorToast(` AWS connection failed: ${validation.errors.join(', ')}`);
        }
        
    } catch (error) {
        console.error('Error checking connection status:', error);
        showErrorToast(`Failed to check connection: ${error.message}`);
    }
}
