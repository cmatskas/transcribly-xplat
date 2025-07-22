const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const videoContainer = document.getElementById('videoContainer');
const videoPlayer = document.getElementById('videoPlayer');
const transcriptionContent = document.getElementById('transcriptionContent');
const transcriptionText = document.getElementById('transcriptionText');
const templateSelect = document.getElementById('promptTemplateSelect');
let currentAnalysis = '';
let currentTranscript = [];

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

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', async function () {
    if (window.themeManager) {
        await window.themeManager.initializeFromSettings();
        setupThemeToggle();
    }
});

// Theme toggle functionality
function setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');

    if (!themeToggle || !themeIcon) return;

    // Update icon based on current theme
    function updateThemeIcon() {
        const effectiveTheme = window.themeManager.getEffectiveTheme();
        const userPreference = window.themeManager.getUserPreference();

        if (userPreference === 'auto') {
            themeIcon.className = 'bi bi-circle-half';
            themeToggle.title = `Auto Theme (Currently ${effectiveTheme})`;
        } else if (effectiveTheme === 'dark') {
            themeIcon.className = 'bi bi-sun-fill';
            themeToggle.title = 'Switch to Light Theme';
        } else {
            themeIcon.className = 'bi bi-moon-fill';
            themeToggle.title = 'Switch to Dark Theme';
        }
    }

    // Cycle through themes: light -> dark -> auto -> light
    themeToggle.addEventListener('click', async () => {
        const currentPreference = window.themeManager.getUserPreference();
        let nextTheme;

        switch (currentPreference) {
            case 'light':
                nextTheme = 'dark';
                break;
            case 'dark':
                nextTheme = 'auto';
                break;
            case 'auto':
            default:
                nextTheme = 'light';
                break;
        }

        try {
            await window.themeManager.saveThemePreference(nextTheme);
            updateThemeIcon();
            showInfoToast(`Theme switched to ${nextTheme === 'auto' ? 'auto (system)' : nextTheme}`);
        } catch (error) {
            showErrorToast('Failed to save theme preference');
        }
    });

    // Listen for theme changes
    window.addEventListener('themeChanged', updateThemeIcon);

    // Initial icon update
    updateThemeIcon();
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
    window.downloadTranscript = downloadTranscript;
    window.copyTranscript = copyTranscript;
    window.clearTranscription = clearTranscription;

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
document.getElementById('nav-app-settings').addEventListener('click', openSettingsWindow);
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

// Handle the use existing transcript checkbox
document.getElementById('useExistingTranscript').addEventListener('change', () => {
    const isChecked = document.getElementById('useExistingTranscript').checked;
    const transcriptText = document.getElementById('transcriptionText').textContent || document.getElementById('transcriptionText').innerText;

    if (isChecked) {
        // Check if there's actually transcript content
        if (!transcriptText || transcriptText.trim() === '' || transcriptText.includes('Upload a file to see transcription')) {
            showWarningToast('No transcript available. Please transcribe a file first.');
            document.getElementById('useExistingTranscript').checked = false;
            return;
        }
        showInfoToast('Transcript will be included with your prompt');
    }
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

// Handle prompt submission
document.getElementById('invokeBedrockBtn').addEventListener('click', async () => {
    const model = document.getElementById('modelSelect').value;
    let prompt = document.getElementById('promptEditor').value;
    const responseArea = document.getElementById('analysisText');
    const useKnowledgeBase = document.getElementById('useKnowledgeBase').checked;
    const useExistingTranscript = document.getElementById('useExistingTranscript').checked;

    // Check if prompt is empty
    if (!prompt) {
        showErrorToast('Please enter a prompt');
        return;
    }

    // Append transcript text if checkbox is checked
    if (useExistingTranscript) {
        const transcriptText = document.getElementById('transcriptionText').textContent || document.getElementById('transcriptionText').innerText;

        // Validate transcript content
        if (!transcriptText || transcriptText.trim() === '' || transcriptText.includes('Upload a file to see transcription')) {
            showWarningToast('No transcript available. Please transcribe a file first or uncheck "Use Existing Transcript".');
            return;
        }

        // Clean up transcript text and append to prompt
        const cleanTranscript = transcriptText.trim();
        prompt = `${prompt}\n\n--- TRANSCRIPT ---\n${cleanTranscript}\n--- END TRANSCRIPT ---`;

        showInfoToast('Transcript has been included with your prompt');
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

    // Set up transcription progress listener once
    window.electronAPI.receive('transcription-progress', (progressData) => {
        const statusElement = document.getElementById('transcriptionStatus');
        if (statusElement) {
            statusElement.textContent = progressData.message;
        }
    });

    // Add event listeners for transcript management buttons
    document.getElementById('downloadTranscript').addEventListener('click', downloadTranscript);
    document.getElementById('copyTranscript').addEventListener('click', copyTranscript);
    document.getElementById('clearTranscriptionBtn').addEventListener('click', clearTranscription);

    // Add event listeners for clear confirmation modal
    document.getElementById('saveTranscriptBeforeClear').addEventListener('click', () => {
        downloadTranscript();
        performClearTranscription();
        bootstrap.Modal.getInstance(document.getElementById('clearTranscriptionModal')).hide();
    });

    document.getElementById('copyTranscriptBeforeClear').addEventListener('click', async () => {
        await copyTranscript();
        performClearTranscription();
        bootstrap.Modal.getInstance(document.getElementById('clearTranscriptionModal')).hide();
    });

    document.getElementById('clearWithoutSaving').addEventListener('click', () => {
        performClearTranscription();
        bootstrap.Modal.getInstance(document.getElementById('clearTranscriptionModal')).hide();
    });
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
            showSuccessToast('Knowledge bases loaded successfully');
        }
        else {
            document.getElementById('useKnowledgeBase').checked = false;
            document.getElementById('knowledgeBaseSection').style.display = 'none';
            showInfoToast('Removed knowledge bases from Bedrock query');
        }


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

// Settings management functions
async function openSettingsWindow() {
    try {
        showInfoToast('Opening application settings...');
        await window.electronAPI.invokeAsync('open-settings-window');
    } catch (error) {
        console.error('Error opening settings window:', error);
        showErrorToast(`Failed to open settings window: ${error.message}`);
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
// Transcript management functions
function downloadTranscript() {
    const transcriptText = document.getElementById('transcriptionText').textContent || document.getElementById('transcriptionText').innerText;

    if (!transcriptText || transcriptText.trim() === '' || transcriptText.includes('Upload a file to see transcription')) {
        showWarningToast('No transcript available to download');
        return;
    }

    // Create a Blob with the transcript text
    const blob = new Blob([cleanupTranscript()], { type: 'text/plain' });

    // Create a download link
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'transcript.txt';
    link.click();

    // Clean up
    URL.revokeObjectURL(link.href);

    // Show success toast
    showSuccessToast('Transcript downloaded successfully');
}

function copyTranscript() {
    const transcriptText = document.getElementById('transcriptionText').textContent || document.getElementById('transcriptionText').innerText;

    if (!transcriptText || transcriptText.trim() === '' || transcriptText.includes('Upload a file to see transcription')) {
        showWarningToast('No transcript available to copy');
        return Promise.resolve();
    }

    return navigator.clipboard.writeText(cleanupTranscript())
        .then(() => {
            showSuccessToast('Transcript copied to clipboard');

            // Optional: Show a brief success message on the button
            const copyBtn = document.getElementById('copyTranscript');
            if (copyBtn) {
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check me-2"></i>Copied!';
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                }, 2000);
            }
        })
        .catch(err => {
            console.error('Failed to copy transcript:', err);
            showErrorToast('Failed to copy transcript to clipboard');
        });
}

function clearTranscription() {
    // Show the confirmation modal
    const modal = new bootstrap.Modal(document.getElementById('clearTranscriptionModal'));
    modal.show();
}

function performClearTranscription() {
    // Reset the file input
    fileInput.value = '';

    // Clear video player and hide video container
    videoPlayer.src = '';
    videoContainer.classList.add('d-none');
    uploadZone.classList.remove('d-none');

    // Clear transcription text
    transcriptionText.innerHTML = 'Upload a file to see transcription';

    // Hide transcript action buttons
    document.getElementById('downloadTranscript').classList.add('d-none');
    document.getElementById('copyTranscript').classList.add('d-none');
    document.getElementById('clearTranscriptionBtn').classList.add('d-none');

    // Reset upload zone border color
    uploadZone.style.borderColor = '#ccc';

    // Show success message
    showSuccessToast('Transcription cleared successfully');
}

// Handle file upload and transcription
async function uploadFile(file) {
    const modal = new bootstrap.Modal(document.getElementById('transcriptionProcessingModal'));
    const statusElement = document.getElementById('transcriptionStatus');

    try {
        // Show the processing modal
        statusElement.textContent = 'Preparing transcription...';
        modal.show();

        // Clear any previous transcription text
        transcriptionText.innerHTML = '';

        // Convert File to ArrayBuffer to make it cloneable for IPC
        const arrayBuffer = await file.arrayBuffer();
        const fileData = {
            buffer: Array.from(new Uint8Array(arrayBuffer)), // Convert to regular array
            name: file.name,
            type: file.type,
            size: file.size
        };

        // Call the transcription service with the uploaded data
        const response = await window.electronAPI.invoke('transcribe-media', { file: fileData });

        // Hide the modal
        modal.hide();

        if (response.status === 'COMPLETED') {
            // Display the transcript with timestamps and speaker details
            displayTranscript(response.transcript);

            // Show transcript action buttons
            document.getElementById('downloadTranscript').classList.remove('d-none');
            document.getElementById('copyTranscript').classList.remove('d-none');
            document.getElementById('clearTranscriptionBtn').classList.remove('d-none');

            showSuccessToast('Transcription completed successfully!');
        } else {
            modal.hide();
            throw new Error('Transcription did not complete successfully');
        }

    } catch (error) {
        console.error('Transcription error:', error);

        // Hide the modal in case of error
        modal.hide();

        // Show error in transcription area
        transcriptionText.innerHTML = `<div class="alert alert-danger" role="alert">
            <i class="bi bi-exclamation-triangle me-2"></i>
            <strong>Transcription Failed:</strong> ${error.message}
        </div>`;

        showErrorToast(`Transcription failed: ${error.message}`);
    } finally {
        modal.hide();
    }
}
function displayTranscript(timestampedTranscript) {

    if (!timestampedTranscript || timestampedTranscript.length === 0) {
        transcriptionText.innerHTML = 'No transcription data available';
        showWarningToast('No transcription data was returned');
        return;
    }

    // Format each segment
    const formattedTranscript = timestampedTranscript.map(segment => {
        const startTimeFormatted = formatTimestamp(segment.startTime);
        const endTimeFormatted = formatTimestamp(segment.endTime);
        const speakerLabel = segment.speaker ?
            `<span class="speaker-label">Speaker ${segment.speaker}</span>` :
            '<span class="speaker-label">Unknown</span>';
        currentTranscript.push(segment.text);

        return `<div class="transcript-segment">
            <div class="transcript-header">
                <span class="timestamp">${startTimeFormatted} --> ${endTimeFormatted}</span>
                ${speakerLabel}
            </div>
            <div class="transcript-content">
                <span class="transcript-text">${segment.text}</span>
            </div>
        </div>`;
    }).join('');

    // Update the transcription text content
    transcriptionText.innerHTML = formattedTranscript;

    addTranscriptSegmentListeners();
}

function addTranscriptSegmentListeners() {
    const transcriptSegments = document.querySelectorAll('.transcript-segment');

    transcriptSegments.forEach(segment => {
        // Check if the segment already has a click listener
        if (!segment.hasAttribute('data-listener-attached')) {
            segment.addEventListener('click', () => {
                const timestampElement = segment.querySelector('.timestamp');
                if (timestampElement) {
                    // Extract the start timestamp from the timestamp text (e.g., "1:23:45:678 --> 1:24:00:000")
                    const startTime = timestampElement.textContent.split('-->')[0].trim();
                    const videoElement = document.getElementById('videoPlayer');

                    if (videoElement && startTime) {
                        moveVideoToTimestamp(videoElement, startTime);
                    }
                }
            });

            // Mark the segment as having a listener attached
            segment.setAttribute('data-listener-attached', 'true');
        }
    });
}

function moveVideoToTimestamp(videoElement, timestamp) {
    const [hours, minutes, seconds, milliseconds] = timestamp.split(':').map(Number);
    const totalSeconds = (hours * 3600) + (minutes * 60) + seconds + (milliseconds / 1000);
    videoElement.currentTime = totalSeconds;
    videoElement.play();
}

// Format timestamp into H:mm:ss:milliseconds format
function formatTimestamp(seconds) {
    const totalMilliseconds = seconds * 1000;
    const hours = Math.floor(totalMilliseconds / 3600000);
    const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
    const seconds_ = Math.floor((totalMilliseconds % 60000) / 1000);
    const milliseconds = Math.floor(totalMilliseconds % 1000);

    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds_).padStart(2, '0')}:${String(milliseconds).padStart(3, '0')}`;
}

function cleanupTranscript() {
    // Combine all text segments into a single string, separated by spaces
    return currentTranscript
        .join(' ')
        // Clean up any double spaces that might occur between segments
        .replace(/\s+/g, ' ')
        .trim();
}