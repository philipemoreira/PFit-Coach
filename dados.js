// Ler e gravar no Firebase. Tudo fica dentro de usuarios/{uid}, só do dono da conta.
import { db, doc, collection, setDoc, deleteDoc, getDocs, writeBatch, query, orderBy, limit } from './firebase.js';
import { toast } from './util.js';

// O Firebase não aceita valores "undefined": isso limpa antes de gravar.
const limpo = (o) => JSON.parse(JSON.stringify(o));

function falha(erro) {
  console.error(erro);
  toast('Não consegui salvar. Confira a internet e tente de novo.');
}

export function salvarDoc(uid, sub, id, dados, opcoes) {
  return setDoc(doc(db, 'usuarios', uid, sub, id), limpo(dados), opcoes).catch(falha);
}

export function removerDoc(uid, sub, id) {
  return deleteDoc(doc(db, 'usuarios', uid, sub, id)).catch(falha);
}

export function salvarPerfil(uid, dados, opcoes) {
  return setDoc(doc(db, 'usuarios', uid), limpo(dados), opcoes).catch(falha);
}

export async function lerTudo(uid, sub) {
  const snap = await getDocs(collection(db, 'usuarios', uid, sub));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Grava vários de uma vez (usado ao restaurar backup).
export async function gravarVarios(uid, sub, itens) {
  for (let i = 0; i < itens.length; i += 400) {
    const lote = writeBatch(db);
    itens.slice(i, i + 400).forEach(({ id, ...resto }) => {
      lote.set(doc(db, 'usuarios', uid, sub, id), limpo(resto));
    });
    await lote.commit();
  }
}

// Coleções de nível superior (convites e vínculos): ficam fora de usuarios/{uid}.
export function salvarGlobal(colecao, id, dados) {
  return setDoc(doc(db, colecao, id), limpo(dados));
}
export function removerGlobal(colecao, id) {
  return deleteDoc(doc(db, colecao, id));
}

// Lê as últimas fotos de alguém (leitura única, sem ficar escutando: as imagens são pesadas).
export async function lerFotos(uid, max = 30) {
  const snap = await getDocs(query(collection(db, 'usuarios', uid, 'fotos'), orderBy('data', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Apaga uma subcoleção inteira da pessoa (usado em "Excluir minha conta").
export async function apagarSubcolecao(uid, sub) {
  const snap = await getDocs(collection(db, 'usuarios', uid, sub));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const lote = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => lote.delete(d.ref));
    await lote.commit();
  }
}

export function apagarPerfil(uid) {
  return deleteDoc(doc(db, 'usuarios', uid));
}
