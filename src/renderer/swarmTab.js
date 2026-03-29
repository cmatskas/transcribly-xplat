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

    // IPC listeners
    window.electronAPI.receive('swarm-agent-started', onAgentStarted);
    window.electronAPI.receive('swarm-agent-chunk', onAgentChunk);
    window.electronAPI.receive('swarm-agent-done', onAgentDone);
    window.electronAPI.receive('swarm-review-pause', onReviewPause);
    window.electronAPI.receive('swarm-input-request', onInputRequest);
    window.electronAPI.receive('swarm-pipeline-done', onPipelineDone);
    window.electronAPI.receive('swarm-error', onError);
  }

  function selectTemplate(id, templates) {
    activeTemplate = templates.find(t => t.id === id);
    document.getElementById('swarmTemplates').style.display = 'none';
    document.getElementById('swarmBriefSection').style.display = '';
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
    document.getElementById('swarmBrief').value = '';
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
    } catch (err) {
      window.electronAPI.showToast(`Failed: ${err.message}`, 'error');
    } finally {
      document.getElementById('swarmStartBtn').disabled = false;
    }
  }

  // ── IPC Event Handlers ────────────────────────────────

  function onAgentStarted({ swarmId, agentIndex, role, label }) {
    if (swarmId !== activeSwarmId) return;
    agentOutputs[agentIndex] = { label, text: '', status: 'running' };
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
    document.getElementById('swarmDonePanel').style.display = '';
    document.getElementById('swarmDoneMessage').textContent = 'All agents completed successfully.';
    renderStepper();
  }

  function onError({ swarmId, error, agentIndex }) {
    if (swarmId !== activeSwarmId) return;
    if (agentOutputs[agentIndex]) agentOutputs[agentIndex].status = 'error';
    renderStepper();
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
    stepper.style.display = 'flex';
    const entries = Object.entries(agentOutputs).sort((a, b) => a[0] - b[0]);
    stepper.innerHTML = entries.map(([idx, a]) => {
      const icon = a.status === 'done' ? 'bi-check-lg' : a.status === 'running' ? 'bi-three-dots' : a.status === 'error' ? 'bi-x-lg' : 'bi-circle';
      return `<div class="swarm-step ${a.status}">
        <div class="swarm-step-indicator"><i class="bi ${icon}"></i></div>
        <div class="swarm-step-label small mt-1">${esc(a.label)}</div>
      </div>`;
    }).join('');
  }

  function renderOutputs() {
    const container = document.getElementById('swarmOutputs');
    const entries = Object.entries(agentOutputs).sort((a, b) => a[0] - b[0]);
    container.innerHTML = entries.map(([idx, a]) => {
      const isActive = a.status === 'running';
      const preview = a.text.length > 300 ? a.text.slice(0, 300) + '...' : a.text;
      return `<div class="card mb-2">
        <div class="card-header d-flex justify-content-between align-items-center py-2" data-bs-toggle="collapse" data-bs-target="#swarmOutput${idx}" style="cursor:pointer;">
          <span class="small"><strong>${esc(a.label)}</strong> ${a.status === 'done' ? '<i class="bi bi-check-circle text-success ms-1"></i>' : a.status === 'running' ? '<span class="spinner-border spinner-border-sm ms-1"></span>' : a.status === 'error' ? '<i class="bi bi-x-circle text-danger ms-1"></i>' : ''}</span>
        </div>
        <div id="swarmOutput${idx}" class="collapse ${isActive ? 'show' : ''}">
          <div class="card-body small" style="max-height:400px;overflow-y:auto;white-space:pre-wrap;font-family:monospace;font-size:0.8rem;" id="swarmOutputBody${idx}">${esc(isActive ? a.text : preview)}</div>
        </div>
      </div>`;
    }).join('');
  }

  function updateActiveOutput(agentIndex) {
    const el = document.getElementById(`swarmOutputBody${agentIndex}`);
    if (el) {
      el.textContent = agentOutputs[agentIndex].text;
      el.scrollTop = el.scrollHeight;
    }
  }

  if (typeof window !== 'undefined') {
    window.SwarmTab = { init };
  }
})();
