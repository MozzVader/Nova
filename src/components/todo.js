import { updateInstance } from '../firebase/db.js';
import { showToast } from './toast.js';

const STATUSES = ['todo', 'in-progress', 'done'];
const STATUS_LABELS = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'done': 'Done'
};

const PRIORITIES = ['none', 'low', 'medium', 'high'];
const PRIORITY_LABELS = {
  'none': '—',
  'low': 'Baja',
  'medium': 'Media',
  'high': 'Alta'
};

function normalizeTask(t) {
  return {
    id: t.id,
    text: t.text || '',
    status: t.status || 'todo',
    priority: t.priority || 'none',
    dueDate: t.dueDate || null
  };
}

function isOverdue(task) {
  if (!task.dueDate || task.status === 'done') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(task.dueDate + 'T23:59:59') < today;
}

function isDueToday(task) {
  if (!task.dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return task.dueDate === today;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function getProgress(tasks) {
  const done = tasks.filter(t => t.status === 'done').length;
  const total = tasks.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

// ── Render Todo View ────────────────────────────────────
export function renderTodo(container, instance, app) {
  const { view = 'kanban', tasks = [] } = instance.data || {};
  const normalized = tasks.map(normalizeTask);
  const progress = getProgress(normalized);

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

      ${normalized.length > 0 ? `
      <div class="todo-progress">
        <div class="todo-progress-bar">
          <div class="todo-progress-fill" style="width:${progress.pct}%"></div>
        </div>
        <span class="todo-progress-text">${progress.done} de ${progress.total} completadas</span>
      </div>` : ''}

      <form class="todo-add-form" data-action="add-task">
        <input type="text" placeholder="Agregar tarea..." required />
        <button type="submit" class="btn btn-primary btn-sm">Agregar</button>
      </form>
      <div id="todo-view-content"></div>
    </div>
  `;

  const viewContent = container.querySelector('#todo-view-content');
  if (view === 'kanban') {
    renderKanban(viewContent, normalized);
  } else {
    renderTable(viewContent, normalized);
  }

  bindTodoEvents(container, viewContent, normalized, instance, app);
}

// ── Kanban ──────────────────────────────────────────────
function renderKanban(container, tasks) {
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
}

function renderKanbanCard(task) {
  const overdue = isOverdue(task);
  const dueToday = isDueToday(task);
  return `
    <div class="kanban-card" draggable="true" data-task-id="${task.id}">
      <button class="btn-icon btn-danger kanban-card-delete" data-action="delete-task" data-task-id="${task.id}" title="Eliminar">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="kanban-card-meta">
        ${task.priority !== 'none' ? `<span class="priority-dot priority-${task.priority}"></span>` : ''}
        ${task.dueDate ? `<span class="task-due ${overdue ? 'task-overdue' : ''} ${dueToday ? 'task-due-today' : ''}">${formatDate(task.dueDate)}</span>` : ''}
      </div>
      <div class="kanban-card-text ${task.status === 'done' ? 'done-text' : ''}" data-action="edit-task-text" data-task-id="${task.id}">${escapeHtml(task.text)}</div>
      <div class="kanban-card-actions">
        <select data-action="change-priority" data-task-id="${task.id}" data-priority="${task.priority}" class="kanban-priority-select" title="Prioridad">
          ${PRIORITIES.map(p => `<option value="${p}" ${task.priority === p ? 'selected' : ''}>${PRIORITY_LABELS[p]}</option>`).join('')}
        </select>
        <input type="date" data-action="change-due" data-task-id="${task.id}" class="kanban-due-input" value="${task.dueDate || ''}" title="Fecha límite" />
      </div>
    </div>
  `;
}

// ── Table ───────────────────────────────────────────────
function renderTable(container, tasks) {
  container.innerHTML = `
    <div class="todo-table-wrapper">
      <table class="todo-table">
        <thead>
          <tr>
            <th class="todo-col-drag"></th>
            <th style="width:32%">Tarea</th>
            <th class="todo-col-priority">Prioridad</th>
            <th class="todo-col-due">Fecha</th>
            <th class="todo-col-status">Estado</th>
            <th class="todo-col-action"></th>
          </tr>
        </thead>
        <tbody>
          ${tasks.map(t => renderTableRow(t)).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTableRow(task) {
  const overdue = isOverdue(task);
  const dueToday = isDueToday(task);
  return `
    <tr data-task-id="${task.id}" draggable="true" class="todo-table-row">
      <td class="todo-col-drag">
        <span class="todo-drag-handle" title="Arrastrar para reordenar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
        </span>
      </td>
      <td>
        <span class="task-text ${task.status === 'done' ? 'done-text' : ''}" data-action="edit-task-text" data-task-id="${task.id}">${escapeHtml(task.text)}</span>
      </td>
      <td class="todo-col-priority">
        <select data-action="change-priority" data-task-id="${task.id}" data-priority="${task.priority}" class="todo-priority-select">
          ${PRIORITIES.map(p => `<option value="${p}" ${task.priority === p ? 'selected' : ''}>${PRIORITY_LABELS[p]}</option>`).join('')}
        </select>
      </td>
      <td class="todo-col-due">
        <input type="date" data-action="change-due" data-task-id="${task.id}" class="todo-due-input" value="${task.dueDate || ''}" />
        ${task.dueDate ? `<span class="task-due-label ${overdue ? 'task-overdue' : ''} ${dueToday ? 'task-due-today' : ''}">${overdue ? 'Vencida' : dueToday ? 'Hoy' : formatDate(task.dueDate)}</span>` : ''}
      </td>
      <td class="todo-col-status">
        <select data-action="change-status" data-task-id="${task.id}">
          ${STATUSES.map(s => `<option value="${s}" ${task.status === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
        </select>
      </td>
      <td class="todo-col-action">
        <button class="btn-icon btn-danger btn-sm" data-action="delete-task" data-task-id="${task.id}" title="Eliminar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </td>
    </tr>
  `;
}

// ── Events ──────────────────────────────────────────────
function bindTodoEvents(container, viewContent, tasks, instance, app) {
  function refreshView() {
    setTimeout(() => app.renderCurrentInstance(), 50);
  }

  async function updateTasks(newTasks) {
    try {
      await updateInstance(instance.id, { 'data.tasks': newTasks });
    } catch (err) {
      console.error('Failed to update tasks:', err);
    }
  }

  function mutateTask(taskId, updater) {
    const newTasks = instance.data.tasks.map(t =>
      t.id === taskId ? updater(normalizeTask(t)) : normalizeTask(t)
    );
    instance.data.tasks = newTasks;
    return newTasks;
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

    const newTasks = [...tasks.map(normalizeTask), {
      id: 't_' + Date.now(),
      text,
      status: 'todo',
      priority: 'none',
      dueDate: null
    }];

    try {
      await updateInstance(instance.id, { 'data.tasks': newTasks });
      input.value = '';
      refreshView();
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  });

  // Inline edit: double-click on task text
  container.querySelectorAll('[data-action="edit-task-text"]').forEach(el => {
    el.addEventListener('dblclick', () => {
      const taskId = el.dataset.taskId;
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'task-edit-input';
      input.value = task.text;

      el.replaceWith(input);
      input.focus();
      input.select();

      const save = async () => {
        const newText = input.value.trim();
        if (newText && newText !== task.text) {
          const newTasks = mutateTask(taskId, t => ({ ...t, text: newText }));
          await updateTasks(newTasks);
        }
        refreshView();
      };

      input.addEventListener('blur', save);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = task.text; input.blur(); }
      });
    });
  });

  // Delete task → toast undo
  container.querySelectorAll('[data-action="delete-task"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.taskId;

      const row = btn.closest('tr[data-task-id]');
      const card = btn.closest('.kanban-card');
      const el = row || card;
      if (el) el.style.display = 'none';

      let deleteScheduled = true;

      showToast('Tarea eliminada', () => {
        if (el) el.style.display = '';
        deleteScheduled = false;
      });

      setTimeout(async () => {
        if (!deleteScheduled) return;
        const newTasks = (instance.data.tasks || []).filter(t => t.id !== taskId);
        try {
          await updateInstance(instance.id, { 'data.tasks': newTasks });
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
      const newTasks = mutateTask(taskId, t => ({ ...t, status: select.value }));
      await updateTasks(newTasks);
      refreshView();
    });
  });

  // Change priority
  container.querySelectorAll('[data-action="change-priority"]').forEach(select => {
    select.addEventListener('change', async () => {
      const taskId = select.dataset.taskId;
      select.dataset.priority = select.value;
      const newTasks = mutateTask(taskId, t => ({ ...t, priority: select.value }));
      await updateTasks(newTasks);
      refreshView();
    });
  });

  // Change due date
  container.querySelectorAll('[data-action="change-due"]').forEach(input => {
    input.addEventListener('change', async () => {
      const taskId = input.dataset.taskId;
      const newTasks = mutateTask(taskId, t => ({ ...t, dueDate: input.value || null }));
      await updateTasks(newTasks);
      refreshView();
    });
  });

  // ── Kanban drag & drop (change status) ──────────
  if (container.querySelector('.kanban-board')) {
    bindKanbanDragDrop(container, tasks, instance, app);
  }

  // ── Table drag & drop (reorder) ────────────────
  if (container.querySelector('.todo-table')) {
    bindTableReorder(container, tasks, instance, app);
  }
}

// ── Kanban Drag & Drop ──────────────────────────────────
function bindKanbanDragDrop(container, tasks, instance, app) {
  let draggedTaskId = null;

  container.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      draggedTaskId = card.dataset.taskId;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
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
      e.dataTransfer.dropEffect = 'move';
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
      const newTasks = instance.data.tasks.map(t =>
        t.id === draggedTaskId ? { ...normalizeTask(t), status: newStatus } : normalizeTask(t)
      );

      try {
        await updateInstance(instance.id, { 'data.tasks': newTasks });
        setTimeout(() => app.renderCurrentInstance(), 50);
      } catch (err) {
        console.error('Failed to move task:', err);
      }
    });
  });
}

// ── Table Reorder Drag & Drop ───────────────────────────
function bindTableReorder(container, tasks, instance, app) {
  const rows = container.querySelectorAll('.todo-table tbody tr');
  let draggedId = null;

  rows.forEach(row => {
    row.addEventListener('dragstart', (e) => {
      draggedId = row.dataset.taskId;
      row.classList.add('dragging-row');
      e.dataTransfer.effectAllowed = 'move';
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('dragging-row');
      draggedId = null;
      rows.forEach(r => r.classList.remove('drag-over-row'));
    });

    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (row.dataset.taskId !== draggedId) {
        row.classList.add('drag-over-row');
      }
    });

    row.addEventListener('dragleave', (e) => {
      if (!row.contains(e.relatedTarget)) {
        row.classList.remove('drag-over-row');
      }
    });

    row.addEventListener('drop', async (e) => {
      e.preventDefault();
      row.classList.remove('drag-over-row');
      if (!draggedId || draggedId === row.dataset.taskId) return;

      const currentTasks = instance.data.tasks.map(normalizeTask);
      const draggedIndex = currentTasks.findIndex(t => t.id === draggedId);
      const targetIndex = currentTasks.findIndex(t => t.id === row.dataset.taskId);
      if (draggedIndex === -1 || targetIndex === -1) return;

      // Remove from old position, insert at new position
      const [draggedTask] = currentTasks.splice(draggedIndex, 1);
      currentTasks.splice(targetIndex, 0, draggedTask);

      try {
        await updateInstance(instance.id, { 'data.tasks': currentTasks });
        setTimeout(() => app.renderCurrentInstance(), 50);
      } catch (err) {
        console.error('Failed to reorder tasks:', err);
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