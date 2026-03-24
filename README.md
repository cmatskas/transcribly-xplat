# Transcribely

**Transcribely** is a powerful Electron desktop application that combines AWS Bedrock AI models with AWS Transcribe to provide intelligent media transcription and analysis capabilities.

## Features

- 🎵 **Media Transcription**: Upload audio and video files for automatic transcription using AWS Transcribe
- 🤖 **AI Analysis**: Analyze transcripts using AWS Bedrock foundation models (Claude, Nova Pro, DeepSeek R1)
- 📝 **Knowledge Base Integration**: Connect to AWS Bedrock Knowledge Bases for enhanced AI responses
- 🎨 **Modern UI**: Clean, responsive interface with dark/light theme support
- 💾 **Export Options**: Download transcripts and analysis results as text files
- 🔒 **Secure**: Local credential storage with encryption
- ⚡ **Easy Credential Setup**: Auto-detect and paste AWS credentials from multiple formats
- 🛡️ **Error Recovery**: Graceful error handling without requiring app restarts
- 📊 **PowerPoint Support**: Upload and analyze `.pptx`/`.ppt` files — content is extracted automatically via code interpreter
- 🖼️ **Flexible Image Generation**: Generate images using a SageMaker SDXL endpoint (optional) with automatic fallback to Amazon Nova Canvas

## Prerequisites

Before using Transcribely, you'll need:

1. **AWS Account** with appropriate permissions (see below)
2. **Bedrock Models**: Enable access to DeepSeek R1, Nova Pro, Claude Sonnet 3.7, and Claude Sonnet 4.5 in your AWS Bedrock service

For development (optional):
3. **Node.js** (version 16 or higher)
4. **npm** or **yarn** package manager

## AWS Permissions Required

Your AWS IAM user or role must have the following permissions:

### Bedrock Service
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:ListFoundationModels",
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream"
            ],
            "Resource": "*"
        }
    ]
}
```

### Transcribe Service
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "transcribe:StartTranscriptionJob",
                "transcribe:GetTranscriptionJob",
                "transcribe:ListTranscriptionJobs"
            ],
            "Resource": "*"
        }
    ]
}
```

### S3 Service
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        }
    ]
}
```

### Knowledge Base (Optional)
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:ListKnowledgeBases",
                "bedrock:RetrieveAndGenerate"
            ],
            "Resource": "*"
        }
    ]
}
```

### SageMaker Image Generation (Optional)
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "sagemaker:InvokeEndpoint"
            ],
            "Resource": "arn:aws:sagemaker:*:*:endpoint/your-endpoint-name"
        }
    ]
}
```

## Installation

### Option 1: Download Pre-built Binaries (Recommended)

Download directory: [here](https://amazoncorporate.box.com/s/rwc0pbifx50uf7g2xi8mxanahq5qnljn)

1. Download the appropriate installer for your platform:
   - **Windows (64-bit)**: `Transcribely-Setup-x64.exe` (~80MB)
   - **Windows ARM64**: `Transcribely-Setup-arm64.exe` (~82MB)
   - **macOS Universal**: `Transcribely-2.0.1-universal.dmg` (~174MB) - Works on Intel & Apple Silicon
2. Run the installer and follow the setup instructions

#### Windows Installation
- Double-click the installer
- If you see a security warning, click "More info" then "Run anyway"
- Follow the installation wizard
- Launch from Start Menu or Desktop shortcut

#### macOS Installation
- Double-click the DMG file
- Drag Transcribely to Applications folder
- Right-click the app and select "Open" (first launch only)
- For subsequent launches, open normally from Applications

### Option 2: Build from Source

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-repo/transcribely.git
   cd transcribely
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run in development mode**:
   ```bash
   npm start
   ```

4. **Build for production**:
   ```bash
   # Build for all platforms
   npm run build

   # Or build for specific platforms
   npm run build:win    # Windows
   npm run build:mac    # macOS
   npm run build:linux  # Linux
   ```

### System Requirements
- **Windows**: Windows 10/11, 4GB RAM (8GB recommended), 200MB disk space
- **macOS**: macOS 10.12+, Intel or Apple Silicon, 4GB RAM (8GB recommended), 200MB disk space
- **Internet connection** required for AWS services

## Configuration

### First-Time Setup

1. **Launch Transcribely**
2. **Configure AWS Credentials**:
   - Click on "Settings" → "AWS Credentials"
   - Enter your AWS credentials using one of these methods:
     
     **Method 1: Auto-Paste** (Recommended)
     - Copy your AWS credentials from any source
     - Paste into ANY credential field
     - The app automatically detects and populates all fields
     
     **Method 2: Manual Entry**
     - Enter Access Key ID
     - Enter Secret Access Key
     - Enter AWS Region (e.g., `us-east-1`)
     - Enter Session Token (optional, for temporary credentials)
   
   - Click "Save & Test Credentials"

3. **Verify Permissions**:
   - The app will automatically test your AWS permissions
   - Ensure all services show green checkmarks:
     - ✅ Bedrock Access
     - ✅ Transcribe Access
     - ✅ S3 Access

4. **Configure Image Generation** (Optional):
   - Go to "Settings" → "Image Generation"
   - Enter your SageMaker endpoint name to use an SDXL model for image generation
   - Optionally enter an Inference Component Name if your endpoint uses one
   - Leave blank to use Amazon Nova Canvas (default fallback)

### Supported Credential Formats

The app can auto-detect and parse credentials from these formats:

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

### AWS Regions

Make sure to select a region where Bedrock models are available:
- `us-east-1` (N. Virginia)
- `us-west-2` (Oregon)
- `eu-west-1` (Ireland)
- `ap-southeast-1` (Singapore)
- `ap-northeast-1` (Tokyo)

## Usage

### Transcribing Media

1. **Upload Media File**:
   - Go to the "Transcribe" tab
   - Click the upload zone or drag & drop your audio/video file
   - Supported formats: MP3, MP4, WAV, M4A, FLAC, and more

2. **Wait for Processing**:
   - The app will upload your file to AWS Transcribe
   - Processing time depends on file length
   - You'll see real-time status updates

3. **View Results**:
   - Transcripts appear with timestamps and speaker labels
   - Click any segment to jump to that time in the media player
   - Use "Download Transcript" or "Copy Transcript" buttons to save results

### AI Analysis

1. **Switch to Analyze Tab**:
   - Click on the "Analyze" tab

2. **Configure Analysis**:
   - Select a Bedrock model (Claude, Nova Pro, etc.)
   - Choose a prompt template or write a custom prompt
   - Optionally enable "Use Existing Transcript" to include your transcription
   - Optionally enable "Use Knowledge Base" for enhanced responses

3. **Run Analysis**:
   - Click "Invoke Bedrock"
   - Wait for the AI to process your request
   - View results in the right panel
   - Download or copy the analysis results

### Prompt Templates

The app includes several built-in prompt templates:
- **Summarization**: Create concise summaries
- **Key Points**: Extract main topics and insights
- **Action Items**: Identify tasks and next steps
- **Sentiment Analysis**: Analyze emotional tone
- **Custom**: Write your own prompts

## Troubleshooting

### Common Issues

**"No AWS credentials configured"**
- Ensure you've entered valid AWS credentials in Settings
- Check that your credentials have the required permissions

**"Bedrock access denied"**
- Verify your AWS region supports Bedrock
- Check that your IAM user/role has Bedrock permissions
- Some Bedrock models require special access requests in AWS Console

**"Transcription failed"**
- Ensure your media file is in a supported format
- Check file size limits (AWS Transcribe has size restrictions)
- Verify S3 permissions for temporary file storage

**"Knowledge Base not found"**
- Ensure you have created a Knowledge Base in AWS Bedrock
- Check that your credentials have access to the Knowledge Base
- Verify the Knowledge Base is in the same region as your app configuration

**Error modals won't dismiss**
- Click the "Dismiss" button or press Escape key
- If the modal is stuck, the app has automatic cleanup mechanisms
- All your work is preserved - no need to restart the app

### Error Recovery

When errors occur, Transcribely now provides graceful recovery:
- Error messages are displayed clearly in the modal
- Click "Dismiss" or press Escape to close error dialogs
- Your work is preserved - no need to restart the app
- Fix the issue and try again immediately

### Debug Mode

To enable debug logging:
1. Open the app
2. Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS) to open Developer Tools
3. Check the Console tab for detailed error messages

### Installation Issues

**Windows: "Security Warning"**
- Click "More info" and then "Run anyway"
- This is normal for new applications

**macOS: "App is damaged" or "Unidentified Developer"**
- Right-click the app and select "Open"
- In System Settings → Security & Privacy, click "Open Anyway"
- This only needs to be done once

## Development

### Project Structure

```
transcribely/
├── src/
│   ├── assets/          # Icons and images
│   ├── main/            # Main process modules
│   ├── pages/           # HTML pages
│   ├── renderer/        # Renderer process scripts
│   └── styles/          # CSS stylesheets
├── tests/               # Test files
│   ├── renderer/        # Renderer process tests
│   ├── main/            # Main process tests
│   │   └── bedrock-llm.test.js  # Bedrock integration tests
│   └── setup.js         # Jest configuration
├── main.js              # Main Electron process
├── preload.js           # Preload script
└── package.json         # Project configuration
```

### Running Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run Bedrock integration tests (requires AWS credentials, incurs costs)
npm run test:bedrock

# Quick Bedrock validation test
npm run test:bedrock-quick
```

### Test Suite

The project includes comprehensive unit and integration tests:

**Unit Tests** (Fast, no AWS costs):
- Renderer process tests (UI, event handlers, utilities)
- Main process tests (credentials manager)
- Mock all external dependencies
- Run automatically with `npm test`

**Integration Tests** (Requires AWS credentials, incurs costs):
- Bedrock LLM tests validate all models and prompts
- Use actual AWS credentials and make real API calls
- Should be run manually, not in CI/CD

### Bedrock Testing

The Bedrock integration tests validate all models and prompts using real AWS credentials.

**Prerequisites:**
- AWS credentials configured (environment variables or AWS CLI)
- Bedrock model access granted in AWS Console
- IAM permissions: `bedrock:InvokeModel`

**Quick Test** (~30 seconds, ~$0.05 cost):
```bash
npm run test:bedrock-quick
```
Tests one model/prompt combination to verify setup.

**Full Test Suite** (~3-5 minutes, ~$0.50-1.00 cost):
```bash
npm run test:bedrock
```
Tests all 4 models × 4 prompts (16 combinations) plus error handling and configuration tests.

**What's Tested:**
- **Models**: Nova Pro, Claude 3.7 Sonnet, Claude 4.5 Sonnet, DeepSeek R1
- **Prompts**: Summarize, Sentiment Analysis, Key Points, Action Items
- **Additional**: Error handling, model comparison, inference configuration

**Test Specific Scenarios:**
```bash
# Test only Nova Pro model
npx jest tests/main/bedrock-llm.test.js --testNamePattern="Nova Pro"

# Test only sentiment analysis
npx jest tests/main/bedrock-llm.test.js --testNamePattern="Analyze Sentiment"

# Test error handling
npx jest tests/main/bedrock-llm.test.js --testNamePattern="Error Handling"
```

**Important Notes:**
- ⚠️ Tests make real API calls and incur AWS costs
- Tests require valid AWS credentials (temporary or permanent)
- Credentials are validated before tests run
- If credentials expire, tests show clear error message with refresh instructions
- Don't run in CI/CD unless you have a dedicated test account
- Monitor your AWS billing dashboard

**Credential Setup for Tests:**
```bash
# Option 1: Environment variables
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=us-east-1

# Option 2: AWS CLI
aws configure

# Option 3: AWS SSO
aws sso login
```

**Cost Estimates:**
| Command | Tests | Time | Cost |
|---------|-------|------|------|
| `test:bedrock-quick` | 1 | 30s | ~$0.05 |
| `test:bedrock` | 22 | 3-5min | ~$0.50-1.00 |

### Test Coverage

The test suite covers:
- Toast notifications (success, error, info, warning)
- Navigation between pages
- File operations (upload, download, copy)
- Bedrock integration with/without knowledge base
- Knowledge base loading and caching
- Prompt validation and error handling
- Citation parsing and text formatting
- Event listeners and DOM interactions

**Coverage Goals:**
- Functions: 100% of exported functions
- Branches: All conditional logic paths
- Lines: >90% line coverage
- Error Handling: All error scenarios

### App Icons

All app icons are generated from `src/assets/favicon.svg`. To regenerate:

```bash
./generate-icons.sh
```

**Requirements:**
- `librsvg`: `brew install librsvg`
- `imagemagick`: `brew install imagemagick`
- `iconutil`: Built into macOS

### API Configuration Notes

**Bedrock API Requirements:**
- The Bedrock Converse API requires that `temperature` and `topP` cannot both be specified
- All API calls use only the `temperature` parameter (default: 0.7)
- Models use inference profile IDs for better portability

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run tests: `npm test`
5. For Bedrock changes, run: `npm run test:bedrock-quick`
6. Commit your changes: `git commit -am 'Add feature'`
7. Push to the branch: `git push origin feature-name`
8. Submit a pull request

## Security

- AWS credentials are stored locally using Electron's secure storage
- No credentials or media files are sent to external servers (except AWS)
- All communication with AWS uses encrypted HTTPS connections

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📧 Email: aws-tech-keynotes@amazon.com
- 🐛 Issues: [GitHub Issues](https://github.com/cmatskas/transcribly-xplat/issues)
- 📖 Documentation: [Wiki](https://github.com/cmatskas/transcribly-xplat/blob/main/README.md)

## Changelog

### v2.0.1
- **Agent Memory**: Short-term (STM) and long-term (LTM) memory via AWS Bedrock AgentCore Memory
  - Toggle memory on/off without destroying the memory resource
  - Per-installation user isolation via unique IDs
  - Automatic LTM extraction on new chat and app quit
  - Agent is context-aware and references past conversations when memory is available
- **Conversation Management**: Claude-style history sidebar
  - Star/favourite conversations for quick access
  - Rename conversations via modal dialog
  - Delete with confirmation prompt
  - Grouped sections: Starred, Today, Yesterday, This Week, Older
  - Context menu (three-dots) on each conversation
- **Image Generation**: Flexible image generation with provider fallback
  - Primary: SageMaker SDXL endpoint (optional, configurable in settings)
  - Fallback: Amazon Nova Canvas via Bedrock (default when no SageMaker endpoint configured)
  - New settings panel for endpoint name and inference component
- **Settings Redesign**: In-page settings with tabbed layout (Credentials, Configuration, About)
  - Settings persist correctly across all fields including memory and image generation
- **Theme-Aware Icons**: Greeting icon switches between light/dark variants based on theme
- **Bug Fixes**:
  - Memory settings no longer wiped when saving other settings
  - Memory toggle correctly reflects persisted state on app load
  - Re-enabling memory no longer attempts to recreate the AWS resource

### v2.0.0
- PowerPoint (`.pptx`/`.ppt`) file upload and analysis support
- Content extracted automatically from PowerPoint files via code interpreter (python-pptx)
- SageMaker SDXL endpoint support for image generation
- Automatic fallback to Amazon Nova Canvas when no SageMaker endpoint is configured
- New Image Generation settings panel (endpoint name + inference component)

### v1.0.0
- Initial release
- AWS Transcribe integration
- AWS Bedrock AI analysis
- Knowledge Base support
- Cross-platform desktop app
- Dark/light theme support

---

Made with ❤️ and Kiro by the Keynote Team