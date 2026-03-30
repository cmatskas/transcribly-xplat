---
name: demo-storyboard
description: "Plan and structure product demo storyboards. Use when creating demo videos, product walkthroughs, or feature showcases that need scene-by-scene planning with narration, callouts, and timing."
metadata:
  provider: custom
  version: "1.0"
---

# Demo Storyboard Framework

Transform product features into compelling visual narratives. Every demo tells a story: a problem exists, a solution appears, proof validates it, and the viewer knows what to do next.

## Demo Narrative Arc

Follow this structure for every demo storyboard:

1. **Hook** (5-10s) — Open with the pain point or outcome. Never open with "Today I'm going to show you..."
2. **Context** (10-15s) — Set the scene: who has this problem, why it matters, what's at stake
3. **Solution Reveal** (varies) — Show the product solving the problem. This is the core — multiple scenes.
4. **Proof Point** (10-15s) — Customer reference, metric, or before/after comparison
5. **Call to Action** (5-10s) — What should the viewer do next? Be specific.

## Scene Card Format

Every scene MUST use this exact structure:

```
SCENE [N]: [Descriptive Title]
Duration: [X seconds]
Visual: [Exactly what's on screen — screenshot region, live product view, diagram, animation]
Callouts: [Specific annotations — "Arrow pointing to the Create button", "Zoom 2x on the metrics panel", "Blur the sidebar, highlight the main content"]
Narration: "[Exact spoken words in quotes — conversational, not scripted]"
On-screen text: [Any overlay captions, labels, or titles]
Transition: [Cut / Crossfade / Zoom-in / Pan-right / Match-cut to next scene]
Emotional beat: [What the viewer should feel — curious, impressed, relieved, motivated]
```

## Demo-Specific Rules

### Content Rules
- **Lead with outcome, not feature.** "You can deploy in 3 clicks" not "The deployment feature supports..."
- **Show the 'before' pain** before the 'after' solution — contrast drives impact
- **Every feature needs a 'so what' moment** — explicitly state why the viewer should care
- **Use real or realistic data** — never lorem ipsum, never "Acme Corp", never obviously fake numbers
- **Keep scenes under 30 seconds** — if a scene runs longer, split it. Attention resets at visual changes.
- **Callout the click path** — "Click the orange 'Create' button in the top-right corner" not "Click Create"

### Visual Rules
- **One focus per scene** — don't show three features in one scene
- **Specify zoom levels** — "Zoom 2x on the response time graph" not "highlight the graph"
- **Blur distractions** — if showing a console, blur irrelevant panels
- **Annotate with arrows and boxes** — specify color, position, and what they point to
- **Include cursor position** — "Cursor moves from sidebar to the main 'Deploy' button"

### Narration Rules
- **Conversational tone** — write for speaking, not reading. Short sentences. Natural pauses.
- **No filler phrases** — cut "as you can see", "basically", "simply", "just"
- **Name what you're showing** — "Watch the latency drop from 200ms to 12ms" not "Notice the improvement"
- **Pause after reveals** — mark with [PAUSE 2s] after impressive moments. Let it land.
- **Address the viewer directly** — "You" not "users" or "one"

## AWS Demo Guidelines

- Use **AWS console screenshots** where applicable — real UI, not mockups
- Reference **AWS service names** correctly: "Amazon Bedrock" not "AWS Bedrock"
- Include **architecture diagrams** for technical demos using AWS icons
- Customer references follow the standard AWS sourcing rules:
  - Only publicly available references (aws.amazon.com/solutions/case-studies)
  - Insert `[CUSTOMER REFERENCE NEEDED: industry/use-case]` for missing proof points
  - No competitor product mentions
- For cost/performance claims, cite **public benchmarks or AWS documentation**

## Storyboard Document Structure

The final storyboard should include:

1. **Header**: Demo title, target audience, total duration, key message
2. **Scene cards**: Numbered sequence using the format above
3. **Production notes**: Equipment needed, screen resolution, any pre-recording setup
4. **Asset checklist**: Screenshots to capture, diagrams to create, data to prepare
5. **Review checklist**: Verify all callouts are specific, all narration is speakable, all transitions are defined
