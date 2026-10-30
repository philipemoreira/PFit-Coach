// Único arquivo que conversa direto com o Firebase. O resto do app importa daqui.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, deleteUser
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, limit,
  getDocs, getDoc, writeBatch, where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

export const configurado = !String(firebaseConfig.apiKey || '').startsWith('COLE');

// Várias contas no mesmo aparelho: cada uma usa o seu próprio "espaço" (slot) do Firebase, com sessão separada.
// O espaço ativo é escolhido antes de carregar o app (contas.js troca e recarrega a página).
export const slotAtual = (() => { try { return localStorage.getItem('pfit_slot') || 'principal'; } catch (e) { return 'principal'; } })();

let auth = null;
let db = null;
if (configurado) {
  const app = slotAtual === 'principal' ? initializeApp(firebaseConfig) : initializeApp(firebaseConfig, slotAtual);
  auth = getAuth(app);
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    experimentalAutoDetectLongPolling: true
  });
}

export {
  auth, db, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, deleteUser,
  collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, limit, getDocs, getDoc, writeBatch, where
};
