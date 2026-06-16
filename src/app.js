import { onAuthChange, signIn, onInstancesChange } from './firebase/db.js';
import { initSidebar } from './components/sidebar.js';
import { renderNotes } from './components/notes.js';
import { renderImages } from './components/images.js';
import { renderTodo } from './components/todo.js';

// ── App State ───────────────────────────────────────────
const app = {
  user: null,
  currentCategory: 'notes',
  currentInstanceId: null,
  instances: [],
  sidebar: null,
  _instanceUnsub: null
};

// ── DOM refs ────────────────────────────────────────────
const authScreen = document.getElementById('auth-screen');
const appShell = document.getElementById('app-shell');
const authForm = document.getElementById('auth-form');
const authSubmit = document.getElementById('auth-submit');
const viewEmpty = document.getElementById('view-empty');
const viewNotes = document.getElementById('view-notes');
const viewImages = document.getElementById('view-images');
const viewTodo = document.getElementById('view-todo');

// ── Auth ────────────────────────────────────────────────

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  try {
    await signIn(email, password);
  } catch (err) {
    alert(err.message);
  }
});

// ── Auth state listener ─────────────────────────────────
onAuthChange(async (user) => {
  if (user) {
    app.user = user;
    authScreen.classList.add('hidden');
    appShell.classList.remove('hidden');
    app.sidebar = initSidebar(app);

    // Restore from hash if present
    const { category, instanceId } = parseHash();
    if (category && ['notes', 'images', 'todo'].includes(category)) {
      app.selectCategory(category);
      // Instance will be selected once the listener fires
      if (instanceId) {
        // Wait a tick for instances to load
        setTimeout(() => {
          if (app.instances.find(i => i.id === instanceId)) {
            app.selectInstance(instanceId);
          }
        }, 1000);
      }
    } else {
      app.selectCategory('notes');
    }
  } else {
    app.user = null;
    app.currentCategory = 'notes';
    app.currentInstanceId = null;
    app.instances = [];
    authScreen.classList.remove('hidden');
    appShell.classList.add('hidden');
    if (app.sidebar) {
      app.sidebar.destroy();
      app.sidebar = null;
    }
  }
});

// ── Category Selection ──────────────────────────────────
app.selectCategory = function (category) {
  this.currentCategory = category;
  this.currentInstanceId = null;
  this.showEmptyState();
  if (this.sidebar) this.sidebar.updateCategory(category);
  this.updateHash();
};

// ── Instance Selection ──────────────────────────────────
app.selectInstance = function (instanceId) {
  this.currentInstanceId = instanceId;
  if (this.sidebar) this.sidebar.updateActiveInstance(instanceId);
  this.renderCurrentInstance();
  this.updateHash();
};

// ── Render current instance from app.instances ──────────
app.renderCurrentInstance = function () {
  if (!this.currentInstanceId) {
    this.showEmptyState();
    return;
  }

  const instance = this.instances.find(i => i.id === this.currentInstanceId);
  if (!instance) {
    this.showEmptyState();
    return;
  }

  // Hide all views
  viewEmpty.classList.add('hidden');
  viewNotes.classList.add('hidden');
  viewImages.classList.add('hidden');
  viewTodo.classList.add('hidden');

  switch (instance.category) {
    case 'notes':
      viewNotes.classList.remove('hidden');
      renderNotes(viewNotes, instance, app);
      break;
    case 'images':
      viewImages.classList.remove('hidden');
      renderImages(viewImages, instance, app);
      break;
    case 'todo':
      viewTodo.classList.remove('hidden');
      renderTodo(viewTodo, instance, app);
      break;
  }
};

// ── Empty State ─────────────────────────────────────────
app.showEmptyState = function () {
  viewEmpty.classList.remove('hidden');
  viewNotes.classList.add('hidden');
  viewImages.classList.add('hidden');
  viewTodo.classList.add('hidden');
};

// ── Hash Routing ────────────────────────────────────────
app.updateHash = function () {
  const hash = this.currentInstanceId
    ? `#${this.currentCategory}/${this.currentInstanceId}`
    : `#${this.currentCategory}`;
  history.replaceState(null, '', hash);
};

function parseHash() {
  const hash = location.hash.slice(1);
  if (!hash) return {};
  const parts = hash.split('/');
  return {
    category: parts[0] || null,
    instanceId: parts[1] || null
  };
}

window.addEventListener('hashchange', () => {
  if (!app.user) return;
  const { category, instanceId } = parseHash();
  if (category && category !== app.currentCategory) {
    app.selectCategory(category);
  }
  if (instanceId && instanceId !== app.currentInstanceId) {
    app.selectInstance(instanceId);
  }
});

