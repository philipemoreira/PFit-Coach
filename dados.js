// Ler e gravar no Firebase. Tudo fica dentro de usuarios/{uid}, só do dono da conta.
import { db, doc, collection, setDoc, deleteDoc, getDocs, writeBatch } from './firebase.js';
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
