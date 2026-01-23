# Credentials & Configuration Update

## Summary
Updated the AWS credentials setup to support copy-paste functionality and updated Bedrock model configurations to use the latest available models.

## Changes Made

### 1. Enhanced Credentials Page (`src/pages/credentials.html`)
- Added helpful tip in the card header about paste functionality
- Added "Paste Credentials" button alongside "Load Existing" button
- Improved button layout with responsive grid (2 columns on medium+ screens)
- Added Toastify.js library for better toast notifications

### 2. Enhanced Credentials Script (`src/renderer/credentials.js`)
**New Features:**
- **Auto-detect paste**: Automatically detects when AWS credentials are pasted into any field
- **Multi-format support**: Supports three credential formats:
  - Windows batch format: `set AWS_ACCESS_KEY_ID=...`
  - Unix export format: `export AWS_ACCESS_KEY_ID=...`
  - Simple format: `AWS_ACCESS_KEY_ID=...`
- **Auto-populate**: Automatically fills all credential fields when valid credentials are detected
- **Visual feedback**: Highlights populated fields with green border for 2 seconds
- **Toast notifications**: Uses Toastify for success, error, and info messages
- **Manual paste button**: "Paste Credentials" button for explicit clipboard reading

**Functions Added:**
- `setupPasteDetection()` - Sets up paste event listeners on input fields
- `handlePaste(event)` - Handles paste events and triggers credential parsing
- `isAwsCredentialFormat(text)` - Detects if pasted text contains AWS credentials
- `parseAwsCredentials(text)` - Parses credentials from various formats
- `populateCredentialFields(credentials)` - Fills form fields with parsed credentials
- `pasteCredentialsFromClipboard()` - Manual paste function for the button
- `showSuccessToast()`, `showErrorToast()`, `showInfoToast()` - Toast notification helpers

### 3. Updated Bedrock Models (`config.js`)
**New Model Configuration:**
- Uses `inferenceProfileId` instead of `inferenceArn` (more portable)
- Updated to latest Bedrock models:
  - **Nova Pro**: `us.amazon.nova-pro-v1:0`
  - **Claude 3.7 Sonnet**: `us.anthropic.claude-3-7-sonnet-20250219-v1:0`
  - **Claude 4.5 Sonnet**: `global.anthropic.claude-sonnet-4-5-20250929-v1:0` (NEW)
  - **Claude 4.1 Opus**: `us.anthropic.claude-opus-4-1-20250805-v1:0` (NEW)
  - **DeepSeek R1**: `us.deepseek.r1-v1:0`

**Removed:**
- Claude 4.0 Sonnet (replaced with 4.5)

**Enhanced Prompts:**
- More descriptive default prompts with better instructions
- Improved prompt templates for better AI responses

## Usage

### Paste Credentials - Method 1 (Auto-detect)
1. Copy your AWS credentials from any source (AWS Console, CLI, etc.)
2. Paste into ANY credential field (Access Key, Secret Key, or Session Token)
3. The app automatically detects the format and populates all fields
4. Visual feedback shows which fields were populated

### Paste Credentials - Method 2 (Manual Button)
1. Copy your AWS credentials to clipboard
2. Click the "Paste Credentials" button
3. Credentials are parsed and populated automatically

### Supported Credential Formats

**Windows Batch Format:**
```batch
set AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
set AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
set AWS_SESSION_TOKEN=FwoGZXIvYXdzEBYaDH...
set AWS_DEFAULT_REGION=us-east-1
```

**Unix Export Format:**
```bash
export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
export AWS_SESSION_TOKEN=FwoGZXIvYXdzEBYaDH...
export AWS_DEFAULT_REGION=us-east-1
```

**Simple Format:**
```
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_SESSION_TOKEN=FwoGZXIvYXdzEBYaDH...
AWS_REGION=us-east-1
```

## Benefits

1. **Faster Setup**: No need to manually copy-paste each field individually
2. **Error Reduction**: Eliminates typos from manual entry
3. **Better UX**: Visual feedback and helpful toast messages
4. **Flexible**: Works with multiple credential formats
5. **Latest Models**: Access to newest and most capable Bedrock models
6. **Future-Proof**: Uses inference profile IDs instead of ARNs

## Testing

To test the new functionality:
1. Run the app: `npm start`
2. Navigate to credentials setup
3. Copy sample credentials (in any supported format)
4. Paste into any field or click "Paste Credentials"
5. Verify all fields are populated correctly
6. Click "Save & Test Credentials" to validate

## Notes

- The paste detection works on all credential input fields
- Session token and region are optional and will be populated if present
- Invalid or unrecognized formats will show an info toast with instructions
- The app validates the region against available options before populating
