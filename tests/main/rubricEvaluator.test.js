const { evaluate, decide, buildRubricPrompt, parseJudgeResponse } = require('../../src/main/models/rubricEvaluator');

describe('RubricEvaluator', () => {
  const criteria = [
    { text: 'Covers the brief', weight: 3 },
    { text: 'Good structure', weight: 2 },
    { text: 'Contains AI slop', weight: -3 },
    { text: 'Has filler', weight: -2 },
  ];

  describe('evaluate()', () => {
    test('perfect score — all positive MET, no penalties triggered', () => {
      const scores = [
        { criterion_index: 0, score: 1 },
        { criterion_index: 1, score: 1 },
        { criterion_index: 2, score: 0 },
        { criterion_index: 3, score: 0 },
      ];
      const result = evaluate(criteria, scores);
      expect(result.score).toBe(1.0);
      expect(result.failing).toHaveLength(0);
    });

    test('penalty triggered reduces score below 1', () => {
      const scores = [
        { criterion_index: 0, score: 1 },
        { criterion_index: 1, score: 1 },
        { criterion_index: 2, score: 1, reason: 'Found "delve"' }, // penalty triggered
        { criterion_index: 3, score: 0 },
      ];
      const result = evaluate(criteria, scores);
      // numerator: 3 + 2 + (-3) = 2, denominator: 5 → 0.4
      expect(result.score).toBeCloseTo(0.4);
      expect(result.failing).toHaveLength(1);
      expect(result.failing[0].isPenalty).toBe(true);
    });

    test('score clamps to 0 when penalties exceed positives', () => {
      const scores = [
        { criterion_index: 0, score: 0 },
        { criterion_index: 1, score: 0 },
        { criterion_index: 2, score: 1 },
        { criterion_index: 3, score: 1 },
      ];
      const result = evaluate(criteria, scores);
      // numerator: 0 + 0 + (-3) + (-2) = -5, denominator: 5 → -1 → clamped to 0
      expect(result.score).toBe(0);
    });

    test('CANNOT_ASSESS (score -1) excluded from calculation', () => {
      const scores = [
        { criterion_index: 0, score: 1 },
        { criterion_index: 1, score: -1 }, // N/A
        { criterion_index: 2, score: 0 },
        { criterion_index: 3, score: 0 },
      ];
      const result = evaluate(criteria, scores);
      // Only criterion 0 assessed as positive: 3/3 = 1.0
      expect(result.score).toBe(1.0);
      expect(result.total_assessed).toBe(3);
    });
  });

  describe('decide()', () => {
    test('PASS when score >= threshold', () => {
      expect(decide(0.80)).toBe('PASS');
    });

    test('REVISE when below threshold and retries remain', () => {
      expect(decide(0.60, { attempt: 0, maxRetries: 2 })).toBe('REVISE');
    });

    test('PASS_WITH_RESERVATIONS when retries exhausted but above minPass', () => {
      expect(decide(0.65, { attempt: 2, maxRetries: 2 })).toBe('PASS_WITH_RESERVATIONS');
    });

    test('FAIL when retries exhausted and below minPass', () => {
      expect(decide(0.40, { attempt: 2, maxRetries: 2 })).toBe('FAIL');
    });
  });

  describe('parseJudgeResponse()', () => {
    test('parses clean JSON', () => {
      const input = '{"scores": [{"criterion_index": 0, "score": 1, "reason": "good"}]}';
      const result = parseJudgeResponse(input);
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(1);
    });

    test('parses JSON wrapped in markdown fences', () => {
      const input = '```json\n{"scores": [{"criterion_index": 0, "score": 0}]}\n```';
      expect(parseJudgeResponse(input)).toHaveLength(1);
    });

    test('returns null for non-JSON', () => {
      expect(parseJudgeResponse('PASS the content looks great')).toBeNull();
    });
  });

  describe('buildRubricPrompt()', () => {
    test('includes all criteria with types', () => {
      const prompt = buildRubricPrompt(criteria, 'Write about AI');
      expect(prompt).toContain('POSITIVE');
      expect(prompt).toContain('PENALTY');
      expect(prompt).toContain('Write about AI');
      expect(prompt).toContain('Covers the brief');
    });
  });
});
