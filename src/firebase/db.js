import { auth, db } from './config.js';

const COLLECTION = 'instances';

// ── Helpers ──────────────────────────────────────────────
function userPath() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('User not authenticated');
  return `${uid}_${COLLECTION}`;
}

// ── Instances CRUD ───────────────────────────────────────
export async function getInstances(category) {
  const snap = await db
    .collection(COLLECTION)
    .where('userId', '==', auth.currentUser.uid)
    .where('category', '==', category)
    .orderBy('updatedAt', 'desc')
    .get();

  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function createInstance(category, name) {
  const now = firebase.firestore.FieldValue.serverTimestamp();
  const docRef = await db.collection(COLLECTION).add({
    userId: auth.currentUser.uid,
    category,
    name: name || getDefaultName(category),
    data: getDefaultData(category),
    createdAt: now,
    updatedAt: now
  });
  const doc = await docRef.get();
  return { id: doc.id, ...doc.data() };
}

export async function updateInstance(id, updates) {
  await db.collection(COLLECTION).doc(id).update({
    ...updates,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

export async function deleteInstance(id) {
  await db.collection(COLLECTION).doc(id).delete();
}

// ── Realtime listener ───────────────────────────────────
export function onInstancesChange(category, callback) {
  return db
    .collection(COLLECTION)
    .where('userId', '==', auth.currentUser.uid)
    .where('category', '==', category)
    .orderBy('updatedAt', 'desc')
    .onSnapshot((snap) => {
      const instances = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(instances);
    });
}

// ── Defaults ─────────────────────────────────────────────
function getDefaultName(category) {
  const names = {
    notes: 'Nueva nota',
    images: 'Nueva galería',
    todo: 'Nueva lista'
  };
  return names[category] || 'Nueva instancia';
}

function getDefaultData(category) {
  switch (category) {
    case 'notes':
      return { cards: [] }; // { id, title, content (HTML) }
    case 'images':
      return { images: [] }; // { id, url, title }
    case 'todo':
      return {
        view: 'kanban', // 'kanban' | 'table'
        tasks: [] // { id, text, status: 'todo'|'in-progress'|'done' }
      };
    default:
      return {};
  }
}

// ── Auth helpers ─────────────────────────────────────────
export async function signIn(email, password) {
  return auth.signInWithEmailAndPassword(email, password);
}

export async function signUp(email, password) {
  return auth.createUserWithEmailAndPassword(email, password);
}

export async function signOut() {
  return auth.signOut();
}

export function onAuthChange(callback) {
  return auth.onAuthStateChanged(callback);
}