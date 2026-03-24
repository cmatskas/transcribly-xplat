# Transcribely Roadmap

## Current State

Transcribely is a single-agent Electron desktop app with:
- Transcription via AWS Transcribe
- AI chat/analysis via Bedrock Converse with tool use
- Document generation (pptx, docx, xlsx) via Code Interpreter skills
- Web browsing via AgentCore Browser
- Image generation via Nova Canvas / SageMaker SDXL
- Persistent memory via AgentCore Memory
- Conversation history with compression
- File I/O between local filesystem and sandbox

## Strategic Direction

Evolve from a single-agent tool into a multi-agent system optimized for high-profile keynote content creation and review. Adopt the Strands Agents TypeScript SDK with the Graph pattern for orchestrated, iterative workflows.

---

## Tier 1: High-Impact — Directly Serves Keynote Workflows

### 1. Multi-Pass Content Review Pipeline
**Priority: Highest**

The biggest gap today. Users get one-shot analysis. Keynotes need iterative refinement.

- Draft → Review for clarity → Review for messaging consistency → Review for audience impact → Final polish
- Each pass has different evaluation criteria
- Validation loop iterates until quality thresholds are met
- Architecture: Strands Graph pattern with cycle support

**Existing assets:** AgentToolExecutor's Converse loop, conversation history, memory context
**New work:** Define review agents, quality scoring, graph orchestration

### 2. Style Guide / Brand Voice Enforcement
**Priority: Highest (pairs with #1)**

Keynote teams have specific messaging guidelines, tone, terminology, and phrases to avoid.

- Load a style guide document via read_local_file
- Validate all generated content against it
- Flag deviations and suggest corrections
- Becomes a reusable validator node in the multi-agent pipeline

**Existing assets:** read_local_file tool, Knowledge Base integration
**New work:** Style guide agent prompt, scoring rubric, integration as graph validator node

### 3. Comparative Analysis Across Transcripts
**Priority: High**

Keynote prep involves reviewing multiple past talks.

- Load multiple transcripts simultaneously
- Cross-reference themes, messaging evolution, repeated talking points
- Identify gaps: "You covered X at re:Invent but haven't addressed it since"
- Research/synthesis task that benefits from a dedicated agent

**Existing assets:** Transcribe integration, Knowledge Base, memory
**New work:** Multi-document ingestion, comparison agent, timeline analysis

### 4. Slide Deck Generation from Transcript
**Priority: High**

The pptx skill exists but the workflow is manual. Automate the full pipeline:

- Transcript → Extract key messages → Generate slide outline → Create deck with AI-generated visuals
- Each step is a natural agent boundary:
  - Analyst agent → Outline Architect agent → Slide Builder agent → Image Generator agent

**Existing assets:** pptx skill, generate_image tool, execute_code tool
**New work:** Pipeline orchestration, outline generation agent, visual direction agent

---

## Tier 2: Force Multipliers

### 5. Knowledge Base as Institutional Memory
**Priority: Medium-High**

KB integration exists in the Analyze tab but is optional. For keynote teams it should be central.

- Auto-ingest every transcript and analysis into a KB
- "What did we say about generative AI at the last 3 keynotes?" becomes a one-click query
- Prevents contradicting previous public statements

**Existing assets:** KB integration in Analyze tab, memory manager
**New work:** Auto-ingestion pipeline, KB management UI, consistency checking

### 6. Real-Time Fact Checking Agent
**Priority: Medium**

Keynotes can't have factual errors.

- Extract factual claims from draft content or transcript (numbers, dates, product names, features)
- Cross-reference against web sources and KB
- Flag anything unverifiable or potentially outdated

**Existing assets:** web browsing tool, Knowledge Base
**New work:** Claim extraction logic, verification agent, confidence scoring

### 7. Audience-Aware Content Adaptation
**Priority: Medium**

Same keynote content often needs adaptation for different audiences.

- Takes a transcript or draft
- Rewrites for a specified audience persona (technical vs. executive vs. press)
- Adjusts technical depth, jargon, and emphasis

**Existing assets:** Bedrock models, prompt templates
**New work:** Audience persona definitions, adaptation agent, A/B comparison view

---

## Tier 3: Polish & Scale

### 8. Export Pipeline
One-click generation of the full keynote package: transcript + summary + slide deck + speaker notes + social media snippets.

### 9. Collaboration Features
Multiple users reviewing the same content, with the agent tracking and reconciling feedback.

### 10. Rehearsal Coach
Analyze delivery patterns from audio (pace, filler words, emphasis) using Transcribe's detailed output.

---

## Architecture: How Current Capabilities Map to Multi-Agent System

| Current Capability | Role in Multi-Agent System |
|---|---|
| `execute_code` + skills (pptx/docx/xlsx) | Document Builder agent |
| `web` browsing | Research agent, Fact Checker agent |
| `generate_image` | Visual Content agent (called by Document Builder) |
| `MemoryManager` | Shared context across all agents, institutional memory |
| Transcribe integration | Input pipeline — feeds content to all downstream agents |
| `read_local_file` / `save_file_locally` | I/O layer shared across agents |
| Knowledge Base integration | Fact checking, consistency checking, institutional memory |

## Technology Decision

- **Framework:** Strands Agents TypeScript SDK (`@strands-agents/sdk`)
- **Multi-agent pattern:** Graph (supports cycles for iterative review) + Agents-as-Tools (orchestrator delegates to specialists)
- **Note:** TypeScript SDK is experimental — monitor for breaking changes
- **Migration strategy:** Incremental — add Strands alongside existing AgentToolExecutor, migrate gradually

## Recommended Starting Point

Build **#1 + #2 combined**: a multi-pass content review pipeline with style guide enforcement. This:
- Most directly improves keynote quality
- Naturally requires multi-agent coordination (writer → reviewer → validator → iterate)
- Establishes the architectural foundation (Strands Graph pattern) that everything else builds on
