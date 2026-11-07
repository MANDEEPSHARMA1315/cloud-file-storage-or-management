/**
 * Cloud File Storage & Management System
 * Client-Side Controller & AJAX Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initViewToggle();
  initUploadDropzone();
  initPreviewModal();
  initRenameModal();
  initMoveModal();
  initDeleteModal();
  initStarToggle();
  initClientLiveSearch();
  initStorageChart();
});

/* ==========================================================================
   1. Mobile Sidebar Toggle
   ========================================================================== */
function initSidebar() {
  const sidebar = document.getElementById('appSidebar');
  const openBtn = document.getElementById('sidebarOpenBtn');
  const closeBtn = document.getElementById('sidebarCloseBtn');

  if (openBtn && sidebar) {
    openBtn.addEventListener('click', () => {
      sidebar.classList.add('show');
    });
  }

  if (closeBtn && sidebar) {
    closeBtn.addEventListener('click', () => {
      sidebar.classList.remove('show');
    });
  }
}

/* ==========================================================================
   2. Grid vs List View Mode Toggle
   ========================================================================== */
function initViewToggle() {
  const gridBtn = document.getElementById('viewGridBtn');
  const listBtn = document.getElementById('viewListBtn');
  const gridView = document.getElementById('filesGridView');
  const listView = document.getElementById('filesListView');

  if (!gridBtn || !listBtn || !gridView || !listView) return;

  const savedMode = localStorage.getItem('cloud_storage_view_mode') || 'grid';
  setView(savedMode);

  gridBtn.addEventListener('click', () => {
    setView('grid');
    localStorage.setItem('cloud_storage_view_mode', 'grid');
  });

  listBtn.addEventListener('click', () => {
    setView('list');
    localStorage.setItem('cloud_storage_view_mode', 'list');
  });

  function setView(mode) {
    if (mode === 'list') {
      gridView.classList.add('d-none');
      listView.classList.remove('d-none');
      listBtn.classList.add('active', 'bg-light');
      gridBtn.classList.remove('active', 'bg-light');
    } else {
      listView.classList.add('d-none');
      gridView.classList.remove('d-none');
      gridBtn.classList.add('active', 'bg-light');
      listBtn.classList.remove('active', 'bg-light');
    }
  }
}

/* ==========================================================================
   3. Drag & Drop File Upload with AJAX Progress Bar
   ========================================================================== */
function initUploadDropzone() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const selectedContainer = document.getElementById('selectedFilesContainer');
  const selectedList = document.getElementById('selectedFilesList');
  const countBadge = document.getElementById('fileCountBadge');
  const startUploadBtn = document.getElementById('startUploadBtn');
  const progressContainer = document.getElementById('uploadProgressContainer');
  const progressBar = document.getElementById('uploadProgressBar');
  const progressPercentage = document.getElementById('uploadProgressPercentage');
  const progressStatus = document.getElementById('uploadProgressStatus');
  const destinationSelect = document.getElementById('uploadDestinationFolder');

  if (!dropZone || !fileInput) return;

  let fileQueue = [];

  // Drag events
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files) {
      addFiles(fileInput.files);
    }
  });

  function addFiles(files) {
    Array.from(files).forEach(f => {
      // Avoid exact duplicates in queue
      if (!fileQueue.some(item => item.name === f.name && item.size === f.size)) {
        fileQueue.push(f);
      }
    });
    renderQueue();
  }

  function renderQueue() {
    if (fileQueue.length === 0) {
      selectedContainer.classList.add('d-none');
      startUploadBtn.disabled = true;
      return;
    }

    selectedContainer.classList.remove('d-none');
    startUploadBtn.disabled = false;
    countBadge.textContent = fileQueue.length;
    selectedList.innerHTML = '';

    fileQueue.forEach((file, index) => {
      const row = document.createElement('div');
      row.className = 'd-flex align-items-center justify-content-between py-1 border-bottom small';
      row.innerHTML = `
        <div class="text-truncate me-2">
          <i class="fa-solid fa-file text-primary me-2"></i>
          <span class="fw-medium text-dark">${escapeHtml(file.name)}</span>
          <span class="text-muted ms-2">(${formatBytesClient(file.size)})</span>
        </div>
        <button type="button" class="btn btn-sm text-danger p-0 border-0" data-index="${index}">
          <i class="fa-solid fa-xmark"></i>
        </button>
      `;

      row.querySelector('button').addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        fileQueue.splice(idx, 1);
        renderQueue();
      });

      selectedList.appendChild(row);
    });
  }

  // Upload button handler (AJAX with Progress)
  startUploadBtn.addEventListener('click', () => {
    if (fileQueue.length === 0) return;

    const formData = new FormData();
    const folderId = destinationSelect ? destinationSelect.value : null;

    if (folderId && folderId !== 'null') {
      formData.append('folderId', folderId);
    }

    fileQueue.forEach(file => {
      formData.append('files', file);
    });

    // Setup UI for upload
    startUploadBtn.disabled = true;
    dropZone.classList.add('opacity-50', 'pe-none');
    progressContainer.classList.remove('d-none');
    progressBar.style.width = '0%';
    progressPercentage.textContent = '0%';
    progressStatus.textContent = 'Uploading files to AWS S3...';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/files/upload', true);
    xhr.setRequestHeader('Accept', 'application/json');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentComplete = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = percentComplete + '%';
        progressPercentage.textContent = percentComplete + '%';
        if (percentComplete === 100) {
          progressStatus.textContent = 'Finalizing S3 object encryption & saving metadata...';
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          showToast(res.message || 'Files uploaded successfully!', 'success');
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } catch (e) {
          window.location.reload();
        }
      } else {
        let errMessage = 'File upload failed. Please try again.';
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.message) errMessage = res.message;
        } catch (e) {}

        showToast(errMessage, 'danger');
        startUploadBtn.disabled = false;
        dropZone.classList.remove('opacity-50', 'pe-none');
        progressStatus.textContent = 'Upload failed.';
      }
    };

    xhr.onerror = () => {
      showToast('Network error during file upload.', 'danger');
      startUploadBtn.disabled = false;
      dropZone.classList.remove('opacity-50', 'pe-none');
    };

    xhr.send(formData);
  });
}

/* ==========================================================================
   4. Secure File Preview Modal (Images and PDFs)
   ========================================================================== */
function initPreviewModal() {
  const modalEl = document.getElementById('previewModal');
  if (!modalEl) return;

  const bsModal = new bootstrap.Modal(modalEl);
  const titleEl = document.getElementById('previewModalLabel');
  const sizeEl = document.getElementById('previewFileSize');
  const downloadBtn = document.getElementById('previewDownloadBtn');
  const loadingEl = document.getElementById('previewLoading');
  const contentEl = document.getElementById('previewContent');
  const headerIcon = document.getElementById('previewHeaderIcon');

  document.addEventListener('click', async (e) => {
    const trigger = e.target.closest('.btn-preview');
    if (!trigger) return;

    e.preventDefault();
    const fileId = trigger.getAttribute('data-file-id');
    const fileName = trigger.getAttribute('data-file-name');
    const mimeType = trigger.getAttribute('data-mime') || '';

    titleEl.textContent = fileName;
    sizeEl.textContent = 'Generating secure AWS S3 presigned URL...';
    downloadBtn.href = `/api/files/${fileId}/download`;
    loadingEl.classList.remove('d-none');
    contentEl.classList.add('d-none');
    contentEl.innerHTML = '';

    if (mimeType.includes('pdf')) {
      headerIcon.className = 'fa-solid fa-file-pdf text-danger fs-5 me-2';
    } else {
      headerIcon.className = 'fa-solid fa-file-image text-primary fs-5 me-2';
    }

    bsModal.show();

    try {
      const response = await fetch(`/api/files/${fileId}/preview`, {
        headers: { Accept: 'application/json' }
      });
      const data = await response.json();

      if (data.success && data.url) {
        sizeEl.textContent = `${data.file.size} • Presigned S3 access active`;
        loadingEl.classList.add('d-none');
        contentEl.classList.remove('d-none');

        if (data.file.category === 'image') {
          contentEl.innerHTML = `
            <img src="${data.url}" alt="${escapeHtml(fileName)}" class="img-fluid rounded" style="max-height: 75vh; object-fit: contain; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
          `;
        } else if (data.file.category === 'pdf') {
          contentEl.innerHTML = `
            <iframe src="${data.url}" class="w-100 rounded" style="height: 75vh; border: none;"></iframe>
          `;
        }
      } else {
        loadingEl.innerHTML = `<div class="text-danger"><i class="fa-solid fa-circle-exclamation me-2"></i>${data.message || 'Could not load preview'}</div>`;
      }
    } catch (err) {
      loadingEl.innerHTML = `<div class="text-danger"><i class="fa-solid fa-circle-exclamation me-2"></i>Failed to fetch preview link</div>`;
    }
  });
}

/* ==========================================================================
   5. Rename Modal (Files & Folders)
   ========================================================================== */
function initRenameModal() {
  const modalEl = document.getElementById('renameModal');
  if (!modalEl) return;

  const bsModal = new bootstrap.Modal(modalEl);
  const form = document.getElementById('renameForm');
  const input = document.getElementById('renameInput');
  const modalLabel = document.getElementById('renameModalLabel');

  document.addEventListener('click', (e) => {
    const fileBtn = e.target.closest('.btn-rename-file');
    const folderBtn = e.target.closest('.btn-rename-folder');

    if (fileBtn) {
      e.preventDefault();
      const fileId = fileBtn.getAttribute('data-file-id');
      const fileName = fileBtn.getAttribute('data-file-name');

      form.action = `/api/files/${fileId}/rename`;
      input.value = fileName;
      modalLabel.innerHTML = '<i class="fa-solid fa-pen text-primary me-2"></i>Rename File';
      bsModal.show();
    } else if (folderBtn) {
      e.preventDefault();
      const folderId = folderBtn.getAttribute('data-folder-id');
      const folderName = folderBtn.getAttribute('data-folder-name');

      form.action = `/api/folders/${folderId}/rename`;
      input.value = folderName;
      modalLabel.innerHTML = '<i class="fa-solid fa-pen text-warning me-2"></i>Rename Folder';
      bsModal.show();
    }
  });
}

/* ==========================================================================
   6. Move File Modal
   ========================================================================== */
function initMoveModal() {
  const modalEl = document.getElementById('moveModal');
  if (!modalEl) return;

  const bsModal = new bootstrap.Modal(modalEl);
  const form = document.getElementById('moveForm');
  const nameSpan = document.getElementById('moveFileName');

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-move-file');
    if (!btn) return;

    e.preventDefault();
    const fileId = btn.getAttribute('data-file-id');
    const fileName = btn.getAttribute('data-file-name');

    form.action = `/api/files/${fileId}/move`;
    nameSpan.textContent = `"${fileName}"`;
    bsModal.show();
  });
}

/* ==========================================================================
   7. Delete Confirmation Modal (Soft & Permanent)
   ========================================================================== */
function initDeleteModal() {
  const modalEl = document.getElementById('deleteConfirmModal');
  if (!modalEl) return;

  const bsModal = new bootstrap.Modal(modalEl);
  const form = document.getElementById('deleteConfirmForm');
  const msgEl = document.getElementById('deleteMessage');
  const subMsgEl = document.getElementById('deleteSubMessage');
  const submitBtn = document.getElementById('deleteSubmitBtn');

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-delete');
    if (!btn) return;

    e.preventDefault();
    const action = btn.getAttribute('data-action');
    const itemName = btn.getAttribute('data-item-name');
    const itemType = btn.getAttribute('data-item-type') || 'item';
    const isPermanent = btn.getAttribute('data-permanent') === 'true';

    form.action = action;

    if (isPermanent) {
      msgEl.innerHTML = `Are you sure you want to permanently delete <strong>${escapeHtml(itemName)}</strong>?`;
      subMsgEl.innerHTML = `<strong>WARNING:</strong> This action cannot be undone. The object will be irreversibly erased from AWS S3 and database records.`;
      submitBtn.innerHTML = '<i class="fa-solid fa-fire me-2"></i>Delete Forever';
      submitBtn.className = 'btn btn-danger rounded-pill px-4';
    } else {
      msgEl.innerHTML = `Move <strong>${escapeHtml(itemName)}</strong> to Trash?`;
      subMsgEl.innerHTML = `You can restore this ${itemType} at any time from the Trash bin.`;
      submitBtn.innerHTML = '<i class="fa-solid fa-trash me-2"></i>Move to Trash';
      submitBtn.className = 'btn btn-danger rounded-pill px-4';
    }

    bsModal.show();
  });
}

/* ==========================================================================
   8. Favorite / Star Toggle
   ========================================================================== */
function initStarToggle() {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.star-btn');
    if (!btn) return;

    e.preventDefault();
    const fileId = btn.getAttribute('data-file-id');

    try {
      const response = await fetch(`/api/files/${fileId}/star`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
      });
      const data = await response.json();

      if (data.success) {
        if (data.isStarred) {
          btn.classList.remove('text-muted');
          btn.classList.add('text-warning');
          btn.innerHTML = '<i class="fa-solid fa-star"></i>';
          showToast('Added to starred', 'info');
        } else {
          btn.classList.remove('text-warning');
          btn.classList.add('text-muted');
          btn.innerHTML = '<i class="fa-regular fa-star"></i>';
          showToast('Removed from starred', 'info');
        }
      }
    } catch (err) {
      console.error('Star toggle error:', err);
    }
  });
}

/* ==========================================================================
   9. Client-Side Live Search Filter (On Files Page)
   ========================================================================== */
function initClientLiveSearch() {
  const searchInput = document.getElementById('globalSearchInput');
  const items = document.querySelectorAll('.file-item-wrapper');

  if (!searchInput || items.length === 0) return;

  searchInput.addEventListener('input', () => {
    const term = searchInput.value.toLowerCase().trim();
    if (!term) {
      items.forEach(el => el.classList.remove('d-none'));
      return;
    }

    items.forEach(el => {
      const name = el.getAttribute('data-file-name') || '';
      if (name.includes(term)) {
        el.classList.remove('d-none');
      } else {
        el.classList.add('d-none');
      }
    });
  });
}

/* ==========================================================================
   10. Helper Utilities
   ========================================================================== */
function showToast(message, type = 'primary') {
  const toastEl = document.getElementById('liveToast');
  const msgEl = document.getElementById('toastMessage');
  const iconEl = document.getElementById('toastIcon');

  if (!toastEl || !msgEl) return;

  toastEl.className = `toast align-items-center text-white bg-${type} border-0 shadow`;
  msgEl.textContent = message;

  if (type === 'success') {
    iconEl.className = 'fa-solid fa-circle-check me-2 fs-5';
  } else if (type === 'danger') {
    iconEl.className = 'fa-solid fa-triangle-exclamation me-2 fs-5';
  } else {
    iconEl.className = 'fa-solid fa-circle-info me-2 fs-5';
  }

  const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
  toast.show();
}

function formatBytesClient(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function escapeHtml(string) {
  return String(string).replace(/[&<>"'`=\/]/g, function (s) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    }[s];
  });
}

/* ==========================================================================
   11. Storage Usage Chart.js Visualization
   ========================================================================== */
function initStorageChart() {
  const canvas = document.getElementById('storageChart');
  const dataHolder = document.getElementById('chartDataHolder');
  if (!canvas || !dataHolder || typeof Chart === 'undefined') return;

  const images = parseInt(dataHolder.getAttribute('data-images') || '0', 10);
  const docs = parseInt(dataHolder.getAttribute('data-docs') || '0', 10);
  const pdfs = parseInt(dataHolder.getAttribute('data-pdfs') || '0', 10);
  const media = parseInt(dataHolder.getAttribute('data-media') || '0', 10);
  const archives = parseInt(dataHolder.getAttribute('data-archives') || '0', 10);
  const other = parseInt(dataHolder.getAttribute('data-other') || '0', 10);
  const remaining = parseInt(dataHolder.getAttribute('data-remaining') || '524288000', 10);

  const totalUsed = images + docs + pdfs + media + archives + other;

  let labels = [];
  let data = [];
  let backgroundColors = [];

  if (totalUsed === 0) {
    labels = ['Free Space'];
    data = [remaining || 1];
    backgroundColors = ['#e2e8f0'];
  } else {
    if (images > 0) { labels.push('Images'); data.push(images); backgroundColors.push('#4f46e5'); }
    if (docs > 0) { labels.push('Docs'); data.push(docs); backgroundColors.push('#06b6d4'); }
    if (pdfs > 0) { labels.push('PDFs'); data.push(pdfs); backgroundColors.push('#ef4444'); }
    if (media > 0) { labels.push('Media'); data.push(media); backgroundColors.push('#f59e0b'); }
    if (archives > 0) { labels.push('Archives'); data.push(archives); backgroundColors.push('#64748b'); }
    if (other > 0) { labels.push('Other'); data.push(other); backgroundColors.push('#334155'); }
    if (remaining > 0) { labels.push('Available'); data.push(remaining); backgroundColors.push('#e2e8f0'); }
  }

  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColors,
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 12,
            font: { size: 11, family: 'Inter' },
            color: '#475569'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const val = context.raw || 0;
              return ` ${label}: ${formatBytesClient(val)}`;
            }
          }
        }
      },
      cutout: '68%'
    }
  });
}


