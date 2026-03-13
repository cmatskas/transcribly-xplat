/**
 * Shared file management utilities for file attachment UI.
 * Parameterized by element IDs so both Analyze and Work tabs can use their own inputs.
 */

function createFileManager({ fileInputId, attachBtnId, clearBtnId, listSectionId, listId, countId, maxFiles = 5 }) {
  let selectedFiles = [];

  const validExtensions = ['.pdf', '.csv', '.doc', '.docx', '.xls', '.xlsx', '.html', '.txt', '.md'];
  const maxSize = 4.5 * 1024 * 1024; // 4.5MB — Bedrock Converse API limit per document

  function setup(showToast) {
    const fileInput = document.getElementById(fileInputId);
    const attachBtn = document.getElementById(attachBtnId);
    const clearBtn = document.getElementById(clearBtnId);

    attachBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);

      // Check total count (existing + new)
      if (selectedFiles.length + files.length > maxFiles) {
        showToast(`Maximum ${maxFiles} files total. You have ${selectedFiles.length}, tried to add ${files.length}.`, 'error');
        e.target.value = '';
        return;
      }

      // Check for duplicates by name
      const existingNames = new Set(selectedFiles.map(f => f.name));

      for (const file of files) {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!validExtensions.includes(ext)) {
          showToast(`File type ${ext} not supported`, 'error');
          e.target.value = '';
          return;
        }
        if (file.size > maxSize) {
          showToast(`File ${file.name} exceeds 4.5MB Bedrock limit`, 'error');
          e.target.value = '';
          return;
        }
      }

      try {
        for (const file of files) {
          if (existingNames.has(file.name)) continue; // skip duplicates
          selectedFiles.push({
            name: file.name,
            content: await readFileAsArrayBuffer(file),
            mimeType: getMimeType(file.name),
            size: file.size,
          });
        }
        e.target.value = ''; // reset input so same file can be re-added
        updateFileList();
        showToast(`${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} attached`, 'success');
      } catch (error) {
        showToast('Error processing files', 'error');
        e.target.value = '';
      }
    });

    clearBtn.addEventListener('click', () => {
      selectedFiles = [];
      fileInput.value = '';
      updateFileList();
      showToast('All files cleared', 'info');
    });
  }

  function getFiles() { return selectedFiles; }

  function clearFiles() {
    selectedFiles = [];
    const fileInput = document.getElementById(fileInputId);
    if (fileInput) fileInput.value = '';
    updateFileList();
  }

  function updateFileList() {
    const section = document.getElementById(listSectionId);
    const list = document.getElementById(listId);
    const count = document.getElementById(countId);
    const attachBtn = document.getElementById(attachBtnId);

    if (selectedFiles.length === 0) {
      section.style.display = 'none';
      attachBtn.classList.remove('has-files');
      return;
    }

    section.style.display = 'block';
    count.textContent = selectedFiles.length;
    attachBtn.classList.add('has-files');

    list.innerHTML = selectedFiles.map((file, index) => {
      const ext = file.name.toLowerCase().split('.').pop();
      return `
        <div class="d-flex justify-content-between align-items-center mb-1 p-1 border rounded">
          <div class="d-flex align-items-center">
            <i class="${getFileIcon(ext)} me-2 text-primary"></i>
            <div>
              <div class="small fw-medium">${file.name}</div>
              <small class="text-muted">${formatFileSize(file.size)}</small>
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-outline-danger py-0 px-1 file-remove-btn" data-index="${index}">
            <i class="bi bi-x"></i>
          </button>
        </div>`;
    }).join('');

    list.querySelectorAll('.file-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedFiles.splice(parseInt(btn.dataset.index), 1);
        if (selectedFiles.length === 0) document.getElementById(fileInputId).value = '';
        updateFileList();
      });
    });
  }

  return { setup, getFiles, clearFiles, updateFileList };
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const ext = file.name.toLowerCase().split('.').pop();
    reader.onload = (e) => {
      if (['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)) {
        resolve(Array.from(new Uint8Array(e.target.result)));
      } else {
        resolve(new TextDecoder().decode(e.target.result));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function getMimeType(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const types = {
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv', html: 'text/html', md: 'text/markdown', txt: 'text/plain',
  };
  return types[ext] || 'text/plain';
}

function getFileIcon(ext) {
  const icons = {
    pdf: 'bi bi-file-earmark-pdf', doc: 'bi bi-file-earmark-word', docx: 'bi bi-file-earmark-word',
    xls: 'bi bi-file-earmark-excel', xlsx: 'bi bi-file-earmark-excel',
    csv: 'bi bi-file-earmark-spreadsheet', html: 'bi bi-file-earmark-code',
    md: 'bi bi-file-earmark-richtext', txt: 'bi bi-file-earmark-text',
  };
  return icons[ext] || 'bi bi-file-earmark-text';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createFileManager, readFileAsArrayBuffer, getMimeType, getFileIcon, formatFileSize };
}
if (typeof window !== 'undefined') {
  window.FileManager = { createFileManager, readFileAsArrayBuffer, getMimeType, getFileIcon, formatFileSize };
}
