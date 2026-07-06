// API operations for Cloudinary and MongoDB backend

// Save photo to backend via POST request
async function savePhoto(wingId, file) {
  const formData = new FormData();
  formData.append('wingId', wingId);
  formData.append('file', file);

  const response = await fetch('/api/photos', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to upload photo to server');
  }

  return await response.json();
}

// Retrieve photos for a specific wing from backend
async function getPhotos(wingId) {
  const response = await fetch(`/api/photos/${wingId}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch photos from server');
  }

  return await response.json();
}

// Delete a photo from backend via DELETE request
async function deletePhoto(id) {
  const response = await fetch(`/api/photos/${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to delete photo from server');
  }

  return await response.json();
}

// Setup uploader and gallery logic
function initGallery() {
  const galleryEl = document.getElementById('photoGallery');
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');

  if (!galleryEl) return;

  const wingId = galleryEl.getAttribute('data-wing-id');
  const isAdminMode = !!(uploadZone && fileInput);

  // IntersectionObserver for cards animation
  const galleryObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity = '1';
        e.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  // Render function
  const render = async () => {
    try {
      const currentWingId = galleryEl.getAttribute('data-wing-id') || wingId;
      const photos = await getPhotos(currentWingId);
      galleryEl.innerHTML = '';
      
      if (photos.length === 0) {
        galleryEl.innerHTML = `
          <div class="no-photos-message">
            <p>No photos uploaded yet. Photos uploaded by the administrator will appear here.</p>
          </div>
        `;
        return;
      }
      
      photos.forEach(photo => {
        const card = document.createElement('div');
        card.className = 'gallery-card';
        
        let deleteBtnHtml = '';
        if (isAdminMode) {
          deleteBtnHtml = `<button class="delete-btn" title="Delete Photo" data-id="${photo.id}">×</button>`;
        }
        
        card.innerHTML = `
          <img src="${photo.data}" alt="${photo.name}" />
          ${deleteBtnHtml}
        `;
        
        // Initial style for fade/slide animation
        card.style.opacity = '0';
        card.style.transform = 'translateY(24px)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        
        galleryEl.appendChild(card);
        galleryObserver.observe(card);
        
        if (isAdminMode) {
          // Delete handler
          card.querySelector('.delete-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            const photoId = e.target.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this photo?')) {
              try {
                await deletePhoto(photoId);
                render();
              } catch (err) {
                alert('Failed to delete image: ' + err.message);
              }
            }
          });
        }
      });
    } catch (err) {
      console.error('Failed to load photos:', err);
      galleryEl.innerHTML = `
        <div class="no-photos-message">
          <p style="color: var(--magenta);">⚠️ Error loading photos: ${err.message}</p>
        </div>
      `;
    }
  };

  // Only bind upload events if uploader elements are present
  if (isAdminMode) {
    // Process files helper
    const handleFiles = async (filesList) => {
      const currentWingId = galleryEl.getAttribute('data-wing-id') || wingId;
      let files = Array.from(filesList);

      // Enforce maximum batch size of 20 images
      if (files.length > 20) {
        alert('Upload Limit: You can upload a maximum of 20 images at a time. Only the first 20 images will be processed.');
        files = files.slice(0, 20);
      }
      
      // Show uploading indicator in dropzone
      const originalText = uploadZone.querySelector('.upload-text').innerHTML;
      uploadZone.style.opacity = '0.7';
      uploadZone.style.pointerEvents = 'none';

      try {
        let uploadedCount = 0;
        for (let file of files) {
          if (!file.type.startsWith('image/')) {
            alert('Only image files are allowed!');
            continue;
          }
          uploadedCount++;
          uploadZone.querySelector('.upload-text').innerHTML = `Uploading photo ${uploadedCount} of ${files.length}... Please wait.`;
          await savePhoto(currentWingId, file);
        }
      } catch (err) {
        alert('Failed to save image: ' + err.message);
      } finally {
        // Restore dropzone state
        uploadZone.querySelector('.upload-text').innerHTML = originalText;
        uploadZone.style.opacity = '1';
        uploadZone.style.pointerEvents = 'auto';
      }
      render();
    };

    // Trigger file selection
    uploadZone.addEventListener('click', () => fileInput.click());

    // Stop click events bubbling up when fileInput is clicked/triggered to prevent mobile click loops
    fileInput.addEventListener('click', (e) => e.stopPropagation());

    // Input change
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFiles(e.target.files);
        fileInput.value = ''; // Reset file input
      }
    });

    // Drag and Drop events
    ['dragenter', 'dragover'].forEach(eventName => {
      uploadZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.remove('dragover');
      }, false);
    });

    uploadZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        handleFiles(files);
      }
    });

    // Clipboard Paste support
    document.addEventListener('paste', (e) => {
      // Ignore paste events if typing in text inputs or textareas
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'TEXTAREA' || (activeEl.tagName === 'INPUT' && activeEl.type !== 'file'))) {
        return;
      }

      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData) return;

      const files = [];
      const items = clipboardData.items || [];
      for (let item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          files.push(file);
        }
      }

      if (files.length > 0) {
        handleFiles(files);
      }
    });
  }

  // Initial load
  render();

  // Expose render function for dynamic updates (e.g. in Admin Panel)
  galleryEl.refreshGallery = render;
}

// Expose API to window object
window.DhaathreeGallery = {
  savePhoto,
  getPhotos,
  deletePhoto,
  initGallery
};

document.addEventListener('DOMContentLoaded', initGallery);
