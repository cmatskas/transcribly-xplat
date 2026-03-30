# Multi-Agent "Swarm" Implementation Plan for Transcribely

## Architecture Decision: Strands TS SDK + Graph Pattern

### Why Strands Direct (Not Native-First)

The Strands Agents TypeScript SDK reached v1.0.0-rc.1 on March 26, 2026. The API surface is frozen for stable release. Building a native orchestrator to replace later is throwaway work. Strands provides:

- Graph and Swarm multi-agent patterns
- First-class Bedrock provider (our existing backend)
- Streaming support
- Per-agent model selection
- Tool isolation per agent via Zod schemas

The only custom code needed is the Electron IPC glue layer (~100 lines) and checkpoint persistence for long-running pipelines.

### Why Graph + Quality Gates (Not Swarm or Orchestrator)

Content creation is a **known pipeline** — research → plan → write → edit → format. The steps don't change at runtime. A Swarm's dynamic routing adds unpredictability for no benefit. A full Orchestrator agent running Opus for the entire pipeline is expensive.

**Graph with Quality Gates** gives deterministic execution with lightweight Opus evaluation at key junctures:

```
Research (Sonnet) → Plan (Sonnet) → QualityGate (Opus) → Write (Opus) → Edit (Sonnet) → QualityGate (Opus) → Format (Nova)
                                         ↑                                                      ↑
                                    loops back to                                          loops back to
                                    Plan if REVISE                                         Edit if REVISE
```

### Per-Agent Model Selection

| Agent Role | Model | Why | ~Cost |
|---|---|---|---|
| Researcher | Claude Sonnet 4.6 | Web browsing + synthesis within Sonnet's capability | $0.15-0.30 |
| Planner | Claude Sonnet 4.6 | Outline creation doesn't need Opus reasoning | $0.10-0.20 |
| Quality Gate | Claude Opus 4.6 | Evaluation requires strongest reasoning | $0.25-0.50 |
| Writer | Claude Opus 4.6 | Writing quality proportional to model capability | $0.80-1.50 |
| Editor | Claude Sonnet 4.6 | Pattern matching is Sonnet's sweet spot | $0.10-0.20 |
| Formatter | Nova Pro | Pure Python code generation — cheapest reliable option | $0.02-0.05 |

**Total: ~$1.50-3.00 per pipeline** (vs ~$4-6 all-Opus).

### Long-Running / Overnight Execution

Checkpoint-based persistence. After each agent completes, output is saved to disk:

```
~/.../swarm-runs/<swarmId>/
  state.json          ← { currentAgent: 2, status: 'running', autonomyMode: 'autonomous' }
  agent-0-output.md   ← Research brief (completed)
  agent-1-output.md   ← Outline (completed)
```

On crash/restart, the orchestrator resumes from the last completed checkpoint.

### Autonomy Spectrum

Three modes controlling when the pipeline pauses for user input:

| Mode | Review Points | Agent request_input (low/med risk) | Agent request_input (high risk) |
|---|---|---|---|
| Supervised | Pause | Pause | Pause |
| Guided | Pause | Auto-resolve with default | Pause |
| Autonomous | Skip | Auto-resolve with default | Auto-resolve with default |

Agents have a `request_input` tool they call when they encounter ambiguity. Each request includes a `risk_if_wrong` level and a `default_choice`. The orchestrator resolves based on the autonomy mode.

### Agent Input Request Tool

```javascript
request_input({
  question: "Technical audience — developers or engineering managers?",
  options: ["Developers", "Engineering managers", "Both"],
  default_choice: "Developers",
  risk_if_wrong: "medium"
})
```

In autonomous/guided mode for low/medium risk: auto-resolves with default, logs the decision. In supervised mode or high risk: pauses pipeline, shows UI prompt.

---

## Implementation

### Files to Create

| File | Purpose |
|---|---|
| `src/main/models/swarmOrchestrator.js` | Strands Graph wrapper + checkpoint persistence + IPC bridge |
| `src/main/models/pipelineTemplates.js` | Built-in pipeline configs (Article, Keynote, Speech) |
| `src/renderer/swarmTab.js` | Swarm tab UI |

### Files to Modify

| File | Changes |
|---|---|
| `package.json` | Add `@strands-agents/sdk` dependency |
| `main.js` | Add swarm IPC handlers |
| `preload.js` | Add swarm channels to allowlists |
| `src/pages/index.html` | Add Swarm nav item + page section |
| `src/renderer/index.js` | Add swarm to page navigation |
| `src/styles/main.css` | Pipeline stepper, template cards, review UI styles |

### Pipeline Templates

Three built-in templates:
1. **Article/Blog** — Research → Plan → QualityGate → Write → Edit → QualityGate → Format(docx)
2. **Keynote/Presentation** — Research → Plan → QualityGate → Write → Edit → QualityGate → Format(pptx)
3. **Speech/Talk** — Research → Plan → QualityGate → Write → Edit → QualityGate (no formatter)

### IPC Channels

```
Renderer → Main:
  swarm-run-pipeline, swarm-continue, swarm-cancel,
  swarm-answer-input, swarm-get-templates

Main → Renderer:
  swarm-agent-started, swarm-agent-chunk, swarm-agent-done,
  swarm-review-pause, swarm-input-request,
  swarm-pipeline-done, swarm-error
```
