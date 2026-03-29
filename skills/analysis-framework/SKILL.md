---
name: analysis-framework
description: "Structured analysis frameworks for documents, transcripts, and data. Use when the user asks for deep analysis, strategic review, comparison, evaluation, or any task requiring systematic reasoning rather than simple summarization."
metadata:
  provider: agentcore-code-interpreter
  version: "1.0"
---

# Structured Analysis Frameworks

Apply systematic reasoning frameworks to produce deeper, more actionable analysis.

## Framework Selection

Choose based on the user's request:

| Request Type | Framework |
|---|---|
| "Analyze this transcript/document" | Goal-Backward Analysis |
| "Compare these options" | Trade-Off Matrix |
| "What should we do about X?" | Decision Framework |
| "Review this for quality" | Multi-Dimension Audit |
| "Find insights in this data" | Pattern Extraction |

## Goal-Backward Analysis

Start from the desired outcome and work backward:

1. **State the goal** — What outcome does the user want?
2. **Derive truths** — What must be TRUE for that goal to be achieved?
3. **Map evidence** — For each truth, what evidence exists in the source material?
4. **Identify gaps** — Which truths lack supporting evidence?
5. **Recommend** — What actions close the gaps?

## Trade-Off Matrix

For comparison tasks:

1. **List criteria** — What dimensions matter? (cost, speed, quality, risk, etc.)
2. **Weight criteria** — Which matter most to this user?
3. **Score options** — Rate each option on each criterion
4. **Summarize** — Clear recommendation with reasoning

## Decision Framework

For "what should we do?" questions:

1. **Context** — What's the situation? What constraints exist?
2. **Options** — What are the realistic choices? (minimum 3)
3. **Consequences** — For each option: best case, worst case, most likely case
4. **Recommendation** — Which option and why, with confidence level

## Multi-Dimension Audit

For quality review tasks:

1. **Define dimensions** — What aspects to evaluate? (clarity, completeness, accuracy, actionability, etc.)
2. **Score each** — Rate 1-5 with specific evidence
3. **Strengths** — What's working well?
4. **Gaps** — What's missing or weak?
5. **Priorities** — Ranked list of improvements by impact

## Pattern Extraction

For data/transcript insight tasks:

1. **Themes** — What topics recur? Group by frequency
2. **Sentiment** — What's the emotional tone? Where does it shift?
3. **Outliers** — What's unexpected or contradictory?
4. **Connections** — What themes relate to each other?
5. **So what?** — What do these patterns mean for the user?

## Critical Rules

- Always state which framework you're using and why
- Use concrete evidence from the source material, not generic observations
- Quantify when possible (counts, percentages, scores)
- End every analysis with actionable recommendations
- If the source material is insufficient for deep analysis, say so explicitly
