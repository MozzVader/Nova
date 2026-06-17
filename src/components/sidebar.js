import { onInstancesChange, createInstance, updateInstance, deleteInstance } from '../firebase/db.js';

// ── Sidebar Controller ─────────────────────────────────
export function initSidebar(app) {
  const categoriesEl = document.querySelector('.sidebar-categories');
  const instancesListEl = document.getElementById('instances-list');
  const instancesTitle = document.getElementById('instances-title');
  const btnNew = document.getElementById('btn-new-instance');
  const btnLogout = document.getElementById('btn-logout');
  const userEmail = document.getElementById('user-email');
  const themeToggle = document.getElementById('theme-toggle');

  // Show user email
  if (app.user?.email) {
    userEmail.textContent = app.user.email;
  }

  // ── Category buttons ──
  categoriesEl.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.category;
      app.selectCategory(category);
    });
  });

  // ── New instance ──
  btnNew.addEventListener('click', async () => {
    if (!app.currentCategory) return;
    try {
      const instance = await createInstance(app.currentCategory);
      app.selectInstance(instance.id);
    } catch (err) {
      console.error('Failed to create instance:', err);
    }
  });

  // ── Logout ──
  btnLogout.addEventListener('click', async () => {
    const { signOut } = await import('../firebase/db.js');
    await signOut();
    location.reload();
  });

  // ── Theme toggle ──
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    localStorage.setItem('nova-theme', document.body.classList.contains('light') ? 'light' : 'dark');
  });

  // Restore theme
  if (localStorage.getItem('nova-theme') === 'light') {
    document.body.classList.add('light');
  }

  // ── Instance list subscription ──
  return {
    updateCategory(category) {
      // Update active state
      categoriesEl.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
      });

      // Update title
      const labels = { notes: 'Notas', images: 'Imágenes', todo: 'To-do' };
      instancesTitle.textContent = labels[category] || category;

      // Unsubscribe previous
      if (this._unsubscribe) this._unsubscribe();

      // Subscribe to instances
      this._unsubscribe = onInstancesChange(category, (instances) => {
        app.instances = instances;
        renderInstanceList(instancesListEl, instances, app);
      });
    },

    updateActiveInstance(instanceId) {
      instancesListEl.querySelectorAll('.instance-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === instanceId);
      });
    },

    destroy() {
      if (this._unsubscribe) this._unsubscribe();
    }
  };
}

// ── Render instance list ────────────────────────────────
function renderInstanceList(container, instances, app) {
  container.innerHTML = instances.map(inst => `
    <div class="instance-item ${inst.id === app.currentInstanceId ? 'active' : ''}" data-id="${inst.id}">
      <span class="instance-name-label" data-id="${inst.id}">${escapeHtml(inst.name)}</span>
      <input class="instance-name-input hidden" value="${escapeHtml(inst.name)}" data-id="${inst.id}" />
      <div class="instance-actions">
        <button class="btn-icon btn-edit-instance" data-action="edit-instance" data-id="${inst.id}" title="Renombrar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon btn-danger btn-delete-instance" data-action="delete-instance" data-id="${inst.id}" title="Eliminar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  // Click instance item → select
  container.querySelectorAll('.instance-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.instance-actions')) return;
      app.selectInstance(el.dataset.id);
    });
  });

  // Edit (pencil icon) → show input, hide label
  container.querySelectorAll('[data-action="edit-instance"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = btn.closest('.instance-item');
      const label = item.querySelector('.instance-name-label');
      const input = item.querySelector('.instance-name-input');
      label.classList.add('hidden');
      input.classList.remove('hidden');
      input.focus();
      input.select();
    });
  });

  // Rename: confirm on blur or enter
  container.querySelectorAll('.instance-name-input').forEach(input => {
    async function commitRename() {
      const id = input.dataset.id;
      const newName = input.value.trim();
      const instance = app.instances.find(i => i.id === id);
      const item = input.closest('.instance-item');
      const label = item.querySelector('.instance-name-label');

      if (instance && newName && newName !== instance.name) {
        // Optimistic: update label immediately
        label.textContent = newName;
        try {
          await updateInstance(id, { name: newName });
        } catch (err) {
          console.error('Failed to rename:', err);
          label.textContent = instance.name;
        }
      } else if (!newName) {
        // Revert if empty
        label.textContent = instance.name;
      }

      input.classList.add('hidden');
      label.classList.remove('hidden');
    }

    input.addEventListener('blur', commitRename);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
      if (e.key === 'Escape') {
        // Revert without saving
        const instance = app.instances.find(i => i.id === input.dataset.id);
        input.value = instance.name;
        input.blur();
      }
    });
  });

  // Delete
  container.querySelectorAll('[data-action="delete-instance"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!confirm('¿Eliminar esta instancia?')) return;
      try {
        await deleteInstance(id);
        if (app.currentInstanceId === id) {
          app.currentInstanceId = null;
          app.showEmptyState();
        }
      } catch (err) {
        console.error('Failed to delete instance:', err);
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}