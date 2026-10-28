// Conectar a conta de um aluno ao código de um personal (usado na criação da conta).
import { db, doc, getDoc } from './firebase.js';
import { salvarGlobal } from './dados.js';

export const CODIGO_OK = /^[A-Z2-9]{8}$/;

// Só confere se o código existe (usado antes de criar a conta). Devolve { ok: true, personalNome } ou { ok: false, erro }.
export async function consultarConvite(codigo) {
  const cod = String(codigo || '').trim().toUpperCase();
  if (!CODIGO_OK.test(cod)) return { ok: false, erro: 'O código tem 8 letras e números.' };
  try {
    const snap = await getDoc(doc(db, 'convites', cod));
    if (!snap.exists()) return { ok: false, erro: 'Código não encontrado. Confira com seu personal.' };
    return { ok: true, personalNome: snap.data().personalNome || 'seu personal' };
  } catch (e) {
    console.error(e);
    return { ok: false, erro: 'Não consegui verificar o código. Confira a internet e tente de novo.' };
  }
}

// Devolve { ok: true, personalNome } ou { ok: false, erro }.
export async function conectarPersonal({ uid, nome, email, codigo }) {
  const cod = String(codigo || '').trim().toUpperCase();
  if (!CODIGO_OK.test(cod)) return { ok: false, erro: 'O código tem 8 letras e números.' };
  let convite;
  try {
    const snap = await getDoc(doc(db, 'convites', cod));
    if (!snap.exists()) return { ok: false, erro: 'Código não encontrado. Confira com seu personal.' };
    convite = snap.data();
  } catch (e) {
    console.error(e);
    return { ok: false, erro: 'Não consegui verificar o código.' };
  }
  if (convite.personalUid === uid) return { ok: false, erro: 'Esse código é o seu próprio.' };
  try {
    await salvarGlobal('vinculos', uid, {
      alunoUid: uid, alunoNome: nome || '', alunoEmail: email || '',
      personalUid: convite.personalUid, personalNome: convite.personalNome || '', codigo: cod, criadoEm: new Date().toISOString()
    });
  } catch (e) {
    console.error(e);
    return { ok: false, erro: 'Não consegui conectar.' };
  }
  return { ok: true, personalNome: convite.personalNome || 'seu personal' };
}
