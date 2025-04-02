const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const videoContainer = document.getElementById('videoContainer');
const videoPlayer = document.getElementById('videoPlayer');
const transcriptionContent = document.getElementById('transcriptionContent');
const loadingSpinner = document.getElementById('loadingSpinner');
const transcriptionText = document.getElementById('transcriptionText');
const templateSelect = document.getElementById('promptTemplateSelect');

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
        return;
    }
    
    const analysisText = cleanupAnalysisText(currentAnalysis);

    navigator.clipboard.writeText(analysisText)
        .then(() => {
            // Show success toast
            showSuccessToast('Analysis copied to clipboard');
            
            // Optional: Show a brief success message
            const copyBtn = document.querySelector('.header-button');
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy text:', err);
            showErrorToast('Failed to copy to clipboard');
        });
}

document.getElementById('nav-analyze').addEventListener('click', showAnalyzePage);
document.getElementById('nav-transcribe').addEventListener('click', showTranscribePage);

templateSelect.addEventListener('change', () =>{
    const selectedOption = templateSelect.options[templateSelect.selectedIndex];
    const selectedPrompt = selectedOption.getAttribute('value');
    const promptInput = document.getElementById('promptEditor');
    promptInput.value = selectedPrompt;
})

// Handle file selection
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

// Handle click to upload
uploadZone.addEventListener('click', () => fileInput.click());

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

// Handle click to upload
uploadZone.addEventListener('click', () => fileInput.click());

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
                        showInfoToast(`Transcription in progress... (${Math.round(attempts/6)} minute(s) elapsed)`);
                    }
                    
                    updateStatus(`Transcription in progress... (${Math.round(attempts/6)} minute(s) elapsed)`);
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
/*document.getElementById('sendPrompt').addEventListener('click', async () => {
    const model = document.getElementById('modelSelect').value;
    const prompt = document.getElementById('promptInput').value;
    const responseArea = document.getElementById('modelResponse');

    if (!prompt) {
        alert('Please enter a prompt');
        return;
    }

    responseArea.innerHTML = 'Processing...';
    try {
        const response = await ipcRenderer.invoke('send-to-bedrock', { model, prompt });
        responseArea.innerHTML = `<pre>${response}</pre>`;
    } catch (error) {
        responseArea.innerHTML = `Error: ${error.message}`;
    }
});

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
        const models = await window.electronAPI.invokeAsync('get-bedrock-models');
        const modelSelect = document.getElementById('modelSelect');
        modelSelect.innerHTML = '';

        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.text = model.name;
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

