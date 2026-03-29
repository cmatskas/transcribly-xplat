---
name: research-first
description: "Research and investigate before implementing. Use when the user asks to build something unfamiliar, compare options, find best practices, or when the task involves external APIs, libraries, or domains you're uncertain about."
metadata:
  provider: agentcore-browser
  version: "1.0"
---

# Research-First Protocol

Before implementing, investigate the domain to make informed decisions.

## When to Research

- User asks about a topic, API, or library you're uncertain about
- Task involves external services or integrations
- Multiple valid approaches exist and the best choice isn't obvious
- User explicitly asks to "look into", "research", or "find out about" something

## Research Workflow

### 1. Search Phase

Use the `web` tool with targeted queries:
- `"<topic> best practices 2025"` for current guidance
- `"<library> vs <alternative> comparison"` for trade-off analysis
- `"<API> documentation quickstart"` for integration tasks
- `site:reddit.com <topic>` for real-world developer experiences

### 2. Deep-Read Phase

From search results, open the 2-3 most relevant URLs to read full content:
- Official documentation over blog posts
- Recent content over old content
- Practical examples over theoretical explanations

### 3. Synthesize

Before implementing, present a brief summary:
```
Approach: [chosen approach]
Why: [1-2 sentence justification]
Alternative: [what was considered and why it was rejected]
```

### 4. Implement with Confidence

Now execute with the knowledge gathered.

## Research Depth Levels

**Quick (1-2 searches):** Known library, confirming syntax or version.
**Standard (3-5 searches + 2-3 page reads):** Choosing between options, new integration.
**Deep (5+ searches + multiple reads):** Architectural decision, novel problem domain.

## Critical Rules

- Always cite sources when presenting research findings
- Prefer official documentation over third-party blogs
- If research reveals the user's approach won't work, say so before implementing
- Don't over-research simple tasks — if you already know the answer, just do it
