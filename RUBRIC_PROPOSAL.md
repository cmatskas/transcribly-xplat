# Quality Rubrics for Transcribely Swarm Pipelines

## Research & Implementation Proposal

---

## 1. What Karpathy's autoresearch Actually Does

autoresearch is deceptively simple: one agent, one file, one metric (`val_bpb`), one loop. The agent modifies `train.py`, runs a 5-minute training experiment, checks if the metric improved, keeps or discards, and repeats indefinitely. The "rubric" is `program.md` — a markdown skill file that tells the agent what to optimize, how to log results, and when to keep vs. discard.

The key insight isn't the ML training — it's the **evaluation loop pattern**:

```
LOOP:
  1. Produce output (modify train.py)
  2. Evaluate against fixed metric (val_bpb)
  3. Binary decision: keep (improved) or discard (worse/equal)
  4. Log results with structured metadata
  5. Advance or revert
```

This is a **scalar quality gate** — one number decides everything. It works because ML training has a clean, objective metric. Content creation doesn't.

## 2. Why Our Current Quality Gates Are Weak

Our swarm quality gates today are essentially vibes-based. The quality gate agent gets the `copy-editing` skill and a prompt like:

> "Check: (1) addresses the brief, (2) free of all 22 AI slop patterns, (3) specific not generic, (4) right length/depth. If ALL pass: PASS. If ANY fail: REVISE: then feedback."

Problems with this approach:

1. **No structured scoring** — the gate produces a binary PASS/REVISE with free-text feedback. There's no way to track *how close* something is to passing, whether quality is improving across retries, or which dimensions are weak.

2. **No weighted criteria** — "addresses the brief" and "free of slop patterns" are treated equally. In practice, a speech that nails the brief but has two instances of "delve" is far better than one that's slop-free but misses the audience entirely.

3. **No persistence of evaluation data** — when a quality gate fires REVISE, the feedback goes to the previous agent as free text. There's no structured record of what scored well vs. poorly. If the revision still fails, we have no way to compare the two attempts.

4. **Max retries is a blunt instrument** — we retry up to 2 times, then pass through regardless. There's no concept of "good enough" vs. "fundamentally broken." A piece that scores 85/100 should pass; one that scores 30/100 should not, even after retries.

5. **No per-template calibration** — the same quality gate logic applies to articles, keynotes, and speeches, but these have fundamentally different quality criteria. A keynote needs scannable slides and narrative arc; a speech needs speakability and emotional pacing; an article needs depth and sourcing.

## 3. The Agentic Rubrics Model (Scale AI Research)

The "Agentic Rubrics" paper from Scale AI (arxiv 2601.04171) provides the academic foundation for what we need. Their approach for SWE patch verification:

1. **Rubric Generation Phase**: An expert agent explores the context (repository) and produces a structured `rubrics.yaml` with criteria organized along axes:
   - File Change (scope)
   - Spec Alignment (requirements)
   - Integrity (no-cheating)
   - Runtime (behavior)

2. **Rubric Grading Phase**: A judge model scores each criterion as binary (pass/fail) with importance weights (1=nice-to-have, 2=important, 3=must-have). Final score: `S = Σ(wi × si) / Σ(wi)` yielding a normalized 0-1 score.

3. **Key findings**:
   - Rubric scores have 0.886 ROC-AUC against ground-truth test pass/fail
   - 78% of rubric judgments are high-utility when they agree with tests
   - 54% are high-utility even when they *disagree* (catching issues tests miss)
   - Rubric generation is cheap ($0.245/instance vs $0.640 for patch similarity)
   - Judge model capability matters less than rubric quality — even GPT-5-mini scores well against expert rubrics
   - Only 2% flakiness when rubrics are atomic and self-contained

## 4. Proposed Rubric System for Transcribely

### 4.1 Architecture: Two-Phase Evaluation

Adapt the autoresearch keep/discard loop and the Agentic Rubrics scoring into our quality gates:

```
Quality Gate Agent receives:
  - The content to evaluate
  - A rubric template (per pipeline type)
  - The original brief

Quality Gate Agent produces:
  - Per-criterion scores (0 or 1) with weights
  - Aggregate weighted score (0.0 - 1.0)
  - Structured feedback keyed to failing criteria
  - Decision: PASS (score >= threshold) or REVISE (score < threshold)
```

### 4.2 Rubric Axes for Content (Adapted from SWE Axes)

| SWE Axis | Content Equivalent | What It Checks |
|---|---|---|
| File Change (scope) | **Scope Alignment** | Covers the brief completely, right length/depth, no scope creep |
| Spec Alignment | **Brief Fidelity** | Audience match, tone match, key points addressed, format requirements met |
| Integrity | **Authenticity** | No AI slop (the 22 patterns), no filler, no hedging, no generic statements |
| Runtime | **Craft Quality** | Structure/flow, transitions, evidence quality, emotional arc (speeches), scannability (slides) |

### 4.3 Per-Template Rubric Definitions

Each pipeline template gets its own rubric with criteria tuned to the content type. Positive criteria have weights 1-3 (matching Scale AI model). Penalty criteria have negative weights and subtract from the score when triggered — this counteracts the sycophantic bias documented in the Autorubric paper where LLM judges try hard to score positive criteria as MET. Binary-only criteria throughout, validated by Autorubric's CHARM-100 evaluation showing 87% accuracy for binary vs. 38-58% for ordinal.

**Article Rubric (14 criteria: 11 positive, 3 penalties)**
```yaml
scope_alignment:
  - text: "Covers all key points from the brief"
    weight: 3
  - text: "Within ±20% of target word count"
    weight: 1
  - text: "No off-topic tangents or scope creep"
    weight: 1

brief_fidelity:
  - text: "Matches specified audience level and tone"
    weight: 3
  - text: "Includes specific data/statistics from research"
    weight: 2
  - text: "All claims supported by cited sources"
    weight: 2

authenticity:  # penalty criteria — subtract when triggered
  - text: "Contains Tier 1 AI vocabulary (delve, tapestry, landscape, etc.)"
    weight: -3
  - text: "Contains hedge-stacking or weasel phrases"
    weight: -2
  - text: "Specific examples, not generic platitudes"
    weight: 2

craft_quality:
  - text: "Strong opening hook that earns the next paragraph"
    weight: 2
  - text: "Logical section flow with clear transitions"
    weight: 2
  - text: "Conclusion adds value (not just summary)"
    weight: 1

penalties:
  - text: "Contains filler paragraphs that could be deleted without losing meaning"
    weight: -2
```

**Keynote Rubric (14 criteria: 11 positive, 3 penalties)**
```yaml
scope_alignment:
  - text: "Covers the core message from the brief"
    weight: 3
  - text: "Appropriate slide count for time slot"
    weight: 2
    canBeNA: true  # if user didn't specify time slot
  - text: "Each slide has one clear takeaway"
    weight: 2

brief_fidelity:
  - text: "Audience-appropriate complexity level"
    weight: 3
  - text: "Key data points from research included"
    weight: 2
  - text: "Call to action aligned with brief's goal"
    weight: 2

authenticity:
  - text: "Contains Tier 1 AI vocabulary"
    weight: -3
  - text: "Slide text is scannable (not paragraphs)"
    weight: 2
  - text: "Preserves intentional rhetorical devices"
    weight: 1

craft_quality:
  - text: "Clear narrative arc across slides"
    weight: 3
  - text: "Speaker notes are conversational, not read-aloud prose"
    weight: 2
  - text: "Transitions between slides feel natural"
    weight: 1

penalties:
  - text: "Contains slides that are just walls of text"
    weight: -2
  - text: "Speaker notes read like an essay, not spoken delivery"
    weight: -1
```

**Speech Rubric (14 criteria: 11 positive, 3 penalties)**
```yaml
scope_alignment:
  - text: "Addresses the core topic from the brief"
    weight: 3
  - text: "Fits target duration (timing marks add up)"
    weight: 2
    canBeNA: true  # if user didn't specify duration
  - text: "Opening and closing are connected (callback)"
    weight: 2

brief_fidelity:
  - text: "Audience-appropriate language and references"
    weight: 3
  - text: "Emotional register matches brief's intent"
    weight: 3
  - text: "Key message is unmistakable"
    weight: 2

authenticity:
  - text: "Contains Tier 1 AI vocabulary"
    weight: -2  # lighter penalty — creative register
  - text: "Sounds natural when read aloud"
    weight: 3
  - text: "Preserves rhetorical craft (anaphora, tricolon, etc.)"
    weight: 1

craft_quality:
  - text: "Emotional arc builds and resolves"
    weight: 3
  - text: "Varied sentence rhythm (short punchy + longer flowing)"
    weight: 2
  - text: "Stage directions are practical and specific"
    weight: 1

penalties:
  - text: "Contains passages that sound written, not spoken"
    weight: -2
  - text: "Contains generic motivational filler (believe in yourself, etc.)"
    weight: -1
```

### 4.4 Scoring & Decision Logic

Adapted from Autorubric's Equation 1 with penalty support and clamping:

```
score = max(0, min(1, Σ(weight_i × score_i) / Σ(positive_weights)))

Where:
  - Positive criteria: score_i = 1 (MET) or 0 (UNMET)
  - Penalty criteria: score_i = 1 (triggered, SUBTRACTS) or 0 (not triggered, no effect)
  - CANNOT_ASSESS: criterion excluded from both numerator and denominator (SKIP strategy)
  - Clamped to [0, 1] — penalties can push below 0 but final score floors at 0

threshold = 0.75  (configurable per template)
min_pass   = 0.60  (absolute floor — below this, never pass)

if score >= threshold:
  decision = PASS
elif attempts >= maxRetries:
  if score >= min_pass:
    decision = PASS_WITH_RESERVATIONS  (log warning, continue)
  else:
    decision = FAIL  (stop pipeline, show user what went wrong)
else:
  decision = REVISE  (send structured feedback to previous agent)
```

This replaces the current binary PASS/REVISE with a three-tier system that prevents garbage from passing through just because retries were exhausted.

### 4.5 Structured Feedback Format

Instead of free-text feedback, the quality gate returns:

```json
{
  "score": 0.68,
  "threshold": 0.75,
  "decision": "REVISE",
  "axis_scores": {
    "scope_alignment": 0.85,
    "brief_fidelity": 0.70,
    "authenticity": 0.45,
    "craft_quality": 0.75
  },
  "failing_criteria": [
    { "axis": "authenticity", "text": "Zero Tier 1 AI vocabulary", "weight": 3, "feedback": "Found 'delve' (para 3), 'tapestry' (para 7), 'landscape' (para 12)" },
    { "axis": "authenticity", "text": "No hedge-stacking", "weight": 2, "feedback": "Para 5 has 'it could potentially perhaps be argued that' — pick a position" }
  ],
  "passing_criteria_count": 10,
  "total_criteria_count": 12
}
```

The previous agent (writer/editor) receives only the `failing_criteria` array as targeted revision instructions, not the full evaluation. This is more actionable than "REVISE: found some AI patterns, please fix."

## 5. Implementation Impact on Existing Code

### 5.1 What Changes

**`pipelineTemplates.js`** — Each template gets a `rubric` object alongside its agents:
```javascript
article: {
  id: 'article',
  rubric: { threshold: 0.75, minPass: 0.60, criteria: [...] },
  agents: [...]
}
```

**`swarmOrchestrator.js`** — The quality gate loop changes from string-parsing PASS/REVISE to JSON-parsing the structured evaluation:
- Quality gate agent prompt includes the rubric criteria
- Agent outputs JSON with per-criterion scores
- Orchestrator parses the JSON, computes weighted score, makes decision
- Structured feedback sent to previous agent on REVISE
- Score history tracked in checkpoint state for observability

**Quality gate agent prompt** changes from:
> "If ALL pass: PASS. If ANY fail: REVISE:"

To:
> "Evaluate against each criterion. For each, score 0 (fail) or 1 (pass). Output a JSON object with `criteria_scores` (array of {criterion_index, score, feedback?}). Do not output PASS or REVISE — the system will decide based on your scores."

**New: `rubricEvaluator.js`** — Pure function that takes criteria + scores and returns the decision object. Keeps scoring logic out of the orchestrator and makes it testable.

### 5.2 What Doesn't Change

- Pipeline structure (agents, edges, skills) — unchanged
- Strands SDK usage — unchanged
- IPC events — unchanged (quality gate still emits agent-started/done/chunk)
- Checkpoint format — extended but backward-compatible (adds `rubric_scores` to state)
- UI — the stepper, output accordion, and error handling all work as-is

### 5.3 Migration Path

The rubric system is additive. Templates without a `rubric` property fall back to the current string-parsing PASS/REVISE behavior. This means:
1. Add `rubricEvaluator.js` and rubric definitions
2. Update orchestrator to check for rubric, use new path if present
3. Update quality gate prompts in templates one at a time
4. Old behavior preserved for any template that hasn't been migrated

## 6. Pros and Cons

### Pros

1. **Quantitative quality tracking** — scores across retries show whether revisions are actually improving. Currently we have no idea if attempt 2 is better than attempt 1.

2. **Weighted priorities** — "addresses the brief" (weight 3) matters more than "within word count" (weight 1). The current system treats all criteria equally.

3. **Targeted revision feedback** — agents get specific failing criteria with examples, not vague "please fix the slop." The Scale AI paper shows this is the key to effective iteration.

4. **Prevents garbage passthrough** — the `min_pass` floor means truly bad content doesn't pass just because retries ran out. Currently, after 2 failed retries, anything passes.

5. **Per-template calibration** — speeches are evaluated on speakability and emotional arc; articles on sourcing and depth. The current system uses the same vague checklist for everything.

6. **Observability** — structured scores in checkpoints let you see exactly why a pipeline produced what it did. Useful for debugging and improving rubrics over time.

7. **Tone-aware by design** — the authenticity axis can be calibrated per register (aggressive for technical, lightest for inspirational), matching our existing copy-editing skill's tone calibration.

8. **Cheap to evaluate** — the Scale AI paper shows rubric grading is the cheapest agentic verification method ($0.245 vs $0.640). Our quality gates already use Opus; the rubric just makes the prompt more structured, not more expensive.

### Cons

1. **JSON parsing fragility** — LLMs sometimes produce malformed JSON. Mitigation: tolerant parsing with fallback to current string-based PASS/REVISE if JSON extraction fails.

2. **Rubric maintenance burden** — 12 criteria × 3 templates = 36 criteria to maintain. If we add more templates, this grows. Mitigation: share common criteria across templates (authenticity axis is identical for all three).

3. **Over-specification risk** — the Scale AI paper found 22% of rubric judgments are low-utility (over-specified, redundant, style nits). Our rubrics could reject good content for pedantic reasons. Mitigation: keep criteria atomic and outcome-focused, not implementation-prescriptive. "Zero Tier 1 AI vocabulary" is good; "Must use Oxford comma" is over-specified.

4. **Score gaming** — a sufficiently capable model could learn to satisfy rubric criteria superficially without genuine quality improvement. Mitigation: criteria should test outcomes ("sounds natural when read aloud") not surface features ("sentences average 15 words").

5. **Threshold tuning** — 0.75 is a guess. Too high = constant revisions burning tokens. Too low = garbage passes. Mitigation: start at 0.75, log all scores, adjust based on real pipeline runs. The checkpoint data makes this easy.

6. **Added complexity** — one more file (`rubricEvaluator.js`), structured prompts, JSON parsing. The current system is simpler. Mitigation: the evaluator is a pure function (~40 lines), and the migration is backward-compatible.

## 7. Comparison: autoresearch vs. Our Approach

| Dimension | autoresearch | Transcribely Rubrics |
|---|---|---|
| Metric type | Scalar (val_bpb) | Multi-dimensional (12 criteria → weighted score) |
| Evaluation | Deterministic (run code, measure loss) | LLM-as-judge (subjective but structured) |
| Keep/discard | Binary (improved or not) | Three-tier (PASS / REVISE / FAIL) |
| Feedback loop | None — just try something different | Structured — failing criteria sent back |
| Rubric source | Fixed (`program.md`) | Per-template, extensible |
| Iteration speed | ~5 min/experiment | ~30-60 sec/quality gate evaluation |
| Human oversight | Wake up to results log | Review panel at checkpoints + score history |

The fundamental difference: autoresearch has an objective metric (lower loss = better), so it can run indefinitely without human judgment. Content quality is inherently subjective, so our rubrics encode *human judgment criteria* that an LLM evaluates on our behalf. The rubric is the bridge between "let the AI decide" and "I'll review everything myself."

## 8. Recommended Implementation Order

1. **Create `rubricEvaluator.js`** — pure scoring function, fully testable
2. **Add rubric definitions to article template** — start with one template
3. **Update orchestrator quality gate path** — JSON parsing with string fallback
4. **Run article pipeline end-to-end** — tune threshold based on real scores
5. **Add rubrics to keynote and speech templates** — reuse shared criteria
6. **Add score display to swarm UI** — show axis scores in the output accordion
7. **Log rubric scores to checkpoint state** — enables post-hoc analysis

Steps 1-3 are the core implementation (~200 lines of code). Steps 4-7 are iteration and polish.

---

*This proposal adapts the autoresearch experiment loop pattern and the Scale AI Agentic Rubrics research into a practical quality evaluation system for Transcribely's multi-agent content pipelines. The approach is backward-compatible, incrementally adoptable, and designed to make quality gates actually meaningful rather than ceremonial.*
