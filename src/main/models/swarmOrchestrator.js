/**
 * SwarmOrchestrator — runs multi-agent pipelines using Strands Graph pattern.
 * Handles checkpoint persistence, quality gate loops, autonomy modes, and IPC streaming.
 */
const { Agent, BedrockModel, tool } = require('@strands-agents/sdk');
const { z } = require('zod');
const { createSwarmTools } = require('./swarmTools');
const { evaluate, decide, buildRubricPrompt, parseJudgeResponse } = require('./rubricEvaluator');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

class SwarmOrchestrator {
  constructor({ awsConfig, skillsManager, codeInterpreterManager, browserManager, settings, onEvent }) {
    this.awsConfig = awsConfig;
    this.skills = skillsManager;
    this.codeInterpreter = codeInterpreterManager;
    this.browser = browserManager;
    this.settings = settings;
    this.onEvent = onEvent || (() => {});
    this.runs = new Map();
    this.runsDir = path.join(app.getPath('userData'), 'swarm-runs');
    this._pendingInput = new Map();
  }

  async runPipeline(swarmId, template, brief, autonomyMode, files) {
    const state = {
      swarmId, status: 'running', autonomyMode,
      templateId: template.id, templateName: template.name,
      startedAt: new Date().toISOString(),
      agents: template.agents.map(a => ({ id: a.id, label: a.label, status: 'pending', output: null })),
      currentIndex: 0, brief, retries: {},
    };
    this.runs.set(swarmId, { aborted: false, state });

    try {
      await this._ensureDir(path.join(this.runsDir, swarmId));

      // Resume from persisted state if available
      try {
        const persisted = JSON.parse(await fs.readFile(path.join(this.runsDir, swarmId, 'state.json'), 'utf8'));
        state.retries = persisted.retries || {};
      } catch { /* fresh run */ }

      // Adaptive learning: gather historical feedback + adapt rubric to brief
      const historicalFeedback = await this._getHistoricalFeedback(template.id);
      const adaptedRubric = template.rubric ? await this._adaptRubric(template.rubric, brief) : null;

      let previousOutput = brief;

      for (let i = 0; i < template.agents.length; i++) {
        if (this.runs.get(swarmId)?.aborted) { state.status = 'cancelled'; break; }

        const agentConfig = template.agents[i];
        state.currentIndex = i;
        state.agents[i].status = 'running';
        this.onEvent('swarm-agent-started', { swarmId, agentIndex: i, role: agentConfig.id, label: agentConfig.label });

        // Check for checkpoint resume
        const checkpointFile = path.join(this.runsDir, swarmId, `agent-${i}-output.md`);
        try {
          const saved = await fs.readFile(checkpointFile, 'utf8');
          state.agents[i].status = 'done';
          state.agents[i].output = saved;
          previousOutput = saved;
          this.onEvent('swarm-agent-done', { swarmId, agentIndex: i, output: saved });
          continue;
        } catch { /* no checkpoint, run agent */ }

        try {
          const output = await this._runAgent(swarmId, agentConfig, previousOutput, brief, i, adaptedRubric || template.rubric, historicalFeedback);

          // Quality gate loop
          if (agentConfig.isQualityGate) {
            const rubric = template.rubric;
            const retryKey = agentConfig.id;
            const maxRetries = agentConfig.maxRetries || 2;
            const attempts = (state.retries[retryKey] || 0);

            if (rubric) {
              // ── Rubric-based evaluation ──
              // The quality gate agent was given a rubric prompt; parse its JSON scores
              const scores = parseJudgeResponse(output);
              if (scores) {
                const result = evaluate(rubric.criteria, scores, rubric);
                const decision = decide(result.score, { threshold: rubric.threshold, minPass: rubric.minPass, attempt: attempts, maxRetries });

                // Persist rubric scores in state for observability
                if (!state.rubric_scores) state.rubric_scores = {};
                if (!state.rubric_scores[retryKey]) state.rubric_scores[retryKey] = [];
                state.rubric_scores[retryKey].push({ attempt: attempts, score: result.score, axis_scores: result.axis_scores, decision });

                if (decision === 'REVISE' && i >= 2) {
                  state.retries[retryKey] = attempts + 1;
                  const feedback = result.failing.map(f =>
                    `${f.isPenalty ? 'PENALTY' : 'FAILED'}: "${f.text}" — ${f.reason}`
                  ).join('\n');
                  const prevAgent = template.agents[i - 1];
                  state.agents[i].status = 'pending';
                  state.agents[i - 1].status = 'running';
                  this.onEvent('swarm-agent-started', { swarmId, agentIndex: i - 1, role: prevAgent.id, label: `${prevAgent.label} (revision ${attempts + 1})` });
                  const revised = await this._runAgent(swarmId, prevAgent, previousOutput + '\n\nREVISION FEEDBACK (score: ' + result.score.toFixed(2) + '):\n' + feedback, brief, i - 1);
                  state.agents[i - 1].output = revised;
                  await this._saveCheckpoint(swarmId, i - 1, revised);
                  this.onEvent('swarm-agent-done', { swarmId, agentIndex: i - 1, output: revised });
                  previousOutput = revised;
                  i--;
                  continue;
                } else if (decision === 'FAIL') {
                  state.agents[i].status = 'error';
                  state.status = 'error';
                  this.onEvent('swarm-error', { swarmId, error: `Quality gate failed (score: ${result.score.toFixed(2)}, threshold: ${rubric.minPass})`, agentIndex: i });
                  await this._saveState(swarmId, state);
                  return;
                }
                // PASS or PASS_WITH_RESERVATIONS — continue
              }
              // If JSON parsing failed, fall through to legacy string parsing
              else {
                const trimmed = output.trimStart();
                if (trimmed.startsWith('REVISE:') || trimmed.startsWith('REVISE\n')) {
                  previousOutput = trimmed.replace(/^REVISE:?\s*/, '').trim() || previousOutput;
                } else {
                  previousOutput = trimmed.replace(/^PASS\s*/, '').trim() || previousOutput;
                }
              }
            } else {
              // ── Legacy string-based evaluation (no rubric defined) ──
              const trimmed = output.trimStart();
              if (trimmed.startsWith('REVISE:') || trimmed.startsWith('REVISE\n')) {
                state.retries[retryKey] = attempts + 1;
                if (attempts + 1 < maxRetries && i >= 2) {
                  const feedback = trimmed.replace(/^REVISE:?\s*/, '').trim();
                  const prevAgent = template.agents[i - 1];
                  state.agents[i].status = 'pending';
                  state.agents[i - 1].status = 'running';
                  this.onEvent('swarm-agent-started', { swarmId, agentIndex: i - 1, role: prevAgent.id, label: `${prevAgent.label} (revision ${attempts + 1})` });
                  const revised = await this._runAgent(swarmId, prevAgent, previousOutput + '\n\nREVISION FEEDBACK:\n' + feedback, brief, i - 1);
                  state.agents[i - 1].output = revised;
                  await this._saveCheckpoint(swarmId, i - 1, revised);
                  this.onEvent('swarm-agent-done', { swarmId, agentIndex: i - 1, output: revised });
                  previousOutput = revised;
                  i--;
                  continue;
                }
                previousOutput = trimmed.replace(/^REVISE:?\s*/, '').trim() || previousOutput;
              } else {
                previousOutput = trimmed.replace(/^PASS\s*/, '').trim() || previousOutput;
              }
            }
          } else {
            if (output) previousOutput = output;
          }

          state.agents[i].status = 'done';
          state.agents[i].output = previousOutput;
          await this._saveCheckpoint(swarmId, i, previousOutput);
          this.onEvent('swarm-agent-done', { swarmId, agentIndex: i, output: previousOutput });

          // Review point pause
          if (agentConfig.reviewPoint && autonomyMode !== 'autonomous') {
            state.status = 'paused';
            await this._saveState(swarmId, state);
            this.onEvent('swarm-review-pause', { swarmId, agentIndex: i, output: previousOutput });
            const edited = await this._waitForContinue(swarmId);
            if (edited !== null) previousOutput = edited;
            state.status = 'running';
          }
        } catch (err) {
          state.agents[i].status = 'error';
          state.status = 'error';
          this.onEvent('swarm-error', { swarmId, error: err.message, agentIndex: i });
          await this._saveState(swarmId, state);
          return;
        }

        await this._saveState(swarmId, state);
      }

      if (state.status !== 'cancelled') state.status = 'completed';
      state.completedAt = new Date().toISOString();
      await this._saveState(swarmId, state);
      // Clean up checkpoint files — state.json has all we need for analytics
      this._cleanupOutputFiles(swarmId).catch(() => {});
      this.onEvent('swarm-pipeline-done', { swarmId, finalOutput: previousOutput });
    } catch (err) {
      state.status = 'error';
      this.onEvent('swarm-error', { swarmId, error: err.message, agentIndex: state.currentIndex });
    }
  }

  async _runAgent(swarmId, agentConfig, input, brief, agentIndex, rubric, historicalFeedback) {
    // Load skill bodies for this agent
    const skillBodies = [];
    for (const skillName of (agentConfig.skills || [])) {
      const body = await this.skills.getSkillBody(skillName);
      if (body) skillBodies.push({ name: skillName, body });
    }

    const skillBlock = skillBodies.length > 0
      ? `\n\n<active_skills>\n${skillBodies.map(s => `<skill name="${s.name}">\n${s.body}\n</skill>`).join('\n')}\n</active_skills>`
      : '';

    // Inject historical feedback for writer/editor agents (not quality gates, not researcher/planner/formatter)
    const feedbackBlock = (historicalFeedback && ['writer', 'editor'].includes(agentConfig.id))
      ? `\n\n${historicalFeedback}`
      : '';

    // For rubric-based quality gates, use the structured rubric prompt
    const basePrompt = (agentConfig.isQualityGate && rubric)
      ? buildRubricPrompt(rubric.criteria, brief)
      : agentConfig.prompt;

    const systemPrompt = `${basePrompt}\n\n<user_brief>\n${brief}\n</user_brief>${skillBlock}${feedbackBlock}`;

    // User message is just the previous agent's output — brief is in system prompt
    const handoff = input === brief
      ? 'Begin your task based on the user brief in your system prompt.'
      : `<previous_agent_output>\n${input}\n</previous_agent_output>\n\nBuild on the above output. The original user brief is in your system prompt.`;

    // Build tools — platform tools from template config + request_input for non-quality-gate agents
    const tools = createSwarmTools(
      { codeInterpreterManager: this.codeInterpreter, browserManager: this.browser, settings: this.settings, onStatus: (msg) => this.onEvent('swarm-agent-chunk', { swarmId, agentIndex, chunk: `\n🔧 ${msg}\n` }) },
      agentConfig.tools || []
    );

    if (!agentConfig.isQualityGate) {
      const self = this;
      const sid = swarmId;
      const idx = agentIndex;
      const mode = this.runs.get(swarmId)?.state?.autonomyMode || 'guided';

      tools.push(tool({
        name: 'request_input',
        description: 'Ask the user a question when you encounter ambiguity that significantly changes the output. Include a default choice for autonomous mode.',
        inputSchema: z.object({
          question: z.string(),
          options: z.array(z.string()).optional(),
          default_choice: z.string(),
          risk_if_wrong: z.enum(['low', 'medium', 'high']),
        }),
        callback: async (inp) => {
          if (mode === 'autonomous' || (mode === 'guided' && inp.risk_if_wrong !== 'high')) {
            self.onEvent('swarm-agent-chunk', { swarmId: sid, agentIndex: idx, chunk: `\n⚡ Auto-resolved: "${inp.question}" → ${inp.default_choice}\n` });
            return inp.default_choice;
          }
          self.onEvent('swarm-input-request', { swarmId: sid, agentIndex: idx, ...inp });
          return await self._waitForInput(sid);
        },
      }));
    }

    const model = new BedrockModel({
      modelId: agentConfig.model,
      clientConfig: {
        region: this.awsConfig.region,
        credentials: this.awsConfig.credentials,
      },
    });

    const agent = new Agent({ model, systemPrompt, tools, id: agentConfig.id });

    let fullText = '';
    for await (const event of agent.stream(handoff)) {
      if (this.runs.get(swarmId)?.aborted) throw new Error('Pipeline cancelled');
      if (event.type === 'modelStreamUpdateEvent') {
        const inner = event.event;
        if (inner.type === 'modelContentBlockDeltaEvent' && inner.delta?.type === 'textDelta') {
          fullText += inner.delta.text;
          this.onEvent('swarm-agent-chunk', { swarmId, agentIndex, chunk: inner.delta.text });
        }
      }
    }
    return fullText;
  }

  // ── Pause/Resume ──────────────────────────────────────

  _waitForContinue(swarmId) {
    return new Promise(resolve => { this._pendingInput.set(swarmId, { resolve }); });
  }

  continueAfterReview(swarmId, editedOutput) {
    const pending = this._pendingInput.get(swarmId);
    if (pending) { pending.resolve(editedOutput); this._pendingInput.delete(swarmId); }
  }

  _waitForInput(swarmId) {
    return new Promise(resolve => { this._pendingInput.set(`${swarmId}-input`, { resolve }); });
  }

  answerInput(swarmId, answer) {
    const pending = this._pendingInput.get(`${swarmId}-input`);
    if (pending) { pending.resolve(answer); this._pendingInput.delete(`${swarmId}-input`); }
  }

  cancel(swarmId) {
    const run = this.runs.get(swarmId);
    if (run) run.aborted = true;
    // Resolve any pending waits for this specific swarm
    const keysToResolve = [swarmId, `${swarmId}-input`];
    for (const key of keysToResolve) {
      const pending = this._pendingInput.get(key);
      if (pending) { pending.resolve(null); this._pendingInput.delete(key); }
    }
  }

  // ── Persistence ───────────────────────────────────────

  async _saveCheckpoint(swarmId, agentIndex, output) {
    const dir = path.join(this.runsDir, swarmId);
    await this._ensureDir(dir);
    await fs.writeFile(path.join(dir, `agent-${agentIndex}-output.md`), output, 'utf8');
  }

  async _saveState(swarmId, state) {
    const dir = path.join(this.runsDir, swarmId);
    await this._ensureDir(dir);
    await fs.writeFile(path.join(dir, 'state.json'), JSON.stringify(state, null, 2), 'utf8');
  }

  async _ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true }).catch(() => {});
  }

  async _cleanupOutputFiles(swarmId) {
    const dir = path.join(this.runsDir, swarmId);
    const files = await fs.readdir(dir);
    for (const f of files) {
      if (f.endsWith('-output.md')) await fs.unlink(path.join(dir, f)).catch(() => {});
    }
  }

  // ── Adaptive Learning ─────────────────────────────────

  async _getHistoricalFeedback(templateId) {
    try {
      const dirs = await fs.readdir(this.runsDir);
      const failures = {};

      for (const dir of dirs.slice(-20)) { // last 20 runs max
        try {
          const raw = await fs.readFile(path.join(this.runsDir, dir, 'state.json'), 'utf8');
          const state = JSON.parse(raw);
          if (state.templateId !== templateId || !state.rubric_scores) continue;

          for (const attempts of Object.values(state.rubric_scores)) {
            for (const attempt of attempts) {
              if (attempt.decision === 'REVISE' || attempt.decision === 'FAIL') {
                // Track axis-level failures
                for (const [axis, score] of Object.entries(attempt.axis_scores || {})) {
                  if (score < 0.75) {
                    if (!failures[axis]) failures[axis] = 0;
                    failures[axis]++;
                  }
                }
              }
            }
          }
        } catch { /* skip */ }
      }

      const sorted = Object.entries(failures).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (!sorted.length) return null;

      return `<historical_feedback>\nIn previous ${templateId} runs, the quality gate frequently flagged these issues:\n${sorted.map(([axis, count]) => `- "${axis}" failed ${count} time${count > 1 ? 's' : ''}`).join('\n')}\nAvoid these patterns proactively.\n</historical_feedback>`;
    } catch { return null; }
  }

  async _adaptRubric(rubric, brief) {
    try {
      const model = new BedrockModel({
        modelId: require('./pipelineTemplates').DEFAULT_MODELS.formatter,
        clientConfig: { region: this.awsConfig.region, credentials: this.awsConfig.credentials },
      });

      const criteriaList = rubric.criteria.map((c, i) =>
        `${i}: [weight ${c.weight}] "${c.text}"${c.canBeNA ? ' (can be N/A)' : ''}`
      ).join('\n');

      const agent = new Agent({
        model,
        systemPrompt: `You specialize in making evaluation criteria specific and concrete. Given generic rubric criteria and a user brief, rewrite each criterion to reference the specific content of the brief. Keep the same number of criteria, same weights, same meaning — just make the text specific. Output ONLY a JSON array of objects: [{"index": 0, "text": "specific criterion text"}, ...]`,
        tools: [],
        id: 'rubric-adapter',
      });

      let result = '';
      for await (const event of agent.stream(`Brief: ${brief}\n\nCriteria:\n${criteriaList}`)) {
        if (event.type === 'modelStreamUpdateEvent') {
          const inner = event.event;
          if (inner.type === 'modelContentBlockDeltaEvent' && inner.delta?.type === 'textDelta') {
            result += inner.delta.text;
          }
        }
      }

      // Parse the adapted criteria
      const start = result.indexOf('[');
      const end = result.lastIndexOf(']');
      if (start === -1 || end === -1) return null;

      const adapted = JSON.parse(result.slice(start, end + 1));
      const newCriteria = rubric.criteria.map((c, i) => {
        const match = adapted.find(a => a.index === i);
        return match ? { ...c, text: match.text } : c;
      });

      return { ...rubric, criteria: newCriteria };
    } catch (err) {
      // If adaptation fails, fall back to original rubric silently
      return null;
    }
  }
}

module.exports = SwarmOrchestrator;
