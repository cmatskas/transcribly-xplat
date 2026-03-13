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
      }
    } catch { /* defaults */ }

    // Memory status
    try {
      const mem = await window.electronAPI.invoke('memory-status');
      document.getElementById('memoryToggle').checked = mem.enabled && mem.status === 'ACTIVE';
      document.getElementById('memoryStatusText').textContent = mem.enabled ? (mem.status || '') : '';
    } catch {
      document.getElementById('memoryToggle').checked = false;
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

    if (toggle.checked) {
      statusText.textContent = 'Creating...';
      try {
        await window.electronAPI.invoke('memory-enable');
        statusText.textContent = 'ACTIVE';
        window.electronAPI.showToast('Agent Memory enabled!', 'success');
      } catch (err) {
        toggle.checked = false;
        statusText.textContent = '';
        window.electronAPI.showToast(`Failed: ${err.message}`, 'error');
      }
    } else {
      if (!confirm('This will permanently delete all stored memories. Continue?')) {
        toggle.checked = true;
        return;
      }
      statusText.textContent = 'Deleting...';
      try {
        await window.electronAPI.invoke('memory-disable');
        statusText.textContent = '';
        window.electronAPI.showToast('Agent Memory disabled', 'info');
      } catch (err) {
        toggle.checked = true;
        window.electronAPI.showToast(`Failed: ${err.message}`, 'error');
      }
    }
  }

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
