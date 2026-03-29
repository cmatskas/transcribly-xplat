# Release Notes

## v2.4.0
- **Skills Management UI**: New "Skills" tab in Settings for reviewing, editing, deleting, and creating agent skills
  - Inline SKILL.md editor with monospace textarea
  - Create new skills with template scaffolding
  - Enable/disable toggle per skill
  - "Always-on" badge for auto-activate skills
  - Open skills folder button for direct filesystem access
- **11 New Agent Skills** adapted from GSD, marketingskills, and community sources:
  - `customer-research` — Analyze transcripts, meeting notes, and interviews using JTBD extraction framework
  - `copy-editing` — Eight Sweeps review framework with AI de-slop detection (22 patterns, vocabulary tiers, tone-aware calibration)
  - `copywriting` — Marketing copy and keynote narrative framework with dynamic scoping and 6 foundational questions
  - `doc-coauthoring` — 3-stage collaborative document creation (Context Gathering → Refinement → Reader Testing)
  - `launch-strategy` — ORB framework and 5-phase launch planning
  - `marketing-psychology` — Behavioral science mental models for persuasive messaging
  - `analysis-framework` — Structured analysis frameworks (goal-backward, trade-off matrix, decision framework)
  - `research-first` — Research-before-action protocol for unfamiliar domains
  - `task-planner` — Structured task decomposition for complex multi-step requests
  - `self-correction` — Auto-fix runtime errors, install missing libraries, adapt to data formats
- **Skill Auto-Activate**: Skills can declare `auto-activate: "true"` in frontmatter to inject their full instructions into every agent conversation without requiring manual activation
- **Lazy Skill Loading**: Skills now load only frontmatter (1KB) at startup; full body loaded on-demand when activated — improves startup time with many skills
- **Skill Discovery**: Skills discovered from project (`.agents/skills/`), user (`~/.agents/skills/`), and app-bundled directories with priority ordering

## v2.2.0
- **Cancellation**: Send button toggles to a red stop button during agent/Bedrock execution
  - Work tab: cancels the running agent mid-stream, preserving partial output
  - Analyze tab: cancels the Bedrock streaming response
  - Cost-efficient — billed only for tokens generated before cancellation
- **Auto-Updates**: Automatic update notifications via S3
  - App checks for updates 10 seconds after launch and every 4 hours
  - Blue banner appears when an update is available or downloaded
  - "Restart & Install" button applies the update immediately
  - Windows: fully automatic. macOS: requires Apple Developer signing (pending)

## v2.0.1
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

## v2.0.0
- PowerPoint (`.pptx`/`.ppt`) file upload and analysis support
- Content extracted automatically from PowerPoint files via code interpreter (python-pptx)
- SageMaker SDXL endpoint support for image generation
- Automatic fallback to Amazon Nova Canvas when no SageMaker endpoint is configured
- New Image Generation settings panel (endpoint name + inference component)

## v1.0.0
- Initial release
- AWS Transcribe integration
- AWS Bedrock AI analysis
- Knowledge Base support
- Cross-platform desktop app
- Dark/light theme support
