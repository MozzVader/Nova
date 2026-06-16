import { updateInstance } from '../firebase/db.js';
import { showToast } from './toast.js';

// ── Render Notes View ────────────────────────────────────
export function renderNotes(container, instance, app) {
  const { cards = [] } = instance.data || {};

  container.innerHTML = `
    <div class="notes-container">
      <div class="notes-header">
        <h2>${escapeHtml(instance.name)}</h2>
      </div>
      <div class="notes-cards">
        ${cards.map(card => renderCard(card)).join('')}
        ${cards.length < 3 ? `<div class="btn-add-card" data-action="add-card" title="Agregar nota rápida">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>` : ''}
      </div>
    </div>
  `;

  bindNotesEvents(container, instance, app);
}

function renderCard(card) {
  return `
    <div class="notes-card" data-card-id="${card.id}">
      <div class="notes-card-header">
        <input class="notes-card-title" value="${escapeHtml(card.title)}" placeholder="Título..." data-field="title" />
        <button class="btn-icon btn-danger btn-delete-card" data-action="delete-card" data-card-id="${card.id}" title="Eliminar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="notes-card-editor" contenteditable="true" data-field="content" data-placeholder="Escribí algo...">${card.content || ''}</div>
      <div class="notes-toolbar">
        <button data-cmd="bold" title="Negrita"><b>B</b></button>
        <button data-cmd="italic" title="Itálica"><i>I</i></button>
        <button data-cmd="insertUnorderedList" title="Lista">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        </button>
      </div>
    </div>
  `;
}

function bindNotesEvents(container, instance, app) {
  let saveTimeout = null;

  function scheduleSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveNotes(container, instance), 600);
  }

  // Card title changes
  container.querySelectorAll('.notes-card-title').forEach(input => {
    input.addEventListener('input', () => scheduleSave());
    input.addEventListener('click', e => e.stopPropagation());
  });

  // Content changes (contenteditable)
  container.querySelectorAll('.notes-card-editor').forEach(editor => {
    editor.addEventListener('input', () => scheduleSave());
    editor.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    });
  });

  // Toolbar commands
  container.querySelectorAll('.notes-toolbar button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      document.execCommand(cmd, false, null);
      const card = btn.closest('.notes-card');
      card.querySelector('.notes-card-editor').focus();
      scheduleSave();
    });
  });

  // Add card
  container.querySelector('[data-action="add-card"]')?.addEventListener('click', () => {
    const cards = getCardsFromDOM(container);
    if (cards.length >= 3) return;
    const newCard = {
      id: 'c_' + Date.now(),
      title: '',
      content: ''
    };
    cards.push(newCard);
    saveNotes(container, { ...instance, data: { ...instance.data, cards } });
    app.renderCurrentInstance();
  });

  // Delete card → toast undo
  container.querySelectorAll('[data-action="delete-card"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cardId = btn.dataset.cardId;
      const cardEl = btn.closest('.notes-card');

      // Optimistic: hide card from DOM
      cardEl.style.display = 'none';

      // Save current state without this card
      const cards = getCardsFromDOM(container).filter(c => c.id !== cardId);

      showToast('Nota eliminada', () => {
        // UNDO: show card again, save with it
        cardEl.style.display = '';
        const allCards = getCardsFromDOM(container);
        // Card was filtered out, re-add it
        const removedCard = instance.data.cards.find(c => c.id === cardId);
        if (removedCard) {
          allCards.push(removedCard);
          saveNotes(container, { ...instance, data: { ...instance.data, cards: allCards } });
        }
      });

      // Schedule actual delete after 15s
      setTimeout(() => {
        // Re-read DOM (may have been restored by undo)
        const currentCards = getCardsFromDOM(container);
        if (!currentCards.find(c => c.id === cardId)) {
          // Card is still gone, confirm deletion
          saveNotes(container, { ...instance, data: { ...instance.data, cards } });
        }
      }, 15000);
    });
  });
}

function getCardsFromDOM(container) {
  const cards = [];
  container.querySelectorAll('.notes-card').forEach(cardEl => {
    if (cardEl.style.display === 'none') return;
    cards.push({
      id: cardEl.dataset.cardId,
      title: cardEl.querySelector('.notes-card-title').value,
      content: cardEl.querySelector('.notes-card-editor').innerHTML
    });
  });
  return cards;
}

async function saveNotes(container, instance) {
  // Get all cards including hidden ones by temporarily showing them
  const allCards = [];
  container.querySelectorAll('.notes-card').forEach(cardEl => {
    allCards.push({
      id: cardEl.dataset.cardId,
      title: cardEl.querySelector('.notes-card-title').value,
      content: cardEl.querySelector('.notes-card-editor').innerHTML
    });
  });
  try {
    await updateInstance(instance.id, { 'data.cards': allCards });
  } catch (err) {
    console.error('Failed to save notes:', err);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}