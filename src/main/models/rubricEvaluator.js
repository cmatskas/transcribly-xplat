/**
 * Rubric Evaluator — scores quality gate output against structured criteria.
 *
 * Adapted from:
 * - Scale AI "Agentic Rubrics" (arxiv 2601.04171): weighted binary criteria, 4 axes
 * - Autorubric (arxiv 2603.00077): penalty criteria, CANNOT_ASSESS/SKIP, score clamping
 *
 * Score formula (Autorubric Eq. 1 with penalties):
 *   score = max(0, min(1, Σ(w_i × v_i) / Σ(positive_weights)))
 *   where v_i = 1 (MET) or 0 (UNMET), penalties subtract when triggered
 *   CANNOT_ASSESS criteria excluded from both numerator and denominator
 */

/**
 * @param {Array<{text: string, weight: number, canBeNA?: boolean}>} criteria
 * @param {Array<{criterion_index: number, score: number, reason?: string}>} scores
 * @param {{threshold?: number, minPass?: number}} options
 * @returns {{score: number, decision: string, axis_scores: Object, failing: Array, passing_count: number, total_assessed: number}}
 */
function evaluate(criteria, scores, { threshold = 0.75, minPass = 0.60 } = {}) {
  const scoreMap = new Map(scores.map(s => [s.criterion_index, s]));
  const axes = {};
  let numerator = 0;
  let positiveWeightSum = 0;
  const failing = [];

  for (let i = 0; i < criteria.length; i++) {
    const c = criteria[i];
    const s = scoreMap.get(i);

    // CANNOT_ASSESS / SKIP — exclude from both numerator and denominator
    if (!s || s.score === -1) continue;

    const axis = axisFor(c.text, criteria);
    if (!axes[axis]) axes[axis] = { num: 0, den: 0 };

    if (c.weight > 0) {
      positiveWeightSum += c.weight;
      axes[axis].den += c.weight;
      if (s.score === 1) {
        numerator += c.weight;
        axes[axis].num += c.weight;
      } else {
        failing.push({ axis, text: c.text, weight: c.weight, reason: s.reason || '' });
      }
    } else {
      // Penalty: subtracts when triggered (score === 1 means the bad thing was found)
      if (s.score === 1) {
        numerator += c.weight; // weight is negative, so this subtracts
        failing.push({ axis, text: c.text, weight: c.weight, reason: s.reason || '', isPenalty: true });
      }
    }
  }

  const raw = positiveWeightSum > 0 ? numerator / positiveWeightSum : 0;
  const score = Math.max(0, Math.min(1, raw));

  const axis_scores = {};
  for (const [k, v] of Object.entries(axes)) {
    axis_scores[k] = v.den > 0 ? Math.max(0, Math.min(1, v.num / v.den)) : 1;
  }

  const totalAssessed = criteria.filter((_, i) => scoreMap.has(i) && scoreMap.get(i).score !== -1).length;
  const passingCount = totalAssessed - failing.length;

  return { score, axis_scores, failing, passing_count: passingCount, total_assessed: totalAssessed };
}

/**
 * Decide PASS / REVISE / FAIL based on score and retry state.
 */
function decide(score, { threshold = 0.75, minPass = 0.60, attempt = 0, maxRetries = 2 } = {}) {
  if (score >= threshold) return 'PASS';
  if (attempt >= maxRetries) return score >= minPass ? 'PASS_WITH_RESERVATIONS' : 'FAIL';
  return 'REVISE';
}

/**
 * Build the quality gate prompt that asks the judge to evaluate against the rubric.
 */
function buildRubricPrompt(criteria, brief) {
  const lines = criteria.map((c, i) => {
    const type = c.weight < 0 ? 'PENALTY' : 'POSITIVE';
    const na = c.canBeNA ? ' (score -1 if not applicable)' : '';
    return `  ${i}: [${type}, weight ${c.weight}] "${c.text}"${na}`;
  });

  return `You are a quality evaluator. Score the content against each criterion below.

BRIEF: ${brief}

CRITERIA:
${lines.join('\n')}

For each criterion, output a JSON object with a "scores" array. Each element:
  { "criterion_index": <number>, "score": <0 or 1>, "reason": "<brief evidence>" }

For POSITIVE criteria: 1 = MET, 0 = UNMET.
For PENALTY criteria: 1 = the bad pattern WAS found, 0 = clean.
If a criterion is not applicable, use score: -1.

Output ONLY the JSON object, no other text. Example:
{"scores": [{"criterion_index": 0, "score": 1, "reason": "Covers all three topics from brief"}, ...]}`;
}

/** Infer axis name from criterion position in the rubric definition. */
function axisFor(text, criteria) {
  const idx = criteria.findIndex(c => c.text === text);
  const total = criteria.length;
  // Distribute criteria across 4 axes roughly evenly
  // In practice, templates define axes explicitly — this is the fallback
  const quarter = Math.floor(total / 4) || 1;
  if (idx < quarter) return 'scope_alignment';
  if (idx < quarter * 2) return 'brief_fidelity';
  if (idx < quarter * 3) return 'authenticity';
  return 'craft_quality';
}

/**
 * Parse the judge's JSON response, tolerant of markdown fences and partial output.
 */
function parseJudgeResponse(text) {
  // Strip markdown fences
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  // Find the JSON object
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return parsed.scores || null;
  } catch { return null; }
}

module.exports = { evaluate, decide, buildRubricPrompt, parseJudgeResponse };
