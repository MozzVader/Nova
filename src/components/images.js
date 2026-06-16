import { updateInstance } from '../firebase/db.js';
import { showToast, showLightbox } from './toast.js';

// ── Render Images View ──────────────────────────────────
export function renderImages(container, instance, app) {
  const { images = [] } = instance.data || {};

  container.innerHTML = `
    <div class="images-container">
      <div class="images-header">
        <h2>${escapeHtml(instance.name)}</h2>
        <form class="images-url-form" data-action="add-image">
          <input type="url" placeholder="Pegá la URL de una imagen..." required />
          <button type="submit" class="btn btn-primary btn-sm">Agregar</button>
        </form>
      </div>
      <div class="masonry-grid ${images.length === 0 ? 'masonry-empty' : ''}">
        ${images.length === 0 ? `
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--icon-color)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <p>Agregá imágenes pegando URLs arriba</p>
          </div>
        ` : images.map(img => renderImageItem(img)).join('')}
      </div>
    </div>
  `;

  bindImagesEvents(container, instance, app);
}

function renderImageItem(img) {
  return `
    <div class="masonry-item" data-img-id="${img.id}">
      <div class="masonry-item-actions">
        <button class="btn-icon btn-danger" data-action="delete-image" data-img-id="${img.id}" title="Eliminar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.title || '')}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
      <div style="display:none;padding:32px;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.85rem;">Error al cargar imagen</div>
      <div class="masonry-item-footer">
        <input class="masonry-item-title" value="${escapeHtml(img.title || '')}" placeholder="Título (opcional)..." data-img-id="${img.id}" />
      </div>
    </div>
  `;
}

function bindImagesEvents(container, instance, app) {
  let titleTimeout = null;

  function refreshView() {
    setTimeout(() => app.renderCurrentInstance(), 50);
  }

  // Add image via URL
  container.querySelector('[data-action="add-image"]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const url = input.value.trim();
    if (!url) return;

    const images = [...(instance.data.images || []), {
      id: 'img_' + Date.now(),
      url,
      title: ''
    }];

    try {
      await updateInstance(instance.id, { 'data.images': images });
      input.value = '';
      refreshView();
    } catch (err) {
      console.error('Failed to add image:', err);
    }
  });

  // Click image → lightbox
  container.querySelectorAll('.masonry-item img').forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => {
      const item = img.closest('.masonry-item');
      const titleInput = item.querySelector('.masonry-item-title');
      showLightbox(img.src, titleInput ? titleInput.value : '');
    });
  });

  // Delete image → toast undo
  container.querySelectorAll('[data-action="delete-image"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const imgId = btn.dataset.imgId;
      const imgItem = btn.closest('.masonry-item');

      // Optimistic: hide from DOM immediately
      const originalDisplay = imgItem.style.display;
      imgItem.style.display = 'none';

      // Save backup for undo
      const originalImages = [...(instance.data.images || [])];
      const removedImage = originalImages.find(i => i.id === imgId);

      showToast('Imagen eliminada', async () => {
        // UNDO: restore in DOM
        imgItem.style.display = originalDisplay;
      });

      // Schedule actual delete after 15s
      setTimeout(async () => {
        const images = (instance.data.images || []).filter(i => i.id !== imgId);
        try {
          await updateInstance(instance.id, { 'data.images': images });
        } catch (err) {
          console.error('Failed to delete image:', err);
        }
      }, 15000);
    });
  });

  // Title changes (no re-render needed, save silently)
  container.querySelectorAll('.masonry-item-title').forEach(input => {
    input.addEventListener('input', () => {
      clearTimeout(titleTimeout);
      titleTimeout = setTimeout(async () => {
        const imgId = input.dataset.imgId;
        const images = instance.data.images.map(i =>
          i.id === imgId ? { ...i, title: input.value } : i
        );
        try {
          await updateInstance(instance.id, { 'data.images': images });
        } catch (err) {
          console.error('Failed to update image title:', err);
        }
      }, 500);
    });
    input.addEventListener('click', e => e.stopPropagation());
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}