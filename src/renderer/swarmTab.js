/**
 * Swarm tab — multi-agent pipeline UI.
 * Template selection → brief input → pipeline execution with stepper + streaming output.
 */
(function () {
  let activeSwarmId = null;
  let activeTemplate = null;
  let agentOutputs = {};
  let pendingInputRequest = null;

  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  async function init() {
    // Load templates
    const templates = await window.electronAPI.invoke('swarm-get-templates');
    const grid = document.getElementById('swarmTemplates');
    grid.innerHTML = templates.map(t => `
      <div class="col-sm-6 col-md-4">
        <div class="card swarm-template-card h-100" data-template="${t.id}">
          <div class="card-body text-center py-4">
            <i class="bi ${t.icon}" style="font-size:2rem;"></i>
            <h6 class="mt-2 mb-1">${esc(t.name)}</h6>
            <p class="text-muted small mb-0">${esc(t.description)}</p>
            <span class="badge bg-secondary bg-opacity-25 text-muted mt-2">${t.agentCount} agents</span>
          </div>
        </div>
      </div>`).join('');

    grid.querySelectorAll('.swarm-template-card').forEach(card => {
      card.addEventListener('click', () => selectTemplate(card.dataset.template, templates));
    });

    document.getElementById('swarmBackBtn').addEventListener('click', resetToTemplates);
    document.getElementById('swarmStartBtn').addEventListener('click', startPipeline);
    document.getElementById('swarmContinueBtn').addEventListener('click', continueAfterReview);
    document.getElementById('swarmCancelBtn').addEventListener('click', cancelPipeline);
    document.getElementById('swarmInputAnswerBtn').addEventListener('click', answerInput);
    document.getElementById('swarmInputDefaultBtn').addEventListener('click', answerInputDefault);
    document.getElementById('swarmNewRunBtn').addEventListener('click', resetToTemplates);

    // Auto-expand textarea
    const brief = document.getElementById('swarmBrief');
    brief.addEventListener('input', () => {
      brief.style.height = 'auto';
      brief.style.height = Math.min(brief.scrollHeight, 300) + 'px';
    });

    // IPC listeners
    window.electronAPI.receive('swarm-agent-started', onAgentStarted);
    window.electronAPI.receive('swarm-agent-chunk', onAgentChunk);
    window.electronAPI.receive('swarm-agent-done', onAgentDone);
    window.electronAPI.receive('swarm-review-pause', onReviewPause);
    window.electronAPI.receive('swarm-input-request', onInputRequest);
    window.electronAPI.receive('swarm-pipeline-done', onPipelineDone);
    window.electronAPI.receive('swarm-error', onError);

    // Ensure clean state on page load
    resetToTemplates();
  }

  function selectTemplate(id, templates) {
    activeTemplate = templates.find(t => t.id === id);
    document.getElementById('swarmTemplates').style.display = 'none';
    document.getElementById('swarmBriefSection').style.display = '';
    document.getElementById('swarmStepper').style.display = 'none';
    document.getElementById('swarmStatusBar').style.display = 'none';
    document.getElementById('swarmTemplateName').textContent = activeTemplate.name;
  }

  function resetToTemplates() {
    activeSwarmId = null;
    activeTemplate = null;
    agentOutputs = {};
    document.getElementById('swarmTemplates').style.display = '';
    document.getElementById('swarmBriefSection').style.display = 'none';
    document.getElementById('swarmStepper').style.display = 'none';
    document.getElementById('swarmOutputs').innerHTML = '';
    document.getElementById('swarmReviewPanel').style.display = 'none';
    document.getElementById('swarmInputPanel').style.display = 'none';
    document.getElementById('swarmDonePanel').style.display = 'none';
    document.getElementById('swarmBriefDisplay').style.display = 'none';
    document.getElementById('swarmBrief').value = '';
    document.getElementById('swarmBrief').style.height = 'auto';
    clearStatus();
  }

  async function startPipeline() {
    const brief = document.getElementById('swarmBrief').value.trim();
    if (!brief) { window.electronAPI.showToast('Please describe what you want to create', 'error'); return; }

    const autonomyMode = document.getElementById('swarmAutonomy').value;
    document.getElementById('swarmStartBtn').disabled = true;

    try {
      const { swarmId } = await window.electronAPI.invoke('swarm-run-pipeline', {
        templateId: activeTemplate.id, brief, autonomyMode,
      });
      activeSwarmId = swarmId;
      agentOutputs = {};
      document.getElementById('swarmBriefSection').style.display = 'none';
      // Show brief display
      document.getElementById('swarmBriefDisplay').style.display = '';
      document.getElementById('swarmBriefTemplate').textContent = activeTemplate.name;
      document.getElementById('swarmBriefText').textContent = brief;
    } catch (err) {
      window.electronAPI.showToast(`Failed: ${err.message}`, 'error');
    } finally {
      document.getElementById('swarmStartBtn').disabled = false;
    }
  }

  // ── IPC Event Handlers ────────────────────────────────

  const STATUS_MESSAGES = {
    researcher: ['Searching the web for sources...', 'Gathering data and statistics...', 'Compiling research brief...'],
    planner: ['Analyzing research findings...', 'Structuring the outline...', 'Defining section flow...'],
    'quality-gate-1': ['Evaluating outline against rubric...', 'Checking structure and completeness...'],
    writer: ['Drafting content...', 'Developing key sections...', 'Refining prose...'],
    editor: ['Applying Eight Sweeps framework...', 'Checking for AI patterns...', 'Polishing language and flow...'],
    'quality-gate-2': ['Running final quality evaluation...', 'Scoring against rubric criteria...'],
    formatter: ['Generating document...', 'Applying formatting and styles...', 'Saving file...'],
  };

  function setStatus(label, agentId) {
    const bar = document.getElementById('swarmStatusBar');
    const text = document.getElementById('swarmStatusText');
    const msgs = STATUS_MESSAGES[agentId] || [`${label} is working...`];
    bar.style.setProperty('display', 'flex', 'important');
    text.textContent = `${label} — ${msgs[0]}`;
    if (bar._interval) clearInterval(bar._interval);
    let i = 0;
    bar._interval = setInterval(() => {
      i = (i + 1) % msgs.length;
      text.textContent = `${label} — ${msgs[i]}`;
    }, 8000);
  }

  function clearStatus() {
    const bar = document.getElementById('swarmStatusBar');
    bar.style.setProperty('display', 'none', 'important');
    if (bar._interval) clearInterval(bar._interval);
  }

  function onAgentStarted({ swarmId, agentIndex, role, label }) {
    if (swarmId !== activeSwarmId) return;
    agentOutputs[agentIndex] = { label, text: '', status: 'running' };
    setStatus(label, role);
    renderStepper();
    renderOutputs();
  }

  function onAgentChunk({ swarmId, agentIndex, chunk }) {
    if (swarmId !== activeSwarmId) return;
    if (agentOutputs[agentIndex]) {
      agentOutputs[agentIndex].text += chunk;
      updateActiveOutput(agentIndex);
    }
  }

  function onAgentDone({ swarmId, agentIndex, output }) {
    if (swarmId !== activeSwarmId) return;
    if (agentOutputs[agentIndex]) {
      agentOutputs[agentIndex].text = output;
      agentOutputs[agentIndex].status = 'done';
    }
    clearStatus();
    renderStepper();
    renderOutputs();
  }

  function onReviewPause({ swarmId, agentIndex, output }) {
    if (swarmId !== activeSwarmId) return;
    const panel = document.getElementById('swarmReviewPanel');
    document.getElementById('swarmReviewTitle').textContent = `Review: ${agentOutputs[agentIndex]?.label || 'Output'}`;
    document.getElementById('swarmReviewEditor').value = output;
    panel.style.display = '';
  }

  function onInputRequest({ swarmId, agentIndex, question, options, default_choice, risk_if_wrong }) {
    if (swarmId !== activeSwarmId) return;
    pendingInputRequest = { default_choice };
    const panel = document.getElementById('swarmInputPanel');
    document.getElementById('swarmInputQuestion').textContent = question;
    const optionsEl = document.getElementById('swarmInputOptions');
    if (options && options.length > 0) {
      optionsEl.innerHTML = options.map((o, i) => `
        <div class="form-check">
          <input class="form-check-input" type="radio" name="swarmInputOpt" id="swarmOpt${i}" value="${esc(o)}" ${o === default_choice ? 'checked' : ''}>
          <label class="form-check-label" for="swarmOpt${i}">${esc(o)}</label>
        </div>`).join('');
    } else {
      optionsEl.innerHTML = `<input type="text" class="form-control" id="swarmInputText" value="${esc(default_choice)}" placeholder="Your answer">`;
    }
    panel.style.display = '';
  }

  function onPipelineDone({ swarmId, finalOutput }) {
    if (swarmId !== activeSwarmId) return;
    clearStatus();
    document.getElementById('swarmDonePanel').style.display = '';
    // Extract file paths from final output (save_file_locally mentions them)
    const filePaths = (finalOutput || '').match(/\/Users\/[^\s"'<>]+\.\w{2,5}/g) || [];
    const fileLinks = filePaths.length
      ? `<div class="mt-2"><strong>Generated files:</strong><ul class="mb-0">${filePaths.map(f => `<li><code>${esc(f)}</code></li>`).join('')}</ul></div>`
      : '';
    document.getElementById('swarmDoneMessage').innerHTML =
      `All agents completed successfully.${fileLinks}`;
    renderStepper();
  }

  function onError({ swarmId, error, agentIndex }) {
    if (swarmId !== activeSwarmId) return;
    clearStatus();
    if (agentOutputs[agentIndex]) agentOutputs[agentIndex].status = 'error';
    Object.values(agentOutputs).forEach(a => { if (a.status === 'running') a.status = 'error'; });
    renderStepper();
    document.getElementById('swarmDonePanel').style.display = '';
    document.getElementById('swarmDoneMessage').innerHTML =
      `<span class="text-danger"><i class="bi bi-exclamation-triangle me-1"></i>${esc(error)}</span>`;
    window.electronAPI.showToast(`Agent error: ${error}`, 'error');
  }

  // ── Actions ───────────────────────────────────────────

  async function continueAfterReview() {
    const edited = document.getElementById('swarmReviewEditor').value;
    document.getElementById('swarmReviewPanel').style.display = 'none';
    await window.electronAPI.invoke('swarm-continue', { swarmId: activeSwarmId, editedOutput: edited });
  }

  async function cancelPipeline() {
    if (activeSwarmId) await window.electronAPI.invoke('swarm-cancel', { swarmId: activeSwarmId });
    document.getElementById('swarmReviewPanel').style.display = 'none';
    document.getElementById('swarmInputPanel').style.display = 'none';
    window.electronAPI.showToast('Pipeline cancelled', 'info');
  }

  async function answerInput() {
    const radio = document.querySelector('input[name="swarmInputOpt"]:checked');
    const textInput = document.getElementById('swarmInputText');
    const answer = radio ? radio.value : (textInput ? textInput.value : pendingInputRequest?.default_choice || '');
    document.getElementById('swarmInputPanel').style.display = 'none';
    await window.electronAPI.invoke('swarm-answer-input', { swarmId: activeSwarmId, answer });
  }

  async function answerInputDefault() {
    document.getElementById('swarmInputPanel').style.display = 'none';
    await window.electronAPI.invoke('swarm-answer-input', { swarmId: activeSwarmId, answer: pendingInputRequest?.default_choice || '' });
  }

  // ── Rendering ─────────────────────────────────────────

  function renderStepper() {
    const stepper = document.getElementById('swarmStepper');
    stepper.style.display = '';
    const entries = Object.entries(agentOutputs).sort((a, b) => a[0] - b[0]);
    stepper.innerHTML = entries.map(([idx, a], i) => {
      const num = i + 1;
      const isLast = i === entries.length - 1;
      const lineClass = a.status === 'done' ? 'done' : '';
      const content = a.status === 'done' ? '<i class="bi bi-check-lg"></i>'
        : a.status === 'error' ? '<i class="bi bi-x-lg"></i>'
        : num;
      return `<div class="swarm-step ${a.status}">
        <div class="swarm-step-node">${content}</div>
        <div class="swarm-step-label">${esc(a.label)}</div>
      </div>${!isLast ? `<div class="swarm-step-line ${lineClass}"><div class="swarm-step-line-fill"></div></div>` : ''}`;
    }).join('');
  }

  function renderOutputs() {
    const container = document.getElementById('swarmOutputs');
    const entries = Object.entries(agentOutputs).sort((a, b) => a[0] - b[0]);

    for (const [idx, a] of entries) {
      let card = document.getElementById(`swarmCard${idx}`);
      if (!card) {
        card = document.createElement('div');
        card.id = `swarmCard${idx}`;
        card.className = 'card mb-2';
        const isActive = a.status === 'running';
        card.innerHTML = `
          <div class="card-header d-flex justify-content-between align-items-center py-2" data-bs-toggle="collapse" data-bs-target="#swarmOutput${idx}" style="cursor:pointer;">
            <span class="small" id="swarmCardHeader${idx}"></span>
          </div>
          <div id="swarmOutput${idx}" class="collapse ${isActive ? 'show' : ''}">
            <div class="card-body small" style="max-height:400px;overflow-y:auto;white-space:pre-wrap;font-family:monospace;font-size:0.8rem;" id="swarmOutputBody${idx}"></div>
          </div>`;
        container.appendChild(card);
      }
      // Update header status
      const statusIcon = a.status === 'done' ? '<i class="bi bi-check-circle text-success ms-1"></i>'
        : a.status === 'running' ? '<span class="spinner-border spinner-border-sm ms-1"></span>'
        : a.status === 'error' ? '<i class="bi bi-x-circle text-danger ms-1"></i>' : '';
      const header = document.getElementById(`swarmCardHeader${idx}`);
      if (header) header.innerHTML = `<strong>${esc(a.label)}</strong> ${statusIcon}`;
      // Update body for completed agents
      if (a.status !== 'running') {
        const body = document.getElementById(`swarmOutputBody${idx}`);
        if (body) {
          const rubricHtml = tryRenderRubricCard(a.text);
          if (rubricHtml) {
            body.style.fontFamily = '';
            body.style.whiteSpace = '';
            body.innerHTML = rubricHtml;
          } else {
            body.textContent = a.text || '(no output)';
          }
        }
      }
    }
  }

  function updateActiveOutput(agentIndex) {
    const el = document.getElementById(`swarmOutputBody${agentIndex}`);
    if (el) {
      el.textContent = agentOutputs[agentIndex].text;
      el.scrollTop = el.scrollHeight;
    }
  }

  function tryRenderRubricCard(text) {
    if (!text) return null;
    // Extract JSON from the output
    const start = text.indexOf('{"scores"');
    if (start === -1) return null;
    const end = text.lastIndexOf('}');
    if (end === -1) return null;
    let parsed;
    try { parsed = JSON.parse(text.slice(start, end + 1)); } catch { return null; }
    if (!parsed.scores || !Array.isArray(parsed.scores)) return null;

    const scores = parsed.scores;
    const positive = scores.filter(s => s.score >= 0); // includes 0 (failed) and 1 (passed)
    const passed = positive.filter(s => s.score === 1);
    const failed = positive.filter(s => s.score === 0);
    const total = positive.length;
    const passCount = passed.length;
    const pct = total > 0 ? Math.round((passCount / total) * 100) : 0;

    const verdict = pct >= 90 ? 'Strong pass' : pct >= 75 ? 'Pass' : pct >= 60 ? 'Needs work' : 'Fail';
    const verdictClass = pct >= 75 ? 'rubric-verdict-pass' : pct >= 60 ? 'rubric-verdict-warn' : 'rubric-verdict-fail';

    // Segmented progress bar
    const segments = scores.map(s =>
      `<div class="rubric-seg ${s.score === 1 ? 'rubric-seg-pass' : s.score === 0 ? 'rubric-seg-fail' : 'rubric-seg-na'}"></div>`
    ).join('');

    // Short labels from reason (first few words) or criterion index
    const shortLabel = (s) => {
      if (s.reason) {
        const words = s.reason.split(/\s+/).slice(0, 4).join(' ');
        return words.length > 30 ? words.slice(0, 30) + '…' : words;
      }
      return `Criterion ${s.criterion_index + 1}`;
    };

    const passedRows = passed.map(s =>
      `<div class="rubric-row">
        <span class="rubric-icon rubric-icon-pass"><i class="bi bi-check-circle-fill"></i></span>
        <span class="rubric-label" title="${esc(s.reason || '')}">${esc(shortLabel(s))}</span>
        <span class="rubric-score rubric-score-pass">1/1</span>
      </div>`
    ).join('');

    const failedRows = failed.map(s =>
      `<div class="rubric-row">
        <span class="rubric-icon rubric-icon-fail"><i class="bi bi-x-circle-fill"></i></span>
        <span class="rubric-label" title="${esc(s.reason || '')}">${esc(shortLabel(s))}</span>
        <span class="rubric-score rubric-score-fail">0/1</span>
      </div>`
    ).join('');

    return `
      <div class="rubric-card">
        <div class="rubric-header">
          <div class="rubric-big-score">
            <span class="rubric-num">${passCount}</span>
            <span class="rubric-denom">out of ${total}</span>
          </div>
          <div class="rubric-bar-wrap">
            <div class="rubric-bar">${segments}</div>
            <div class="rubric-bar-label">${pct}%${failed.length ? ` — ${failed.length} criteria need attention` : ''}</div>
          </div>
          <div class="rubric-verdict ${verdictClass}">${verdict}</div>
        </div>
        ${passedRows ? `<div class="rubric-section-label">PASSED</div>${passedRows}` : ''}
        ${failedRows ? `<div class="rubric-section-label rubric-section-warn">NEEDS ATTENTION</div>${failedRows}` : ''}
      </div>`;
  }

  if (typeof window !== 'undefined') {
    window.SwarmTab = { init };
  }
})();
