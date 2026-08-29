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
const galleryContainerEl = document.getElementById('gallery-container');
const webcamEl = document.getElementById('webcam');
const canvasEl = document.getElementById('photo-canvas');
const flashOverlayEl = document.getElementById('camera-flash-overlay');

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
const confirmDeleteSingleModal = document.getElementById('confirm-delete-single-modal');
const photoDetailsModal = document.getElementById('photo-details-modal');

// Viewer Elements
const photoViewerModal = document.getElementById('photo-viewer-modal');
const viewerImg = document.getElementById('viewer-img');
const viewerCategoryTag = document.getElementById('viewer-category-tag');

// Blokir Context Menu Bawaan Browser
document.addEventListener('contextmenu', (e) => e.preventDefault());

function init() {
  migratePhotoTimestamps();
  renderCategories();
  renderGallery();
}

function saveData() {
  localStorage.setItem('galeryfir_categories', JSON.stringify(categories));
  localStorage.setItem('galeryfir_photos', JSON.stringify(photos));
}

// Pastikan Semua Foto Memiliki Timestamp
function migratePhotoTimestamps() {
  let changed = false;
  photos.forEach((p, index) => {
    if (!p.timestamp) {
      p.timestamp = Date.now() - (index * 1000); // Penanganan fallback jika foto lama tidak memiliki timestamp
      changed = true;
    }
  });
  if (changed) saveData();
}

// Format Waktu HP: "15.00 WIB, Minggu 30 Agustus 2026"
function formatFullDateTime(timestamp) {
  const d = new Date(timestamp);
  
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const dayName = days[d.getDay()];
  const dayNum = d.getDate();
  const monthName = months[d.getMonth()];
  const year = d.getFullYear();

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${hours}.${minutes} WIB, ${dayName} ${dayNum} ${monthName} ${year}`;
}

// Format Judul Pengelompokan Tanggal (Misal: Hari ini, Kemarin, Minggu 30 Agustus 2026)
function formatDateHeader(timestamp) {
  const d = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return 'Hari ini';
  } else if (d.toDateString() === yesterday.toDateString()) {
    return 'Kemarin';
  } else {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
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

// Render Galeri Foto Dikategori Menurut Waktu (Pengelompokan Waktu)
function renderGallery() {
  galleryContainerEl.innerHTML = '';
  
  // Filter berdasarkan kategori aktif
  const filteredPhotos = activeCategory === 'Semua' 
    ? photos 
    : photos.filter(p => p.category === activeCategory);

  // Kelompokkan foto berdasarkan tanggal
  const groupedByDate = {};

  filteredPhotos.forEach(photo => {
    const dateKey = new Date(photo.timestamp).toDateString();
    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = [];
    }
    groupedByDate[dateKey].push(photo);
  });

  // Urutkan grup tanggal dari yang terbaru
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));

  sortedDates.forEach(dateKey => {
    const groupPhotos = groupedByDate[dateKey];
    const groupHeaderTitle = formatDateHeader(groupPhotos[0].timestamp);

    const groupEl = document.createElement('div');
    groupEl.className = 'date-group';

    const headerEl = document.createElement('div');
    headerEl.className = 'date-header';
    headerEl.innerText = groupHeaderTitle;
    groupEl.appendChild(headerEl);

    const gridEl = document.createElement('div');
    gridEl.className = 'gallery-grid';

    groupPhotos.forEach(photo => {
      const realIndex = photos.indexOf(photo);
      const isSelected = selectedPhotoIndices.includes(realIndex);

      const card = document.createElement('div');
      card.className = `photo-card ${isSelected ? 'selected' : ''}`;
      
      let selectCheckHtml = isSelectionMode ? `<div class="select-checkbox">${isSelected ? '✓' : ''}</div>` : '';

      card.innerHTML = `
        ${selectCheckHtml}
        <img src="${photo.data}" alt="Foto">
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

      card.onclick = () => {
        if (isSelectionMode) {
          togglePhotoSelection(realIndex);
        } else {
          openPhotoViewer(realIndex);
        }
      };

      gridEl.appendChild(card);
    });

    groupEl.appendChild(gridEl);
    galleryContainerEl.appendChild(groupEl);
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

// Pop Up Rincian Foto
document.getElementById('details-single-btn').onclick = () => {
  if (currentViewPhotoIndex !== null) {
    const photo = photos[currentViewPhotoIndex];

    // Hitung Waktu
    document.getElementById('detail-time').innerText = formatFullDateTime(photo.timestamp);
    document.getElementById('detail-category').innerText = photo.category;

    // Hitung Estimasi Ukuran File (Base64)
    const stringLength = photo.data.length - 'data:image/png;base64,'.length;
    const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.5624896;
    const sizeInKB = (sizeInBytes / 1024).toFixed(1);
    document.getElementById('detail-size').innerText = `${sizeInKB} KB`;

    // Hitung Dimensi Foto
    const tempImg = new Image();
    tempImg.src = photo.data;
    tempImg.onload = () => {
      document.getElementById('detail-resolution').innerText = `${tempImg.naturalWidth} x ${tempImg.naturalHeight} px`;
    };

    photoDetailsModal.classList.remove('hidden');
  }
};

document.getElementById('close-details-btn').onclick = () => {
  photoDetailsModal.classList.add('hidden');
};

// Unduh Foto dari Viewer Fullscreen
document.getElementById('download-single-btn').onclick = () => {
  if (currentViewPhotoIndex !== null) {
    executeDownload(photos[currentViewPhotoIndex].data, `Galeryfir_${Date.now()}.png`);
  }
};

// Hapus Foto dari Viewer Fullscreen dengan Konfirmasi
document.getElementById('delete-single-btn').onclick = () => {
  if (currentViewPhotoIndex !== null) {
    confirmDeleteSingleModal.classList.remove('hidden');
  }
};

document.getElementById('close-delete-single-btn').onclick = () => {
  confirmDeleteSingleModal.classList.add('hidden');
};

document.getElementById('final-delete-single-btn').onclick = () => {
  if (currentViewPhotoIndex !== null) {
    photos.splice(currentViewPhotoIndex, 1);
    saveData();
    confirmDeleteSingleModal.classList.add('hidden');
    photoViewerModal.classList.add('hidden');
    currentViewPhotoIndex = null;
    renderGallery();
  }
};

// Eksekusi Unduh File
function executeDownload(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

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
    selectedPhotoIndices = selectedPhotoIndices.filter(idx => !allFilteredIndices.includes(idx));
    if (selectedPhotoIndices.length === 0) exitSelectionMode();
  } else {
    selectedPhotoIndices = Array.from(new Set([...selectedPhotoIndices, ...allFilteredIndices]));
  }

  updateSelectionUI();
  renderGallery();
};

// Multi Download
document.getElementById('multi-download-btn').onclick = () => {
  selectedPhotoIndices.forEach((idx, i) => {
    setTimeout(() => {
      executeDownload(photos[idx].data, `Galeryfir_${Date.now()}_${i + 1}.png`);
    }, i * 300);
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
        category: targetCat,
        timestamp: photos[idx].timestamp || Date.now()
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

// Memotret Foto dengan Timestamp Real-Time & Kedip Kamera
document.getElementById('capture-btn').onclick = () => {
  // 1. Trigger Efek Kedip Layar (Flash)
  flashOverlayEl.classList.add('active');
  setTimeout(() => {
    flashOverlayEl.classList.remove('active');
  }, 100);

  // 2. Ambil Gambar dari Webcam
  const context = canvasEl.getContext('2d');
  canvasEl.width = webcamEl.videoWidth;
  canvasEl.height = webcamEl.videoHeight;
  context.drawImage(webcamEl, 0, 0, canvasEl.width, canvasEl.height);
  
  const photoData = canvasEl.toDataURL('image/png');
  photos.push({
    data: photoData,
    category: 'Semua',
    timestamp: Date.now() // Catat Waktu Real-Time Saat Dipotret
  });
  
  saveData();
  renderGallery(); // Perbarui galeri tanpa menutup kamera

  // 3. Notifikasi Teks Singkat
  const noticeEl = document.getElementById('cam-flash-notice');
  const originalText = noticeEl.innerText;
  noticeEl.innerText = '📸 Foto Tersimpan!';
  noticeEl.style.color = '#ff007f';

  setTimeout(() => {
    noticeEl.innerText = originalText;
    noticeEl.style.color = '#00ffcc';
  }, 1200);
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
