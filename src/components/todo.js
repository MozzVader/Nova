import { updateInstance } from '../firebase/db.js';
import { showToast } from './toast.js';

const STATUSES = ['todo', 'in-progress', 'done'];
const STATUS_LABELS = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'done': 'Done'
};

// ── Render Todo View ────────────────────────────────────
export function renderTodo(container, instance, app) {
  const { view = 'kanban', tasks = [] } = instance.data || {};

  container.innerHTML = `
    <div class="todo-container">
      <div class="todo-header">
        <h2>${escapeHtml(instance.name)}</h2>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <div class="todo-views-toggle">
            <button class="todo-view-btn ${view === 'kanban' ? 'active' : ''}" data-view="kanban">Kanban</button>
            <button class="todo-view-btn ${view === 'table' ? 'active' : ''}" data-view="table">Tabla</button>
          </div>
        </div>
      </div>
      <form class="todo-add-form" data-action="add-task">
        <input type="text" placeholder="Agregar tarea..." required />
        <button type="submit" class="btn btn-primary btn-sm">Agregar</button>
      </form>
      <div id="todo-view-content"></div>
    </div>
  `;

  const viewContent = container.querySelector('#todo-view-content');
  if (view === 'kanban') {
    renderKanban(viewContent, instance);
  } else {
    renderTable(viewContent, instance);
  }

  bindTodoEvents(container, viewContent, instance, app);
}

// ── Kanban ──────────────────────────────────────────────
function renderKanban(container, instance, app) {
  const { tasks = [] } = instance.data || {};

  container.innerHTML = `
    <div class="kanban-board">
      ${STATUSES.map(status => `
        <div class="kanban-column" data-status="${status}">
          <div class="kanban-column-header">${STATUS_LABELS[status]}</div>
          <div class="kanban-cards" data-status="${status}">
            ${tasks.filter(t => t.status === status).map(t => renderKanbanCard(t)).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  bindDragDrop(container, instance, app);
}

function renderKanbanCard(task) {
  return `
    <div class="kanban-card" draggable="true" data-task-id="${task.id}">
      <button class="btn-icon btn-danger kanban-card-delete" data-action="delete-task" data-task-id="${task.id}" title="Eliminar">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="kanban-card-text">${escapeHtml(task.text)}</div>
    </div>
  `;
}

// ── Table ───────────────────────────────────────────────
function renderTable(container, instance) {
  const { tasks = [] } = instance.data || {};

  container.innerHTML = `
    <div class="todo-table-wrapper">
      <table class="todo-table">
        <thead>
          <tr>
            <th style="width:50%">Tarea</th>
            <th style="width:25%">Estado</th>
            <th style="width:25%">Acción</th>
          </tr>
        </thead>
        <tbody>
          ${tasks.map(t => `
            <tr data-task-id="${t.id}">
              <td><span class="task-text ${t.status === 'done' ? 'done-text' : ''}">${escapeHtml(t.text)}</span></td>
              <td>
                <select data-action="change-status" data-task-id="${t.id}">
                  ${STATUSES.map(s => `<option value="${s}" ${t.status === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
                </select>
              </td>
              <td>
                <button class="btn-icon btn-danger btn-sm" data-action="delete-task" data-task-id="${t.id}" title="Eliminar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ── Events ──────────────────────────────────────────────
function bindTodoEvents(container, viewContent, instance, app) {
  function refreshView() {
    setTimeout(() => app.renderCurrentInstance(), 50);
  }

  // View toggle
  container.querySelectorAll('.todo-view-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const view = btn.dataset.view;
      await updateInstance(instance.id, { 'data.view': view });
      refreshView();
    });
  });

  // Add task
  container.querySelector('[data-action="add-task"]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const text = input.value.trim();
    if (!text) return;

    const tasks = [...(instance.data.tasks || []), {
      id: 't_' + Date.now(),
      text,
      status: 'todo'
    }];

    try {
      await updateInstance(instance.id, { 'data.tasks': tasks });
      input.value = '';
      refreshView();
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  });

  // Delete task → toast undo
  container.querySelectorAll('[data-action="delete-task"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.taskId;

      // Find the DOM element to hide
      const row = btn.closest('tr[data-task-id]');
      const card = btn.closest('.kanban-card');
      const el = row || card;
      if (el) el.style.display = 'none';

      const tasks = (instance.data.tasks || []).filter(t => t.id !== taskId);
      const removedTask = instance.data.tasks.find(t => t.id === taskId);

      showToast('Tarea eliminada', () => {
        // UNDO: restore in DOM
        if (el) el.style.display = '';
      });

      // Schedule actual delete
      setTimeout(async () => {
        try {
          await updateInstance(instance.id, { 'data.tasks': tasks });
        } catch (err) {
          console.error('Failed to delete task:', err);
        }
      }, 15000);
    });
  });

  // Table: change status
  container.querySelectorAll('[data-action="change-status"]').forEach(select => {
    select.addEventListener('change', async () => {
      const taskId = select.dataset.taskId;
      const newStatus = select.value;
      const tasks = instance.data.tasks.map(t =>
        t.id === taskId ? { ...t, status: newStatus } : t
      );
      try {
        await updateInstance(instance.id, { 'data.tasks': tasks });
        refreshView();
      } catch (err) {
        console.error('Failed to update task:', err);
      }
    });
  });
}

// ── Drag & Drop ─────────────────────────────────────────
function bindDragDrop(container, instance, app) {
  let draggedTaskId = null;

  container.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('dragstart', () => {
      draggedTaskId = card.dataset.taskId;
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      draggedTaskId = null;
      container.querySelectorAll('.kanban-column').forEach(col => col.classList.remove('drag-over'));
    });
  });

  container.querySelectorAll('.kanban-cards').forEach(dropZone => {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.closest('.kanban-column').classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
      if (!dropZone.contains(e.relatedTarget)) {
        dropZone.closest('.kanban-column').classList.remove('drag-over');
      }
    });

    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      const column = dropZone.closest('.kanban-column');
      column.classList.remove('drag-over');
      if (!draggedTaskId) return;

      const newStatus = dropZone.dataset.status;
      const tasks = instance.data.tasks.map(t =>
        t.id === draggedTaskId ? { ...t, status: newStatus } : t
      );

      try {
        await updateInstance(instance.id, { 'data.tasks': tasks });
        setTimeout(() => app.renderCurrentInstance(), 50);
      } catch (err) {
        console.error('Failed to move task:', err);
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