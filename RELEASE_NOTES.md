# Transcribely Release Notes

## Version 1.1.0

### 🎉 Major Features

#### Streaming AI Responses
- **Real-time streaming**: AI responses now appear word-by-word as they're generated, providing immediate feedback
- Powered by AWS Bedrock ConverseStreamCommand API
- Significantly improved user experience with no waiting for complete responses

#### Document Attachment Support
- **Attach up to 5 documents** per message to provide context to AI models
- Supported formats: PDF, DOC, DOCX, XLS, XLSX, CSV, HTML, TXT, MD
- Maximum 10MB per file
- Claude-style **+ button** in chat input for intuitive file attachment
- Visual file list with icons and individual remove buttons
- Files automatically cleared after sending

#### Conversation Memory & Persistence
- **Multi-turn conversations** with full context retention
- Conversations automatically saved and persist across app restarts
- **Auto-load most recent conversation** on startup
- Sidebar with searchable conversation list
- Create, load, and delete conversations
- **Smart compression**: Automatically summarizes old messages when conversation exceeds 20 messages
- Chat-style UI with user/assistant message bubbles

#### Enhanced Chat Interface
- **Modern chat UI** inspired by Claude and ChatGPT
- Floating + and send buttons inside textarea (overlay design)
- Auto-resizing textarea (grows with content, max 300px)
- Individual **copy button** on each assistant response
- Thinking indicator while AI processes
- Keyboard shortcuts: Enter to send, Shift+Enter for new line
- Timestamps on all messages

### 📤 Export & Sharing

- **Export conversations as Markdown** files (.md format)
- Copy full conversation to clipboard (markdown formatted)
- Copy individual responses with one click
- Download transcripts with timestamps

### 🎨 UI/UX Improvements

- **Dark theme support** with system preference detection
- Theme toggle: Light → Dark → Auto (system)
- Improved layout with collapsible content sections
- Consistent button styling across the app
- Better scrolling behavior in transcription and analysis panels
- Responsive design with proper height management

### 🎵 Media Transcription

- **AWS Transcribe integration** for audio/video files
- Supported formats: MP3, MP4, WAV, M4A, FLAC, and more
- **Clickable timestamps** - jump to specific moments in media player
- Speaker identification and labeling
- Real-time transcription progress updates
- Download or copy transcripts

### 🤖 AI Analysis Features

- **Multiple AI models** supported:
  - Claude Sonnet 3.7 & 4.5
  - Nova Pro & Lite
  - DeepSeek R1
- **AWS Bedrock Knowledge Base** integration
- Built-in prompt templates:
  - Summarization
  - Key Points extraction
  - Action Items identification
  - Sentiment Analysis
  - Custom prompts
- Option to include transcript in AI analysis
- Citation support for Knowledge Base responses

### 🔐 Credentials & Settings

- **Secure AWS credential storage** with encryption
- Auto-detect and parse credentials from multiple formats:
  - Windows batch format (`set AWS_ACCESS_KEY_ID=...`)
  - Unix export format (`export AWS_ACCESS_KEY_ID=...`)
  - Simple key=value format
- **Credential validation** with service-specific permission checks
- Support for temporary credentials (session tokens)
- Multiple AWS region support
- Configurable settings with persistence

### 🛠️ Developer & Quality

- **Comprehensive unit tests** with Jest
- Bedrock integration tests (optional, requires AWS credentials)
- Test coverage reporting
- VS Code debugger configuration
- Improved error handling - no more locked UI on exceptions
- Better logging system

### 📦 Distribution

- **macOS Universal binary** (Intel + Apple Silicon)
- **Windows installers** (x64 and ARM64)
- **Ad-hoc code signing** for macOS (prevents "app is damaged" errors)
- High-quality app icons (512x512, ICNS, ICO formats)
- Proper app metadata and branding

### 🐛 Bug Fixes

- Fixed modal dialogs that wouldn't dismiss
- Fixed collapsing content boxes
- Fixed inconsistent scrolling behaviors
- Improved error recovery without requiring app restart
- Better handling of expired AWS credentials
- Fixed UI lock-ups when exceptions occur

---

## Installation

### macOS
1. Download `Transcribely-1.1.0-universal.dmg`
2. Open the DMG and drag Transcribely to Applications
3. Right-click the app and select "Open" (first launch only)

### Windows
1. Download `Transcribely-Setup-x64.exe` (64-bit) or `Transcribely-Setup-arm64.exe` (ARM)
2. Run the installer
3. If you see a security warning, click "More info" then "Run anyway"

## Requirements

- **AWS Account** with Bedrock and Transcribe access
- **Bedrock Models**: Enable access to desired models in AWS Console
- **Internet connection** for AWS services
- **System Requirements**:
  - macOS 10.12+ or Windows 10/11
  - 4GB RAM (8GB recommended)
  - 200MB disk space

## Getting Started

1. Launch Transcribely
2. Go to Settings → AWS Credentials
3. Paste your AWS credentials (auto-detected format)
4. Click "Save & Test Credentials"
5. Start transcribing media or chatting with AI!

---

**Made with ❤️ and Kiro by the Keynote Team**
