# Transcribely

An Electron desktop app that combines AWS Bedrock AI models with AWS Transcribe for intelligent media transcription, AI-powered content creation, and multi-agent collaborative pipelines.

## Features

- 🤖 **Work Tab** — AI agent with code execution, web browsing, file I/O, image generation, and persistent memory via AgentCore
- 🐝 **Swarm Tab** — Multi-agent pipelines for articles, keynotes, speeches, and demo storyboards with quality rubric evaluation
- 💬 **Chat Tab** — Conversational AI analysis with conversation history, knowledge base integration, and file attachments
- 🎵 **Transcribe Tab** — Audio/video transcription via AWS Transcribe with speaker labels and timestamps
- 🧠 **17 Agent Skills** — Copy editing, copywriting, research, marketing psychology, document creation, generative art, and more
- 🎯 **Quality Rubrics** — Weighted criteria with penalty scoring, brief-specific adaptation, and adaptive learning from past runs
- ⚙️ **Model Management** — Configure Bedrock models and assign pipeline roles (creator/worker/formatter) from the UI
- 📊 **Quality Analytics** — Dashboard showing pass rates, criteria heatmaps, and actionable insights across pipeline runs

## Quick Start

### Download Pre-built Binaries (Recommended)

Download: [Box folder](https://amazoncorporate.box.com/s/rwc0pbifx50uf7g2xi8mxanahq5qnljn)

| Platform | File |
|---|---|
| macOS (Intel & Apple Silicon) | `Transcribely-2.5.0-universal.dmg` |
| Windows x64 | `Transcribely-Setup-x64.exe` |
| Windows ARM64 | `Transcribely-Setup-arm64.exe` |

### Build from Source

```bash
git clone https://github.com/cmatskas/transcribly-xplat.git
cd transcribly-xplat
npm install
npm start          # development
npm run build      # production (all platforms)
```

### First Launch

1. Open Settings → Credentials
2. Paste your AWS credentials (auto-detected from any format)
3. Click "Save & Test Credentials"
4. Start using the Work tab

## AWS Permissions Required

Your IAM user/role needs access to:
- **Bedrock**: `InvokeModel`, `InvokeModelWithResponseStream`, `ListFoundationModels`
- **Transcribe**: `StartTranscriptionJob`, `GetTranscriptionJob` (for Transcribe tab)
- **S3**: `GetObject`, `PutObject`, `DeleteObject` on your bucket (for Transcribe tab)

<details>
<summary>Optional permissions</summary>

- **Knowledge Base**: `ListKnowledgeBases`, `RetrieveAndGenerate`
- **SageMaker**: `InvokeEndpoint` (for SDXL image generation)
- **AgentCore**: Code Interpreter and Browser access (for Work/Swarm tools)
</details>

## Swarm Pipelines

The Swarm tab deploys teams of specialized AI agents:

| Template | Agents | Output |
|---|---|---|
| Article / Blog Post | 7 | Researched, edited .docx |
| Keynote / Presentation | 7 | Slide deck .pptx with speaker notes |
| Speech / Talk | 6 | Timed speech with stage directions |
| Demo / Storyboard | 6 | Scene-by-scene storyboard deck |

Each pipeline includes quality gates with rubric-based evaluation, AWS content guidelines, and adaptive learning from past runs.

## Agent Skills

17 bundled skills available in Settings → Skills:

| Category | Skills |
|---|---|
| Documents | `docx`, `pptx`, `xlsx`, `pdf` |
| Writing | `copywriting`, `copy-editing`, `doc-coauthoring` |
| Research | `research-first`, `customer-research`, `analysis-framework` |
| Strategy | `task-planner`, `launch-strategy`, `marketing-psychology` |
| Creative | `algorithmic-art`, `demo-storyboard` |
| Utility | `self-correction`, `web-browse` |

Create custom skills in Settings → Skills → New Skill.

## Model Configuration

Settings → Models lets you manage Bedrock models and assign pipeline roles:

| Role | Purpose | Default |
|---|---|---|
| Creator | Writing, quality evaluation — best model | Claude Opus 4.6 |
| Worker | Research, planning, editing — balanced | Claude Sonnet 4.6 |
| Formatter | Document generation — cheapest capable | Claude Haiku 4.5 |

Additional models (DeepSeek V3.2, Mistral Large 3, Llama 4 Maverick) available for the Chat tab.

## Development

```bash
npm test              # unit tests (8 suites, 124 tests)
npm run test:watch    # watch mode
npm run test:coverage # coverage report
npm run test:bedrock  # integration tests (requires AWS credentials, incurs costs)
```

### Project Structure

```
src/
├── main/models/       # Backend: orchestrator, tools, skills, rubrics, settings
├── renderer/          # Frontend: tab controllers, UI logic
├── pages/             # HTML
└── styles/            # CSS
skills/                # 17 bundled agent skills
tests/                 # Jest test suites
```

## System Requirements

- **Windows**: 10/11, 4GB RAM, 200MB disk
- **macOS**: 10.12+, Intel or Apple Silicon, 4GB RAM, 200MB disk
- **Node.js**: 20+ (for building from source)

## Release Notes

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for the full version history.

## License

MIT — see [LICENSE](LICENSE)

## Support

- 📧 aws-tech-keynotes@amazon.com
- 🐛 [GitHub Issues](https://github.com/cmatskas/transcribly-xplat/issues)

---

Made with ❤️ and Kiro by the Keynote Team
