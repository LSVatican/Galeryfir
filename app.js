// State Aplikasi
let categories = JSON.parse(localStorage.getItem('galeryfir_categories')) || ['Semua'];
let photos = JSON.parse(localStorage.getItem('galeryfir_photos')) || [];
let activeCategory = 'Semua';
let activeEditCategory = null;
let mediaStream = null;
let trackState = null;
let generatedCode = '';
let currentViewPhotoIndex = null;

// Mode Seleksi Multi-Foto
let isSelectionMode = false;
let selectedPhotoIndices = [];
let pendingActionType = 'move';

// DOM Elements
const categoryListEl = document.getElementById('category-list');
const galleryGridEl = document.getElementById('gallery-grid');
const webcamEl = document.getElementById('webcam');
const canvasEl = document.getElementById('photo-canvas');

const selectBarEl = document.getElementById('select-bar');
const selectedCountEl = document.getElementById('selected-count');
const toggleSelectAllBtn = document.getElementById('toggle-select-all-btn');

// Modal Elements
const cameraModal = document.getElementById('camera-modal');
const addCatModal = document.getElementById('add-cat-modal');
const editCatModal = document.getElementById('edit-cat-modal');
const movePhotoModal = document.getElementById('move-photo-modal');
const confirmDeleteModal = document.getElementById('confirm-delete-modal');
const confirmDeletePhotosModal = document.getElementById('confirm-delete-photos-modal');

// Viewer Elements
const photoViewerModal = document.getElementById('photo-viewer-modal');
const viewerImg = document.getElementById('viewer-img');
const viewerCategoryTag = document.getElementById('viewer-category-tag');

// Blokir Context Menu
document.addEventListener('contextmenu', (e) => e.preventDefault());

function init() {
  renderCategories();
  renderGallery();
}

function saveData() {
  localStorage.setItem('galeryfir_categories', JSON.stringify(categories));
  localStorage.setItem('galeryfir_photos', JSON.stringify(photos));
}

// Render Navigasi Kategori
function renderCategories() {
  categoryListEl.innerHTML = '';
  categories.forEach(cat => {
    const chip = document.createElement('div');
    chip.className = `cat-chip ${cat === activeCategory ? 'active' : ''}`;
    
    let content = `<span>${cat}</span>`;
    if (cat !== 'Semua') {
      content += `<span class="edit-cat-trigger" onclick="openEditCategoryModal(event, '${cat}')">⚙️</span>`;
    }
    chip.innerHTML = content;
    chip.onclick = () => {
      if (isSelectionMode) exitSelectionMode();
      activeCategory = cat;
      renderCategories();
      renderGallery();
    };
    categoryListEl.appendChild(chip);
  });
}

// Render Galeri Foto
function renderGallery() {
  galleryGridEl.innerHTML = '';
  const filteredPhotos = activeCategory === 'Semua' 
    ? photos 
    : photos.filter(p => p.category === activeCategory);

  filteredPhotos.forEach((photo) => {
    const realIndex = photos.indexOf(photo);
    const isSelected = selectedPhotoIndices.includes(realIndex);

    const card = document.createElement('div');
    card.className = `photo-card ${isSelected ? 'selected' : ''}`;
    
    let selectCheckHtml = isSelectionMode ? `<div class="select-checkbox">${isSelected ? '✓' : ''}</div>` : '';
    let downloadBtnHtml = !isSelectionMode ? `<button class="photo-download-btn" onclick="downloadSinglePhoto(event, ${realIndex})">⬇️</button>` : '';

    card.innerHTML = `
      ${selectCheckHtml}
      <img src="${photo.data}" alt="Foto">
      ${downloadBtnHtml}
    `;

    // Long Press & Klik Handler
    let pressTimer;

    const startPress = () => {
      pressTimer = setTimeout(() => {
        if (!isSelectionMode) {
          enterSelectionMode(realIndex);
        }
      }, 500);
    };

    const cancelPress = () => clearTimeout(pressTimer);

    card.addEventListener('mousedown', startPress);
    card.addEventListener('mouseup', cancelPress);
    card.addEventListener('mouseleave', cancelPress);

    card.addEventListener('touchstart', startPress, { passive: true });
    card.addEventListener('touchend', cancelPress);
    card.addEventListener('touchcancel', cancelPress);

    card.onclick = (e) => {
      if (isSelectionMode) {
        togglePhotoSelection(realIndex);
      } else {
        // Jika bukan tombol unduh yang diklik, buka Viewer
        if (!e.target.classList.contains('photo-download-btn')) {
          openPhotoViewer(realIndex);
        }
      }
    };

    galleryGridEl.appendChild(card);
  });

  updateToggleSelectAllButtonState();
}

// System Viewer Foto Fullscreen
function openPhotoViewer(index) {
  currentViewPhotoIndex = index;
  viewerImg.src = photos[index].data;
  viewerCategoryTag.innerText = photos[index].category;
  photoViewerModal.classList.remove('hidden');
}

document.getElementById('close-viewer-btn').onclick = () => {
  photoViewerModal.classList.add('hidden');
  currentViewPhotoIndex = null;
};

document.getElementById('download-single-btn').onclick = () => {
  if (currentViewPhotoIndex !== null) {
    executeDownload(photos[currentViewPhotoIndex].data, `Galeryfir_${Date.now()}.png`);
  }
};

// System Unduh Gambar
function executeDownload(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

window.downloadSinglePhoto = (event, index) => {
  event.stopPropagation();
  executeDownload(photos[index].data, `Galeryfir_${Date.now()}.png`);
};

// Mode Seleksi Multi-Foto
function enterSelectionMode(firstIndex) {
  isSelectionMode = true;
  selectedPhotoIndices = [firstIndex];
  selectBarEl.classList.remove('hidden');
  updateSelectionUI();
  renderGallery();
}

function exitSelectionMode() {
  isSelectionMode = false;
  selectedPhotoIndices = [];
  selectBarEl.classList.add('hidden');
  renderGallery();
}

function togglePhotoSelection(index) {
  const pos = selectedPhotoIndices.indexOf(index);
  if (pos > -1) {
    selectedPhotoIndices.splice(pos, 1);
  } else {
    selectedPhotoIndices.push(index);
  }

  if (selectedPhotoIndices.length === 0) {
    exitSelectionMode();
  } else {
    updateSelectionUI();
    renderGallery();
  }
}

function updateSelectionUI() {
  selectedCountEl.innerText = `${selectedPhotoIndices.length} Terpilih`;
}

// Tombol Toggle "Pilih Semua" / "Batal Pilih Semua"
function updateToggleSelectAllButtonState() {
  const currentFiltered = activeCategory === 'Semua' 
    ? photos 
    : photos.filter(p => p.category === activeCategory);

  const allFilteredIndices = currentFiltered.map(p => photos.indexOf(p));
  const isAllSelected = allFilteredIndices.length > 0 && allFilteredIndices.every(idx => selectedPhotoIndices.includes(idx));

  if (isAllSelected) {
    toggleSelectAllBtn.innerText = 'Batal Pilih Semua';
  } else {
    toggleSelectAllBtn.innerText = 'Pilih Semua';
  }
}

toggleSelectAllBtn.onclick = () => {
  const currentFiltered = activeCategory === 'Semua' 
    ? photos 
    : photos.filter(p => p.category === activeCategory);

  const allFilteredIndices = currentFiltered.map(p => photos.indexOf(p));
  const isAllSelected = allFilteredIndices.every(idx => selectedPhotoIndices.includes(idx));

  if (isAllSelected) {
    // Batalkan semua seleksi untuk kategori aktif
    selectedPhotoIndices = selectedPhotoIndices.filter(idx => !allFilteredIndices.includes(idx));
    if (selectedPhotoIndices.length === 0) exitSelectionMode();
  } else {
    // Pilih semua foto di kategori aktif
    selectedPhotoIndices = Array.from(new Set([...selectedPhotoIndices, ...allFilteredIndices]));
  }

  updateSelectionUI();
  renderGallery();
};

// Download Banyak Foto
document.getElementById('multi-download-btn').onclick = () => {
  selectedPhotoIndices.forEach((idx, i) => {
    setTimeout(() => {
      executeDownload(photos[idx].data, `Galeryfir_${Date.now()}_${i + 1}.png`);
    }, i * 300); // Penundaan kecil agar browser mengizinkan unduhan bertahap
  });
};

document.getElementById('cancel-select-btn').onclick = exitSelectionMode;

// Pindah & Salin Multi Foto
document.getElementById('multi-move-btn').onclick = () => {
  if (selectedPhotoIndices.length === 0) return;
  pendingActionType = 'move';
  document.getElementById('move-modal-title').innerText = 'Pindahkan Foto Terpilih Ke:';
  openMoveModal();
};

document.getElementById('multi-copy-btn').onclick = () => {
  if (selectedPhotoIndices.length === 0) return;
  pendingActionType = 'copy';
  document.getElementById('move-modal-title').innerText = 'Salin Foto Terpilih Ke:';
  openMoveModal();
};

function openMoveModal() {
  const selectEl = document.getElementById('move-cat-select');
  selectEl.innerHTML = '';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    selectEl.appendChild(opt);
  });
  movePhotoModal.classList.remove('hidden');
}

document.getElementById('close-move-btn').onclick = () => movePhotoModal.classList.add('hidden');

document.getElementById('confirm-move-btn').onclick = () => {
  const targetCat = document.getElementById('move-cat-select').value;

  if (pendingActionType === 'move') {
    selectedPhotoIndices.forEach(idx => {
      photos[idx].category = targetCat;
    });
  } else if (pendingActionType === 'copy') {
    selectedPhotoIndices.forEach(idx => {
      photos.push({
        data: photos[idx].data,
        category: targetCat
      });
    });
  }

  saveData();
  movePhotoModal.classList.add('hidden');
  exitSelectionMode();
};

// Hapus Multi Foto
document.getElementById('multi-delete-btn').onclick = () => {
  if (selectedPhotoIndices.length === 0) return;
  document.getElementById('delete-photos-count-text').innerText = 
    `Apakah Anda yakin ingin menghapus ${selectedPhotoIndices.length} foto terpilih?`;
  confirmDeletePhotosModal.classList.remove('hidden');
};

document.getElementById('close-delete-photos-btn').onclick = () => confirmDeletePhotosModal.classList.add('hidden');

document.getElementById('final-delete-photos-btn').onclick = () => {
  selectedPhotoIndices.sort((a, b) => b - a);
  selectedPhotoIndices.forEach(idx => {
    photos.splice(idx, 1);
  });

  saveData();
  confirmDeletePhotosModal.classList.add('hidden');
  exitSelectionMode();
};

// Kamera & Senter
document.getElementById('open-cam-btn').onclick = async () => {
  cameraModal.classList.remove('hidden');
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    webcamEl.srcObject = mediaStream;
    trackState = mediaStream.getVideoTracks()[0];
  } catch (err) {
    alert('Gagal mengakses kamera: ' + err.message);
    cameraModal.classList.add('hidden');
  }
};

document.getElementById('close-cam-btn').onclick = stopCamera;

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
  }
  cameraModal.classList.add('hidden');
}

document.getElementById('torch-btn').onclick = async () => {
  if (trackState) {
    const capabilities = trackState.getCapabilities();
    if (capabilities.torch) {
      const currentMode = trackState.getConstraints().torch;
      await trackState.applyConstraints({ advanced: [{ torch: !currentMode }] });
    } else {
      alert('Fitur senter tidak didukung di perangkat ini.');
    }
  }
};

document.getElementById('capture-btn').onclick = () => {
  const context = canvasEl.getContext('2d');
  canvasEl.width = webcamEl.videoWidth;
  canvasEl.height = webcamEl.videoHeight;
  context.drawImage(webcamEl, 0, 0, canvasEl.width, canvasEl.height);
  
  const photoData = canvasEl.toDataURL('image/png');
  photos.push({
    data: photoData,
    category: 'Semua'
  });
  
  saveData();
  renderGallery();
  stopCamera();
};

// Tambah Kategori
document.getElementById('add-cat-btn').onclick = () => addCatModal.classList.remove('hidden');
document.getElementById('close-add-cat-btn').onclick = () => addCatModal.classList.add('hidden');

document.getElementById('save-cat-btn').onclick = () => {
  const input = document.getElementById('new-cat-input');
  const catName = input.value.trim();
  if (catName && !categories.includes(catName)) {
    categories.push(catName);
    saveData();
    renderCategories();
    input.value = '';
    addCatModal.classList.add('hidden');
  }
};

// Edit & Hapus Kategori
window.openEditCategoryModal = (event, catName) => {
  event.stopPropagation();
  activeEditCategory = catName;
  document.getElementById('edit-cat-input').value = catName;
  editCatModal.classList.remove('hidden');
};

document.getElementById('close-edit-cat-btn').onclick = () => editCatModal.classList.add('hidden');

document.getElementById('update-cat-btn').onclick = () => {
  const newName = document.getElementById('edit-cat-input').value.trim();
  if (newName && !categories.includes(newName)) {
    const index = categories.indexOf(activeEditCategory);
    categories[index] = newName;
    photos.forEach(p => {
      if (p.category === activeEditCategory) p.category = newName;
    });
    if (activeCategory === activeEditCategory) activeCategory = newName;
    saveData();
    renderCategories();
    renderGallery();
    editCatModal.classList.add('hidden');
  }
};

document.getElementById('delete-cat-btn').onclick = () => {
  editCatModal.classList.add('hidden');
  generatedCode = Math.floor(1000 + Math.random() * 9000).toString();
  document.getElementById('random-code-display').innerText = generatedCode;
  document.getElementById('verify-code-input').value = '';
  confirmDeleteModal.classList.remove('hidden');
};

document.getElementById('close-confirm-del-btn').onclick = () => confirmDeleteModal.classList.add('hidden');

document.getElementById('final-delete-btn').onclick = () => {
  const inputCode = document.getElementById('verify-code-input').value.trim();
  if (inputCode === generatedCode) {
    categories = categories.filter(c => c !== activeEditCategory);
    photos.forEach(p => {
      if (p.category === activeEditCategory) p.category = 'Semua';
    });
    activeCategory = 'Semua';
    saveData();
    renderCategories();
    renderGallery();
    confirmDeleteModal.classList.add('hidden');
  } else {
    alert('Kode verifikasi salah!');
  }
};

// Inisialisasi awal
init();
