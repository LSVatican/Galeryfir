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
const photoDetailModal = document.getElementById('photo-detail-modal');

// Viewer Elements
const photoViewerModal = document.getElementById('photo-viewer-modal');
const viewerImg = document.getElementById('viewer-img');
const viewerCategoryTag = document.getElementById('viewer-category-tag');

// Blokir Context Menu Bawaan Browser
document.addEventListener('contextmenu', (e) => e.preventDefault());

function init() {
  renderCategories();
  renderGallery();
}

function saveData() {
  localStorage.setItem('galeryfir_categories', JSON.stringify(categories));
  localStorage.setItem('galeryfir_photos', JSON.stringify(photos));
}

// Format Waktu Galeri HP (Contoh: "15.00 WIB, Minggu 30 Agustus 2026")
function formatFullDateTime(timestamp) {
  const date = new Date(timestamp);
  const hariArr = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const bulanArr = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const hari = hariArr[date.getDay()];
  const tgl = date.getDate();
  const bln = bulanArr[date.getMonth()];
  const thn = date.getFullYear();

  return `${hh}.${mm} WIB, ${hari} ${tgl} ${bln} ${thn}`;
}

// Label Kategori Waktu Singkat
function getTimeCategoryLabel(timestamp) {
  const photoDate = new Date(timestamp);
  const now = new Date();

  const isToday = photoDate.toDateString() === now.toDateString();
  if (isToday) return 'Hari Ini';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (photoDate.toDateString() === yesterday.toDateString()) return 'Kemarin';

  const hariArr = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const bulanArr = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  return `${hariArr[photoDate.getDay()]}, ${photoDate.getDate()} ${bulanArr[photoDate.getMonth()]} ${photoDate.getFullYear()}`;
}

// Format Perhitungan Waktu Berlalu
function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${Math.max(1, seconds)} detik yang lalu`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit yang lalu`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam yang lalu`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari yang lalu`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} bulan yang lalu`;

  const years = Math.floor(months / 12);
  return `${years} tahun yang lalu`;
}

// Render Navigasi Kategori Kustom + Kategori Waktu Otomatis
function renderCategories() {
  categoryListEl.innerHTML = '';

  // Dapatkan semua Kategori Waktu dari foto-foto yang ada
  const timeCategories = [...new Set(photos.map(p => getTimeCategoryLabel(p.timestamp || Date.now())))];

  // Combine semua kategori
  const allNavList = [...categories];
  timeCategories.forEach(tc => {
    if (!allNavList.includes(tc)) allNavList.push(tc);
  });

  allNavList.forEach(cat => {
    const isTimeCat = timeCategories.includes(cat) && !categories.includes(cat);
    const chip = document.createElement('div');
    chip.className = `cat-chip ${cat === activeCategory ? 'active' : ''} ${isTimeCat ? 'time-chip' : ''}`;
    
    let content = `<span>${isTimeCat ? '📅 ' : ''}${cat}</span>`;
    if (!isTimeCat && cat !== 'Semua') {
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
  
  const filteredPhotos = photos.filter(p => {
    if (activeCategory === 'Semua') return true;
    if (categories.includes(activeCategory)) return p.category === activeCategory;
    // Filter Kategori Waktu
    return getTimeCategoryLabel(p.timestamp || Date.now()) === activeCategory;
  });

  filteredPhotos.forEach((photo) => {
    const realIndex = photos.indexOf(photo);
    const isSelected = selectedPhotoIndices.includes(realIndex);

    const card = document.createElement('div');
    card.className = `photo-card ${isSelected ? 'selected' : ''}`;
    
    let selectCheckHtml = isSelectionMode ? `<div class="select-checkbox">${isSelected ? '✓' : ''}</div>` : '';
    let timeLabel = getTimeCategoryLabel(photo.timestamp || Date.now());

    card.innerHTML = `
      ${selectCheckHtml}
      <img src="${photo.data}" alt="Foto">
      <div class="photo-card-time">${timeLabel}</div>
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

// Pop Up Rincian / Detail Foto
document.getElementById('info-single-btn').onclick = () => {
  if (currentViewPhotoIndex !== null) {
    const photo = photos[currentViewPhotoIndex];
    const ts = photo.timestamp || Date.now();

    document.getElementById('info-cat').innerText = photo.category;
    document.getElementById('info-time').innerText = formatFullDateTime(ts);
    document.getElementById('info-time-ago').innerText = timeAgo(ts);

    // Hitung Estimasi Ukuran & Resolusi
    const tempImg = new Image();
    tempImg.src = photo.data;
    tempImg.onload = () => {
      document.getElementById('info-resolution').innerText = `${tempImg.width} x ${tempImg.height} piksel`;
      
      // Estimasi KB/MB dari String Base64
      const stringLength = photo.data.length - 'data:image/png;base64,'.length;
      const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.5624;
      const sizeInKB = (sizeInBytes / 1024).toFixed(1);
      
      document.getElementById('info-size').innerText = sizeInKB > 1024 
        ? `${(sizeInKB / 1024).toFixed(2)} MB` 
        : `${sizeInKB} KB`;
    };

    photoDetailModal.classList.remove('hidden');
  }
};

document.getElementById('close-detail-btn').onclick = () => {
  photoDetailModal.classList.add('hidden');
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
    renderCategories();
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
  const filteredPhotos = photos.filter(p => {
    if (activeCategory === 'Semua') return true;
    if (categories.includes(activeCategory)) return p.category === activeCategory;
    return getTimeCategoryLabel(p.timestamp || Date.now()) === activeCategory;
  });

  const allFilteredIndices = filteredPhotos.map(p => photos.indexOf(p));
  const isAllSelected = allFilteredIndices.length > 0 && allFilteredIndices.every(idx => selectedPhotoIndices.includes(idx));

  if (isAllSelected) {
    toggleSelectAllBtn.innerText = 'Batal Pilih Semua';
  } else {
    toggleSelectAllBtn.innerText = 'Pilih Semua';
  }
}

toggleSelectAllBtn.onclick = () => {
  const filteredPhotos = photos.filter(p => {
    if (activeCategory === 'Semua') return true;
    if (categories.includes(activeCategory)) return p.category === activeCategory;
    return getTimeCategoryLabel(p.timestamp || Date.now()) === activeCategory;
  });

  const allFilteredIndices = filteredPhotos.map(p => photos.indexOf(p));
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
  renderCategories();
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

// Memotret Foto dengan Timestamp & Kedip Kamera
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
    timestamp: Date.now() // Simpan waktu terpotret
  });
  
  saveData();
  renderCategories();
  renderGallery();

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
