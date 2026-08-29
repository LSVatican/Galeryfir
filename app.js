// State Aplikasi
let categories = JSON.parse(localStorage.getItem('galeryfir_categories')) || ['Semua'];
let photos = JSON.parse(localStorage.getItem('galeryfir_photos')) || [];
let activeCategory = 'Semua';
let activeEditCategory = null;
let activePhotoIndexToMove = null;
let mediaStream = null;
let trackState = null;
let generatedCode = '';

// Elemen DOM
const categoryListEl = document.getElementById('category-list');
const galleryGridEl = document.getElementById('gallery-grid');
const webcamEl = document.getElementById('webcam');
const canvasEl = document.getElementById('photo-canvas');

// Modal Elements
const cameraModal = document.getElementById('camera-modal');
const addCatModal = document.getElementById('add-cat-modal');
const editCatModal = document.getElementById('edit-cat-modal');
const movePhotoModal = document.getElementById('move-photo-modal');
const confirmDeleteModal = document.getElementById('confirm-delete-modal');

// Inisialisasi
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
      activeCategory = cat;
      renderCategories();
      renderGallery();
    };
    categoryListEl.appendChild(chip);
  });
}

// Render Galeri
function renderGallery() {
  galleryGridEl.innerHTML = '';
  const filteredPhotos = activeCategory === 'Semua' 
    ? photos 
    : photos.filter(p => p.category === activeCategory);

  filteredPhotos.forEach((photo, index) => {
    const realIndex = photos.indexOf(photo);
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.innerHTML = `
      <img src="${photo.data}" alt="Foto">
      <button class="move-btn" onclick="openMoveModal(${realIndex})">📌 ${photo.category}</button>
    `;
    galleryGridEl.appendChild(card);
  });
}

// Fitur Kamera & Senter
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

// Fitur Tambah Kategori
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

// Fitur Edit & Hapus Kategori
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

// Fitur Memindahkan Foto
window.openMoveModal = (index) => {
  activePhotoIndexToMove = index;
  const selectEl = document.getElementById('move-cat-select');
  selectEl.innerHTML = '';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (cat === photos[index].category) opt.selected = true;
    selectEl.appendChild(opt);
  });
  movePhotoModal.classList.remove('hidden');
};

document.getElementById('close-move-btn').onclick = () => movePhotoModal.classList.add('hidden');

document.getElementById('confirm-move-btn').onclick = () => {
  const selectedCat = document.getElementById('move-cat-select').value;
  if (activePhotoIndexToMove !== null) {
    photos[activePhotoIndexToMove].category = selectedCat;
    saveData();
    renderGallery();
    movePhotoModal.classList.add('hidden');
  }
};

// Jalankan saat pertama dimuat
init();
