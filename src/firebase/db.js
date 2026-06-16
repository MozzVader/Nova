import { auth, db } from './config.js';
import {
  collection, getDocs, getDoc, addDoc, doc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  signInWithEmailAndPassword as authSignIn,
  createUserWithEmailAndPassword as authSignUp,
  signOut as authSignOut,
  onAuthStateChanged as authOnState
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const COLLECTION = 'instances';

// ── Instances CRUD ───────────────────────────────────────
export async function getInstances(category) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', auth.currentUser.uid),
    where('category', '==', category),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createInstance(category, name) {
  const docRef = await addDoc(collection(db, COLLECTION), {
    userId: auth.currentUser.uid,
    category,
    name: name || getDefaultName(category),
    data: getDefaultData(category),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  const snap = await getDoc(doc(db, COLLECTION, docRef.id));
  return { id: snap.id, ...snap.data() };
}

export async function updateInstance(id, updates) {
  await updateDoc(doc(db, COLLECTION, id), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

export async function deleteInstance(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

// ── Realtime listener ───────────────────────────────────
export function onInstancesChange(category, callback) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', auth.currentUser.uid),
    where('category', '==', category),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const instances = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(instances);
  });
}

// ── Defaults ─────────────────────────────────────────────
function getDefaultName(category) {
  const names = { notes: 'Nueva nota', images: 'Nueva galería', todo: 'Nueva lista' };
  return names[category] || 'Nueva instancia';
}

function getDefaultData(category) {
  switch (category) {
    case 'notes':   return { cards: [] };
    case 'images':  return { images: [] };
    case 'todo':    return { view: 'table', tasks: [] };
    default:        return {};
  }
}

// ── Auth helpers ─────────────────────────────────────────
export function signIn(email, password) {
  return authSignIn(auth, email, password);
}

export function signUp(email, password) {
  return authSignUp(auth, email, password);
}

export function signOut() {
  return authSignOut(auth);
}

export function onAuthChange(callback) {
  return authOnState(auth, callback);
}