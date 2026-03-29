/**
 * SwarmOrchestrator — runs multi-agent pipelines using Strands Graph pattern.
 * Handles checkpoint persistence, quality gate loops, autonomy modes, and IPC streaming.
 */
const { Agent, BedrockModel, tool } = require('@strands-agents/sdk');
const { z } = require('zod');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

class SwarmOrchestrator {
  constructor({ awsConfig, skillsManager, onEvent }) {
    this.awsConfig = awsConfig;
    this.skills = skillsManager;
    this.onEvent = onEvent || (() => {});
    this.runs = new Map();
    this.runsDir = path.join(app.getPath('userData'), 'swarm-runs');
    this._pendingInput = new Map();
  }

  async runPipeline(swarmId, template, brief, autonomyMode, files) {
    const state = {
      swarmId, status: 'running', autonomyMode,
      agents: template.agents.map(a => ({ id: a.id, label: a.label, status: 'pending', output: null })),
      currentIndex: 0, brief, retries: {},
    };
    this.runs.set(swarmId, { aborted: false, state });

    try {
      await this._ensureDir(path.join(this.runsDir, swarmId));
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
          const output = await this._runAgent(swarmId, agentConfig, previousOutput, brief, i);

          // Quality gate loop
          if (agentConfig.isQualityGate) {
            const trimmed = output.trimStart();
            if (trimmed.startsWith('REVISE:') || trimmed.startsWith('REVISE\n')) {
              const maxRetries = agentConfig.maxRetries || 2;
              const retryKey = agentConfig.id;
              const attempts = (state.retries[retryKey] || 0) + 1;
              state.retries[retryKey] = attempts;

              if (attempts < maxRetries && i >= 2) {
                const feedback = trimmed.replace(/^REVISE:?\s*/, '').trim();
                const prevAgent = template.agents[i - 1];
                state.agents[i].status = 'pending';
                state.agents[i - 1].status = 'running';
                this.onEvent('swarm-agent-started', { swarmId, agentIndex: i - 1, role: prevAgent.id, label: `${prevAgent.label} (revision ${attempts})` });
                const revised = await this._runAgent(swarmId, prevAgent, previousOutput + '\n\nREVISION FEEDBACK:\n' + feedback, brief, i - 1);
                state.agents[i - 1].output = revised;
                await this._saveCheckpoint(swarmId, i - 1, revised);
                this.onEvent('swarm-agent-done', { swarmId, agentIndex: i - 1, output: revised });
                previousOutput = revised;
                i--;
                continue;
              }
              // Max retries exceeded — pass through with whatever content follows REVISE:
              previousOutput = trimmed.replace(/^REVISE:?\s*/, '').trim() || previousOutput;
            } else {
              // PASS or unexpected format — strip "PASS" prefix if present, use content
              previousOutput = trimmed.replace(/^PASS\s*/, '').trim() || previousOutput;
            }
          } else {
            previousOutput = output;
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
      await this._saveState(swarmId, state);
      this.onEvent('swarm-pipeline-done', { swarmId, finalOutput: previousOutput });
    } catch (err) {
      state.status = 'error';
      this.onEvent('swarm-error', { swarmId, error: err.message, agentIndex: state.currentIndex });
    }
  }

  async _runAgent(swarmId, agentConfig, input, brief, agentIndex) {
    // Load skill bodies for this agent
    const skillBodies = [];
    for (const skillName of (agentConfig.skills || [])) {
      const body = await this.skills.getSkillBody(skillName);
      if (body) skillBodies.push({ name: skillName, body });
    }

    const skillBlock = skillBodies.length > 0
      ? `\n\n<active_skills>\n${skillBodies.map(s => `<skill name="${s.name}">\n${s.body}\n</skill>`).join('\n')}\n</active_skills>`
      : '';

    const systemPrompt = `${agentConfig.prompt}${skillBlock}`;

    const handoff = `<user_brief>\n${brief}\n</user_brief>\n\n<previous_output>\n${input}\n</previous_output>\n\nProceed with your task based on the above context.`;

    // Build tools — include request_input for non-quality-gate agents
    const tools = [];
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
      region: this.awsConfig.region,
      credentials: this.awsConfig.credentials,
    });

    const agent = new Agent({ model, systemPrompt, tools, id: agentConfig.id });

    let fullText = '';
    for await (const event of agent.stream(handoff)) {
      if (this.runs.get(swarmId)?.aborted) throw new Error('Pipeline cancelled');
      if (event.type === 'modelStreamUpdateEvent') {
        const inner = event.event;
        if (inner.type === 'contentBlockDelta' && inner.data?.delta?.type === 'textDelta') {
          fullText += inner.data.delta.text;
          this.onEvent('swarm-agent-chunk', { swarmId, agentIndex, chunk: inner.data.delta.text });
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
    // Resolve any pending waits
    for (const [key, val] of this._pendingInput) {
      if (key.startsWith(swarmId)) { val.resolve(null); this._pendingInput.delete(key); }
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
}

module.exports = SwarmOrchestrator;
