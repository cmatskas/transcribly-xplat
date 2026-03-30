# Swarm Pipeline Resume — Implementation Plan

## Problem

When a swarm pipeline fails mid-execution (credential expiry, tool error, app crash, user cancel), all progress is lost. The user must restart from scratch, re-running agents that already completed successfully. This wastes tokens, time, and money — a 7-agent keynote pipeline can take 15+ minutes and cost several dollars in API calls.

## Current State

Checkpoint files already exist on disk:
```
~/Library/Application Support/Transcribely/swarm-runs/
  swarm-1774830155311/
    state.json              # pipeline metadata, retries, status
    agent-0-output.md       # researcher output
    agent-1-output.md       # planner output
    agent-2-output.md       # quality gate output
    ...                     # (missing = agent didn't complete)
```

The orchestrator loop already skips agents with checkpoint files. But there's no way to trigger a resume — every run generates a fresh `swarmId` and never finds old checkpoints.

## Design: Local File-Based Resume

Yes, local files. No database, no server state. The checkpoint directory IS the resume state.

### How It Works

1. **On pipeline failure/cancel**: State is already saved to disk (this works today)

2. **Swarm page shows incomplete runs**: On load, scan `swarm-runs/` for directories where `state.json` has `status: "error"` or `status: "cancelled"`. Display them as resumable cards above the template selector.

3. **User clicks "Resume"**: Pass the existing `swarmId` to `runPipeline`. The orchestrator loop starts from agent 0, finds checkpoint files for completed agents, skips them (emitting done events so the UI rebuilds), and picks up at the first agent without a checkpoint.

4. **Fresh credentials**: Since we now create a fresh orchestrator per run, the resumed pipeline uses current credentials — solving the expiry problem.

### What the UI Shows

```
┌─────────────────────────────────────────────────────────┐
│  ⚠️  Incomplete Run — Keynote / Presentation            │
│  Started: 29 Mar 2026, 9:45 PM                          │
│  Progress: 5/7 agents completed                         │
│  Failed at: Slide Creator — Code execution error        │
│                                                          │
│  [Resume]  [Discard]                                     │
└─────────────────────────────────────────────────────────┘
```

### Changes Required

#### 1. `state.json` — Save more context (orchestrator already does most of this)

Add to persisted state:
- `templateId` — which template was used
- `brief` — the original prompt
- `autonomyMode` — guided/autonomous
- `startedAt` — timestamp
- `failedAt` — which agent failed and why

Currently missing: `templateId`, `brief`, `autonomyMode`, `startedAt` are not saved. The state only has `retries` and agent statuses.

**File: `swarmOrchestrator.js`** — Save full context in `state.json`

#### 2. New IPC: `swarm-get-incomplete-runs`

Scan `swarm-runs/` directories, read each `state.json`, return array of resumable runs with:
- `swarmId`
- `templateId`, `templateName`
- `brief` (truncated for display)
- `startedAt`
- `completedAgents` / `totalAgents`
- `failureReason`

**File: `main.js`** — New IPC handler

#### 3. New IPC: `swarm-discard-run`

Delete the `swarm-runs/<swarmId>/` directory.

**File: `main.js`** — New IPC handler

#### 4. Resume via existing `swarm-run-pipeline`

Modify the handler to accept an optional `swarmId` parameter. If provided, resume that run instead of creating a new one. The orchestrator already handles checkpoint skipping — we just need to pass the old `swarmId` and reload the brief/template from `state.json`.

**File: `main.js`** — Modify existing IPC handler

#### 5. Swarm UI — Incomplete runs section

On page load (in `init()`), call `swarm-get-incomplete-runs`. If any exist, render resumable cards above the template grid. Each card has Resume and Discard buttons.

**File: `swarmTab.js`** — Add to `init()` and add resume/discard handlers

#### 6. Preload — New IPC channels

Add `swarm-get-incomplete-runs` and `swarm-discard-run` to allowed channels.

**File: `preload.js`**

### Files Changed

| File | Change |
|---|---|
| `swarmOrchestrator.js` | Save `templateId`, `brief`, `autonomyMode`, `startedAt`, `failureReason` to `state.json` |
| `main.js` | Add `swarm-get-incomplete-runs` and `swarm-discard-run` IPC handlers. Modify `swarm-run-pipeline` to accept optional `swarmId` for resume. |
| `swarmTab.js` | Load and display incomplete runs on init. Resume and Discard button handlers. |
| `preload.js` | Add 2 new IPC channels to allowlist |
| `index.html` | Add `swarmIncompleteRuns` container div above template grid |

### What Doesn't Change

- Checkpoint file format (already correct)
- Orchestrator resume loop (already skips completed agents)
- Pipeline templates
- Rubric evaluation
- Skills

### Edge Cases

- **Credentials expired**: Fresh orchestrator per run handles this — resume uses current credentials
- **Template changed since failure**: Compare `templateId` + agent count. If mismatch, mark run as non-resumable (discard only)
- **Partial quality gate revision**: If the app crashed during a revision loop, the checkpoint has the pre-revision output. Resume re-runs the quality gate, which will re-evaluate and potentially re-trigger revision. This is correct behavior — better to re-evaluate than skip.
- **Stale runs**: Runs older than 7 days should auto-discard (checkpoints may reference expired sandbox sessions)
- **Multiple incomplete runs**: Show all, sorted by most recent first

### Cost Savings

A typical keynote pipeline:
- Researcher: ~$0.50 (web browsing + Sonnet)
- Planner: ~$0.30 (Sonnet)
- Quality Gate 1: ~$0.40 (Opus)
- Writer: ~$1.50 (Opus, long output)
- Editor: ~$0.80 (Sonnet, long input)
- Quality Gate 2: ~$0.40 (Opus)
- Formatter: ~$0.30 (Haiku + code interpreter)

If the Formatter fails (tool error), resume saves ~$3.90 by skipping the first 6 agents. That's 90% of the pipeline cost.
