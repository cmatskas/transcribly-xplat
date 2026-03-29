---
name: task-planner
description: "Structured task decomposition for complex multi-step requests. Use when the user asks for something that requires multiple steps, file generation, data processing pipelines, or any task with dependencies between steps."
metadata:
  provider: agentcore-code-interpreter
  version: "1.0"
---

# Structured Task Decomposition

When given a complex task, decompose it before executing.

## Process

### 1. Goal-Backward Analysis

Before writing any code, state what must be TRUE for the task to be complete:

```
Goal: [user's request restated as an outcome]
Truths:
- Truth 1: [observable result from user's perspective]
- Truth 2: [another observable result]
- Truth 3: ...
```

### 2. Decompose into Atomic Steps

Break the work into 2-5 steps. For each step:

```
Step N: [action-oriented name]
  Needs: [what must exist before this runs]
  Creates: [what this produces]
  Verify: [how to confirm it worked]
```

### 3. Execute Sequentially with Verification

- Execute each step one at a time
- After each step, verify the output before proceeding
- If verification fails, diagnose and retry (max 3 attempts) before moving on
- Track what was completed for the final summary

### 4. Completion Checklist

Before giving your final response, verify:
- [ ] Every truth from step 1 is satisfied
- [ ] Every generated file has been saved locally via save_file_locally
- [ ] User has been told the exact path of every saved file

## When to Use

- Requests involving 3+ files or outputs
- Data pipelines (fetch → transform → visualize → export)
- Document generation with research or data gathering
- Any task where later steps depend on earlier results

## When NOT to Use

- Simple single-step requests ("summarize this text")
- Direct Q&A
- Single file generation with no dependencies

## Critical Rules

- Never skip the decomposition step for complex tasks
- Always verify each step before proceeding to the next
- If a step fails 3 times, document the failure and continue with remaining steps
- Present the plan to the user briefly before executing (one sentence per step)
