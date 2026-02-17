// Settings page functionality
let currentSettings = {};

// DOM elements
const settingsForm = document.getElementById('settingsForm');
const backToMainBtn = document.getElementById('backToMainBtn');
const resetToDefaultsBtn = document.getElementById('resetToDefaultsBtn');
const cancelBtn = document.getElementById('cancelBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const loadingModalManager = new ModalManager('loadingModal');

// Form fields
const transcriptionLanguageSelect = document.getElementById('transcriptionLanguage');
const regionSelect = document.getElementById('region');
const bucketNameInput = document.getElementById('bucketName');
const outputBucketNameInput = document.getElementById('outputBucketName');
const defaultThemeSelect = document.getElementById('defaultTheme');

// Initialize tooltips
document.addEventListener('DOMContentLoaded', function() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
});

// Load settings on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize theme first
    if (window.themeManager) {
        await window.themeManager.initializeFromSettings();
    }
    await loadSettings();
});

// Event listeners
backToMainBtn.addEventListener('click', navigateToMain);
resetToDefaultsBtn.addEventListener('click', resetToDefaults);
cancelBtn.addEventListener('click', navigateToMain);
settingsForm.addEventListener('submit', saveSettings);

async function loadSettings() {
    try {
        currentSettings = await window.electronAPI.invokeAsync('load-settings');
        populateForm(currentSettings);
    } catch (error) {
        console.error('Error loading settings:', error);
        window.electronAPI.showToast('Error loading settings: ' + error.message, 'error');
        // Load defaults if loading fails
        currentSettings = await window.electronAPI.getDefaultSettings();
        populateForm(currentSettings);
    }
}

function populateForm(settings) {
    transcriptionLanguageSelect.value = settings.transcriptionLanguage || 'en-US';
    regionSelect.value = settings.region || 'us-east-1';
    bucketNameInput.value = settings.bucketName || '';
    outputBucketNameInput.value = settings.outputBucketName || '';
    defaultThemeSelect.value = settings.defaultTheme || 'auto';
}

async function saveSettings(event) {
    event.preventDefault();
    
    // Show loading modal
    loadingModalManager.show();
    
    try {
        const formData = new FormData(settingsForm);
        const settings = {
            transcriptionLanguage: transcriptionLanguageSelect.value,
            region: regionSelect.value,
            bucketName: bucketNameInput.value.trim(),
            outputBucketName: outputBucketNameInput.value.trim(),
            defaultTheme: defaultThemeSelect.value
        };

        // Validate required fields
        if (!settings.bucketName) {
            throw new Error('Input S3 bucket name is required');
        }
        
        if (!settings.outputBucketName) {
            throw new Error('Output S3 bucket name is required');
        }

        await window.electronAPI.invokeAsync('save-settings', settings);
        currentSettings = settings;
        
        // Apply theme immediately if it changed
        if (window.themeManager && settings.defaultTheme !== window.themeManager.getUserPreference()) {
            window.themeManager.applyTheme(settings.defaultTheme);
        }
        
        loadingModalManager.hide();
        window.electronAPI.showToast('Settings saved successfully!', 'success');
        
        // Navigate back to main after a short delay
        setTimeout(() => {
            navigateToMain();
        }, 1500);
        
    } catch (error) {
        loadingModalManager.showError(error.message || 'Failed to save settings');
        console.error('Error saving settings:', error);
        window.electronAPI.showToast('Error saving settings: ' + error.message, 'error');
    }
}

async function resetToDefaults() {
    try {
        const defaults = await window.electronAPI.invokeAsync('get-default-settings');
        populateForm(defaults);
        window.electronAPI.showToast('Form reset to default values', 'info');
    } catch (error) {
        console.error('Error loading defaults:', error);
        window.electronAPI.showToast('Error loading default settings', 'error');
    }
}

async function navigateToMain() {
    try {
        await window.electronAPI.invokeAsync('navigate-to-main');
    } catch (error) {
        console.error('Error navigating to main:', error);
        window.electronAPI.showToast('Error navigating to main page', 'error');
    }
}

// Handle form validation
function validateForm() {
    const bucketName = bucketNameInput.value.trim();
    const outputBucketName = outputBucketNameInput.value.trim();
    
    // Basic S3 bucket name validation
    const bucketNameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    
    if (bucketName && !bucketNameRegex.test(bucketName)) {
        bucketNameInput.setCustomValidity('Bucket name must contain only lowercase letters, numbers, and hyphens');
        return false;
    } else {
        bucketNameInput.setCustomValidity('');
    }
    
    if (outputBucketName && !bucketNameRegex.test(outputBucketName)) {
        outputBucketNameInput.setCustomValidity('Bucket name must contain only lowercase letters, numbers, and hyphens');
        return false;
    } else {
        outputBucketNameInput.setCustomValidity('');
    }
    
    return true;
}

// Add real-time validation
bucketNameInput.addEventListener('input', validateForm);
outputBucketNameInput.addEventListener('input', validateForm);