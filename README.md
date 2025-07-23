# Transcribely

![Transcribely Logo](src/assets/favicon.svg)

**Transcribely** is a powerful Electron desktop application that combines AWS Bedrock AI models with AWS Transcribe to provide intelligent media transcription and analysis capabilities.

## Features

- 🎵 **Media Transcription**: Upload audio and video files for automatic transcription using AWS Transcribe
- 🤖 **AI Analysis**: Analyze transcripts using AWS Bedrock foundation models (Claude, Nova Pro, etc.)
- 📝 **Knowledge Base Integration**: Connect to AWS Bedrock Knowledge Bases for enhanced AI responses
- 🎨 **Modern UI**: Clean, responsive interface with dark/light theme support
- 💾 **Export Options**: Download transcripts and analysis results as text files
- 🔒 **Secure**: Local credential storage with encryption

## Prerequisites

Before using Transcribely, you'll need:

1. **AWS Account** with appropriate permissions (see below)
2. **Bedrock Models** you need to add DeepSeek R1, Nova Pro, Claude Sonnet v3.7 and Claude Sonnet v4.0 to your Bedrock service

(if you want to mess with the code - optional)
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

## Installation

### Option 1: Download Pre-built Binaries (Recommended)

1. Go to the [Releases](https://github.com/your-repo/transcribely/releases) page
2. Download the appropriate installer for your platform:
   - **Windows**: `Transcribely-Setup-1.0.0.exe`
   - **macOS**: `Transcribely-1.0.0.dmg`
   - **Linux**: `Transcribely-1.0.0.AppImage` or `transcribely_1.0.0_amd64.deb`
3. Run the installer and follow the setup instructions

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

## Configuration

### First-Time Setup

1. **Launch Transcribely**
2. **Configure AWS Credentials**:
   - Click on "Settings" → "AWS Credentials"
   - Enter your AWS credentials:
     - Access Key ID
     - Secret Access Key
     - AWS Region (e.g., `us-east-1`)
     - Session Token (optional, for temporary credentials)
   - Click "Save & Test Credentials"

3. **Verify Permissions**:
   - The app will automatically test your AWS permissions
   - Ensure all services show green checkmarks:
     - ✅ Bedrock Access
     - ✅ Transcribe Access
     - ✅ S3 Access

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
- Some Bedrock models require special access requests

**"Transcription failed"**
- Ensure your media file is in a supported format
- Check file size limits (AWS Transcribe has size restrictions)
- Verify S3 permissions for temporary file storage

**"Knowledge Base not found"**
- Ensure you have created a Knowledge Base in AWS Bedrock
- Check that your credentials have access to the Knowledge Base
- Verify the Knowledge Base is in the same region as your app configuration

### Debug Mode

To enable debug logging:
1. Open the app
2. Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS) to open Developer Tools
3. Check the Console tab for detailed error messages

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
├── main.js              # Main Electron process
├── preload.js           # Preload script
└── package.json         # Project configuration
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run tests: `npm test`
5. Commit your changes: `git commit -am 'Add feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

## Security

- AWS credentials are stored locally using Electron's secure storage
- No credentials or media files are sent to external servers (except AWS)
- All communication with AWS uses encrypted HTTPS connections

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📧 Email: support@transcribely.app
- 🐛 Issues: [GitHub Issues](https://github.com/your-repo/transcribely/issues)
- 📖 Documentation: [Wiki](https://github.com/your-repo/transcribely/wiki)

## Changelog

### v1.0.0
- Initial release
- AWS Transcribe integration
- AWS Bedrock AI analysis
- Knowledge Base support
- Cross-platform desktop app
- Dark/light theme support

---

Made with ❤️ and Kiro by the Keynote Team