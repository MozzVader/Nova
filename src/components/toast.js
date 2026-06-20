// ── Toast with Undo ──────────────────────────────────────
// Shows a toast at bottom-center with a 10s countdown bar.
// If user clicks "Deshacer", calls onUndo and cancels deletion.
// If timer expires, calls onConfirm to actually delete.

let toastTimer = null;
let toastAnimFrame = null;

export function showToast(message, onUndo, duration = 10000) {
  // Remove existing toast if any
  clearToast();

  const container = document.getElementById('toast-container');

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
    <button class="toast-undo-btn">Deshacer</button>
    <div class="toast-progress">
      <div class="toast-progress-bar"></div>
    </div>
  `;

  container.appendChild(toast);

  const undoBtn = toast.querySelector('.toast-undo-btn');
  const progressBar = toast.querySelector('.toast-progress-bar');

  let cancelled = false;
  const startTime = Date.now();

  // Animate progress bar
  function animateBar() {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, 1 - elapsed / duration);
    progressBar.style.transform = `scaleX(${remaining})`;
    if (remaining > 0 && !cancelled) {
      toastAnimFrame = requestAnimationFrame(animateBar);
    }
  }

  // Start animation after a frame so the CSS transition on bar initial state works
  requestAnimationFrame(() => {
    progressBar.style.transition = 'transform 0.1s linear';
    toastAnimFrame = requestAnimationFrame(animateBar);
  });

  // Undo button
  undoBtn.addEventListener('click', () => {
    cancelled = true;
    clearToast();
    if (onUndo) onUndo();
  });

  // Auto-confirm when timer expires
  toastTimer = setTimeout(() => {
    if (!cancelled) {
      clearToast();
      // onConfirm not needed — the caller should handle
      // the actual deletion was deferred, now it's time to execute
    }
  }, duration);

  // Return a promise that resolves when timer expires (unless undone)
  return new Promise((resolve) => {
    toastTimer = setTimeout(() => {
      if (!cancelled) {
        clearToast();
        resolve(true); // confirmed
      }
    }, duration);
  });
}

function clearToast() {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  if (toastAnimFrame) {
    cancelAnimationFrame(toastAnimFrame);
    toastAnimFrame = null;
  }
  const container = document.getElementById('toast-container');
  if (container) container.innerHTML = '';
}

// ── Image Lightbox Modal ─────────────────────────────────
export function showLightbox(url, title) {
  const existing = document.getElementById('lightbox-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'lightbox-overlay';
  overlay.innerHTML = `
    <div class="lightbox-backdrop"></div>
    <div class="lightbox-content">
      ${title ? `<div class="lightbox-title">${title}</div>` : ''}
      <img src="${url}" alt="${title || ''}" />
    </div>
  `;

  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => overlay.classList.add('active'));

  // Close handlers
  const close = () => {
    overlay.classList.remove('active');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  };

  overlay.querySelector('.lightbox-backdrop').addEventListener('click', close);
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', handler);
      close();
    }
  });
}