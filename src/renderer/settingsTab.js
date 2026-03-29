/**
 * Settings tab — in-page settings with Credentials, Configuration, and About sub-tabs.
 */
(function () {
  function init() {
    // Sub-tab switching
    document.querySelectorAll('[data-settings-tab]').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const target = tab.dataset.settingsTab;
        document.querySelectorAll('.settings-tab-content').forEach(c => c.style.display = 'none');
        document.querySelectorAll('[data-settings-tab]').forEach(t => t.classList.remove('active'));
        document.getElementById(`settings-${target}`).style.display = '';
        tab.classList.add('active');
        if (target === 'credentials') loadCredentials();
        if (target === 'configuration') loadConfig();
        if (target === 'about') loadAbout();
        if (target === 'skills') loadSkills();
      });
    });

    // Credentials form
    document.getElementById('credentialsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveCredentials();
    });

    document.getElementById('pasteCredBtn').addEventListener('click', pasteFromClipboard);

    // Paste detection on credential fields
    ['accessKeyId', 'secretAccessKey', 'sessionToken'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('paste', (e) => {
        setTimeout(() => tryParseCredentials(el.value), 50);
      });
    });

    // Config save
    document.getElementById('saveConfigBtn').addEventListener('click', saveConfig);

    // Memory toggle
    document.getElementById('memoryToggle').addEventListener('change', toggleMemory);
    document.getElementById('memoryDeleteBtn').addEventListener('click', deleteMemory);

    // Load credentials on first show
    loadCredentials();
  }

  // ── Credentials ────────────────────────────────────────────

  async function loadCredentials() {
    try {
      const creds = await window.electronAPI.invoke('load-credentials');
      if (creds) {
        document.getElementById('accessKeyId').value = creds.accessKeyId || '';
        document.getElementById('secretAccessKey').value = creds.secretAccessKey || '';
        document.getElementById('credRegion').value = creds.region || '';
        document.getElementById('sessionToken').value = creds.sessionToken || '';
      }
    } catch { /* no credentials yet */ }
  }

  async function saveCredentials() {
    const btn = document.getElementById('saveCredBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Testing...';

    try {
      const credentials = {
        accessKeyId: document.getElementById('accessKeyId').value.trim(),
        secretAccessKey: document.getElementById('secretAccessKey').value.trim(),
        region: document.getElementById('credRegion').value,
        sessionToken: document.getElementById('sessionToken').value.trim() || null,
        profileName: 'default',
      };

      if (!credentials.accessKeyId || !credentials.secretAccessKey || !credentials.region) {
        throw new Error('Please fill in all required fields');
      }

      await window.electronAPI.invoke('save-credentials', credentials);
      window.electronAPI.showToast('Credentials saved!', 'success');

      // Test connection inline
      await testConnection();
    } catch (err) {
      window.electronAPI.showToast(`Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Save & Test';
    }
  }

  async function testConnection() {
    const card = document.getElementById('connStatusCard');
    const body = document.getElementById('connStatusBody');
    card.style.display = '';
    body.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Testing...';

    try {
      const result = await window.electronAPI.invoke('validate-credentials');
      if (result.valid) {
        const perms = result.permissions;
        body.innerHTML = `
          <div class="mb-2"><span class="badge bg-success">Connected</span> <small class="text-muted">Account: ${result.identity.account}</small></div>
          <div class="small">
            <div><i class="bi bi-${perms.bedrock ? 'check-circle text-success' : 'x-circle text-danger'} me-1"></i>Bedrock</div>
            <div><i class="bi bi-${perms.transcribe ? 'check-circle text-success' : 'x-circle text-danger'} me-1"></i>Transcribe</div>
            <div><i class="bi bi-${perms.s3 ? 'check-circle text-success' : 'x-circle text-danger'} me-1"></i>S3</div>
          </div>`;
      } else {
        body.innerHTML = `<span class="badge bg-danger">Failed</span> <small class="text-muted">${result.errors.join(', ')}</small>`;
      }
    } catch (err) {
      body.innerHTML = `<span class="badge bg-danger">Error</span> <small>${err.message}</small>`;
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      tryParseCredentials(text);
    } catch {
      window.electronAPI.showToast('Could not read clipboard', 'error');
    }
  }

  function tryParseCredentials(text) {
    const patterns = {
      accessKeyId: /(?:AWS_ACCESS_KEY_ID|aws_access_key_id)\s*[=:]\s*(.+)/i,
      secretAccessKey: /(?:AWS_SECRET_ACCESS_KEY|aws_secret_access_key)\s*[=:]\s*(.+)/i,
      sessionToken: /(?:AWS_SESSION_TOKEN|aws_session_token)\s*[=:]\s*(.+)/i,
      region: /(?:AWS_(?:DEFAULT_)?REGION|aws_(?:default_)?region)\s*[=:]\s*(.+)/i,
    };

    let found = false;
    for (const [key, regex] of Object.entries(patterns)) {
      const match = text.match(regex);
      if (match) {
        const val = match[1].trim().replace(/^["']|["']$/g, '');
        const elId = key === 'region' ? 'credRegion' : key;
        const el = document.getElementById(elId);
        if (el) { el.value = val; found = true; }
      }
    }
    if (found) window.electronAPI.showToast('Credentials auto-populated!', 'success');
  }

  // ── Configuration ──────────────────────────────────────────

  async function loadConfig() {
    try {
      const settings = await window.electronAPI.invoke('load-settings');
      if (settings) {
        document.getElementById('bucketName').value = settings.bucketName || '';
        document.getElementById('outputBucketName').value = settings.outputBucketName || '';
        document.getElementById('transcriptionLanguage').value = settings.transcriptionLanguage || 'en-US';
        document.getElementById('defaultTheme').value = settings.defaultTheme || 'auto';
        document.getElementById('sagemakerImageEndpoint').value = settings.sagemakerImageEndpoint || '';
        document.getElementById('sagemakerImageComponent').value = settings.sagemakerImageComponent || '';
      }
    } catch { /* defaults */ }

    // Memory status — read toggle state directly from settings (no AWS call needed)
    try {
      const settings = await window.electronAPI.invoke('load-settings');
      const hasMemory = !!(settings && settings.memoryId);
      const isEnabled = hasMemory && !!settings.memoryEnabled;
      document.getElementById('memoryToggle').checked = isEnabled;
      document.getElementById('memoryStatusText').textContent = hasMemory ? (isEnabled ? 'Enabled' : 'Disabled') : '';
      document.getElementById('memoryDeleteBtn').style.display = hasMemory ? 'inline-block' : 'none';
    } catch {
      document.getElementById('memoryToggle').checked = false;
      document.getElementById('memoryDeleteBtn').style.display = 'none';
    }
  }

  async function saveConfig() {
    const btn = document.getElementById('saveConfigBtn');
    btn.disabled = true;

    try {
      const settings = {
        bucketName: document.getElementById('bucketName').value.trim(),
        outputBucketName: document.getElementById('outputBucketName').value.trim(),
        transcriptionLanguage: document.getElementById('transcriptionLanguage').value,
        defaultTheme: document.getElementById('defaultTheme').value,
        sagemakerImageEndpoint: document.getElementById('sagemakerImageEndpoint').value.trim(),
        sagemakerImageComponent: document.getElementById('sagemakerImageComponent').value.trim(),
      };

      await window.electronAPI.invoke('save-settings', settings);

      // Apply theme immediately
      if (window.themeManager) {
        window.themeManager.applyTheme(settings.defaultTheme);
      }

      window.electronAPI.showToast('Configuration saved!', 'success');
    } catch (err) {
      window.electronAPI.showToast(`Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  async function toggleMemory() {
    const toggle = document.getElementById('memoryToggle');
    const statusText = document.getElementById('memoryStatusText');
    const deleteBtn = document.getElementById('memoryDeleteBtn');

    if (toggle.checked) {
      statusText.textContent = 'Enabling...';
      try {
        await window.electronAPI.invoke('memory-enable');
        statusText.textContent = 'Enabled';
        deleteBtn.style.display = 'inline-block';
        window.electronAPI.showToast('Agent Memory enabled!', 'success');
      } catch (err) {
        toggle.checked = false;
        statusText.textContent = '';
        window.electronAPI.showToast(`Failed: ${err.message}`, 'error');
      }
    } else {
      statusText.textContent = 'Disabling...';
      try {
        await window.electronAPI.invoke('memory-disable');
        statusText.textContent = 'Disabled';
        window.electronAPI.showToast('Agent Memory disabled', 'info');
      } catch (err) {
        toggle.checked = true;
        statusText.textContent = 'Enabled';
        window.electronAPI.showToast(`Failed: ${err.message}`, 'error');
      }
    }
  }

  async function deleteMemory() {
    if (!confirm('This will permanently delete all stored memories. The toggle will need to be re-enabled to create a new memory. Continue?')) return;
    const statusText = document.getElementById('memoryStatusText');
    const deleteBtn = document.getElementById('memoryDeleteBtn');
    const toggle = document.getElementById('memoryToggle');
    try {
      await window.electronAPI.invoke('memory-delete');
      toggle.checked = false;
      statusText.textContent = '';
      deleteBtn.style.display = 'none';
      window.electronAPI.showToast('Memory deleted', 'info');
    } catch (err) {
      window.electronAPI.showToast(`Failed: ${err.message}`, 'error');
    }
  }

  // ── Skills ──────────────────────────────────────────────

  let _editingSkill = null;

  async function loadSkills() {
    const list = document.getElementById('skillsList');
    const editor = document.getElementById('skillEditorPanel');
    const newPanel = document.getElementById('newSkillPanel');
    editor.style.display = 'none';
    newPanel.style.display = 'none';

    try {
      const skills = await window.electronAPI.invoke('get-skills');
      if (!skills || skills.length === 0) {
        list.innerHTML = '<div class="text-muted small text-center py-4">No skills installed.</div>';
        return;
      }
      list.innerHTML = skills.map(s => `
        <div class="card mb-2">
          <div class="card-body py-2 px-3 d-flex align-items-center justify-content-between">
            <div class="flex-grow-1 me-3" style="min-width:0;">
              <div class="d-flex align-items-center gap-2">
                <strong class="small">${esc(s.name)}</strong>
                ${s.autoActivate ? '<span class="badge bg-primary bg-opacity-25 text-primary" style="font-size:0.65rem;">always-on</span>' : ''}
                ${s.scope ? `<span class="badge bg-secondary bg-opacity-25 text-muted" style="font-size:0.65rem;">${esc(s.scope)}</span>` : ''}
              </div>
              <div class="text-muted small text-truncate">${esc(s.description)}</div>
            </div>
            <div class="d-flex align-items-center gap-1 flex-shrink-0">
              <button class="btn btn-sm btn-outline-secondary skill-edit-btn" data-skill="${esc(s.name)}" title="Edit"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger skill-delete-btn" data-skill="${esc(s.name)}" title="Delete"><i class="bi bi-trash"></i></button>
              <div class="form-check form-switch mb-0 ms-2">
                <input class="form-check-input skill-toggle" type="checkbox" data-skill="${esc(s.name)}" ${s.disabled ? '' : 'checked'}>
              </div>
            </div>
          </div>
        </div>`).join('');

      // Wire edit buttons
      list.querySelectorAll('.skill-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openSkillEditor(btn.dataset.skill));
      });
      // Wire delete buttons
      list.querySelectorAll('.skill-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteSkill(btn.dataset.skill));
      });
      // Wire toggles
      list.querySelectorAll('.skill-toggle').forEach(toggle => {
        toggle.addEventListener('change', () => {
          window.electronAPI.invoke('toggle-skill', { name: toggle.dataset.skill, enabled: toggle.checked });
        });
      });
    } catch (err) {
      list.innerHTML = `<div class="text-danger small">${esc(err.message)}</div>`;
    }
  }

  async function openSkillEditor(name) {
    _editingSkill = name;
    const editor = document.getElementById('skillEditorPanel');
    const list = document.getElementById('skillsList');
    const newPanel = document.getElementById('newSkillPanel');
    newPanel.style.display = 'none';
    document.getElementById('skillEditorTitle').textContent = `Edit: ${name}`;
    document.getElementById('skillEditorContent').value = 'Loading...';
    list.style.display = 'none';
    editor.style.display = '';

    try {
      const content = await window.electronAPI.invoke('get-skill-content', name);
      document.getElementById('skillEditorContent').value = content || '';
    } catch (err) {
      document.getElementById('skillEditorContent').value = `Error: ${err.message}`;
    }
  }

  async function saveSkillEditor() {
    if (!_editingSkill) return;
    try {
      await window.electronAPI.invoke('save-skill-content', {
        name: _editingSkill,
        content: document.getElementById('skillEditorContent').value,
      });
      window.electronAPI.showToast('Skill saved!', 'success');
      closeSkillEditor();
      loadSkills();
    } catch (err) {
      window.electronAPI.showToast(`Error: ${err.message}`, 'error');
    }
  }

  function closeSkillEditor() {
    _editingSkill = null;
    document.getElementById('skillEditorPanel').style.display = 'none';
    document.getElementById('skillsList').style.display = '';
  }

  async function deleteSkill(name) {
    if (!confirm(`Delete skill "${name}"? This cannot be undone.`)) return;
    try {
      await window.electronAPI.invoke('delete-skill', name);
      window.electronAPI.showToast('Skill deleted', 'info');
      loadSkills();
    } catch (err) {
      window.electronAPI.showToast(`Error: ${err.message}`, 'error');
    }
  }

  function openNewSkillPanel() {
    document.getElementById('newSkillPanel').style.display = '';
    document.getElementById('skillsList').style.display = 'none';
    document.getElementById('skillEditorPanel').style.display = 'none';
    document.getElementById('newSkillName').value = '';
    document.getElementById('newSkillContent').value = `---\nname: my-skill\ndescription: "Describe when this skill should be activated."\nmetadata:\n  provider: agentcore-code-interpreter\n  version: "1.0"\n---\n\n# My Skill\n\nInstructions for the agent go here.\n`;
  }

  function closeNewSkillPanel() {
    document.getElementById('newSkillPanel').style.display = 'none';
    document.getElementById('skillsList').style.display = '';
  }

  async function createNewSkill() {
    const name = document.getElementById('newSkillName').value.trim().toLowerCase().replace(/[^a-z0-9\-]/g, '-');
    const content = document.getElementById('newSkillContent').value;
    if (!name) { window.electronAPI.showToast('Skill name is required', 'error'); return; }
    try {
      await window.electronAPI.invoke('create-skill', { name, content });
      window.electronAPI.showToast('Skill created!', 'success');
      closeNewSkillPanel();
      loadSkills();
    } catch (err) {
      window.electronAPI.showToast(`Error: ${err.message}`, 'error');
    }
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  // Wire skill buttons
  document.getElementById('createSkillBtn').addEventListener('click', openNewSkillPanel);
  document.getElementById('openSkillsFolderBtn').addEventListener('click', () => window.electronAPI.invoke('open-skills-folder'));
  document.getElementById('skillEditorCloseBtn').addEventListener('click', closeSkillEditor);
  document.getElementById('skillEditorCancelBtn').addEventListener('click', closeSkillEditor);
  document.getElementById('skillEditorSaveBtn').addEventListener('click', saveSkillEditor);
  document.getElementById('newSkillCloseBtn').addEventListener('click', closeNewSkillPanel);
  document.getElementById('newSkillCancelBtn').addEventListener('click', closeNewSkillPanel);
  document.getElementById('newSkillSaveBtn').addEventListener('click', createNewSkill);

  // ── About ──────────────────────────────────────────────────

  async function loadAbout() {
    try {
      const version = await window.electronAPI.invoke('get-app-version');
      document.getElementById('appVersionText').textContent = `Version ${version}`;
    } catch {
      document.getElementById('appVersionText').textContent = 'Version unknown';
    }
  }

  if (typeof window !== 'undefined') {
    window.SettingsTab = { init };
  }
})();
