// Dieta em arquivo (PDF ou Word): o personal envia, o aluno abre. Fica guardado no próprio Firestore, sem custo extra.
// Cada arquivo = 1 documento em "dietaArquivos" (nome, tipo, tamanho) + pedaços em "dietaPartes" (o conteúdo em base64).
import { db, doc, collection, query, where, getDocs, writeBatch } from './firebase.js';
import { estado } from './estado.js';
import { abrirFolha, confirmar } from './folha.js';
import { escaparHtml, novoId, toast, formatarDataCurta } from './util.js';

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const PEDACO = 600000;              // caracteres de base64 por documento (o limite do Firestore é ~1 MB)
const TIPOS = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};
const extensao = (nome) => (String(nome).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
const tamanhoTexto = (b) => (b >= 1048576 ? `${(b / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const ICONE = (ext) => (ext === 'pdf' ? '📄' : '📝');

const lerBase64 = (arquivo) => new Promise((ok, erro) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] || '');
  r.onerror = () => erro(new Error('leitura'));
  r.readAsDataURL(arquivo);
});

// Envia o arquivo para a conta do aluno. Devolve { ok: true } ou { ok: false, erro }.
export async function enviarArquivoDieta(alunoUid, arquivo) {
  const ext = extensao(arquivo.name);
  if (!TIPOS[ext]) return { ok: false, erro: 'Use um arquivo PDF ou Word (.pdf, .doc ou .docx).' };
  if (arquivo.size > MAX_BYTES) return { ok: false, erro: `O arquivo tem ${tamanhoTexto(arquivo.size)}. O limite é 3 MB. Dica: salve o PDF com qualidade menor.` };
  if (!arquivo.size) return { ok: false, erro: 'O arquivo está vazio.' };
  try {
    const b64 = await lerBase64(arquivo);
    const id = novoId();
    const partes = [];
    for (let i = 0; i < b64.length; i += PEDACO) partes.push(b64.slice(i, i + PEDACO));
    const lote = writeBatch(db);
    partes.forEach((dados, i) => lote.set(doc(db, 'usuarios', alunoUid, 'dietaPartes', `${id}_${i}`), { arq: id, i, dados }));
    lote.set(doc(db, 'usuarios', alunoUid, 'dietaArquivos', id), {
      nome: arquivo.name.slice(0, 120), ext, bytes: arquivo.size, partes: partes.length,
      criadoEm: new Date().toISOString(), por: estado.uid
    });
    await lote.commit();
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, erro: 'Não consegui enviar. Confira a internet e tente de novo.' };
  }
}

async function montarBlob(alunoUid, meta) {
  const snap = await getDocs(query(collection(db, 'usuarios', alunoUid, 'dietaPartes'), where('arq', '==', meta.id)));
  const lista = snap.docs.map((d) => d.data()).sort((a, b) => a.i - b.i);
  if (!lista.length || lista.length !== meta.partes) throw new Error('incompleto');
  const bin = atob(lista.map((p) => p.dados).join(''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: TIPOS[meta.ext] || 'application/octet-stream' });
}

// modo: 'abrir' (PDF abre numa aba; Word baixa) ou 'baixar'.
export async function abrirArquivoDieta(alunoUid, meta, modo = 'abrir') {
  toast('Abrindo…');
  try {
    const blob = await montarBlob(alunoUid, meta);
    const url = URL.createObjectURL(blob);
    if (modo === 'abrir' && meta.ext === 'pdf') {
      const w = window.open(url, '_blank');
      if (!w) location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url; a.download = meta.nome; document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    console.error(e);
    toast('Não consegui abrir o arquivo agora. Tente de novo.');
  }
}

export async function removerArquivoDieta(alunoUid, meta) {
  if (!(await confirmar(`Remover "${meta.nome}"? O aluno deixa de ver este arquivo.`, { ok: 'Remover', perigo: true }))) return;
  try {
    const snap = await getDocs(query(collection(db, 'usuarios', alunoUid, 'dietaPartes'), where('arq', '==', meta.id)));
    const lote = writeBatch(db);
    snap.docs.forEach((d) => lote.delete(d.ref));
    lote.delete(doc(db, 'usuarios', alunoUid, 'dietaArquivos', meta.id));
    await lote.commit();
    toast('Arquivo removido.');
  } catch (e) { console.error(e); toast('Não consegui remover. Tente de novo.'); }
}

const linhaArquivo = (m, acoes) => `
  <div class="arq-lin">
    <span class="arq-ico" aria-hidden="true">${ICONE(m.ext)}</span>
    <span class="arq-txt"><b>${escaparHtml(m.nome)}</b><small class="mudo">${m.ext.toUpperCase()} · ${tamanhoTexto(m.bytes || 0)} · enviado em ${formatarDataCurta(String(m.criadoEm).slice(0, 10))}</small></span>
    <span class="arq-acoes">${acoes}</span>
  </div>`;

// Cartão do ALUNO (aba Dieta): lista os arquivos que o personal enviou.
export function cartaoArquivosAluno() {
  const l = estado.dietaArquivos;
  if (!l.length) return '';
  return `
  <section class="card arq-card">
    <div class="card-topo"><h2>Dieta em arquivo</h2><span class="selo">${l.length}</span></div>
    <p class="mudo peq">Arquivo enviado pelo seu personal${estado.vinculo && estado.vinculo.personalNome ? ` (${escaparHtml(estado.vinculo.personalNome)})` : ''}.</p>
    ${l.map((m) => linhaArquivo(m, `<button class="btn pequeno" type="button" data-acao="arq-abrir" data-id="${escaparHtml(m.id)}">${m.ext === 'pdf' ? 'Abrir' : 'Baixar'}</button>`)).join('')}
  </section>`;
}

// Cartão do PERSONAL (ficha do aluno, aba Dieta).
export function cartaoArquivosPersonal(lista) {
  return `
  <section class="card arq-card">
    <div class="card-topo"><h2>Dieta em arquivo</h2><button class="btn pequeno" type="button" data-acao="p-arq-enviar">+ Enviar</button></div>
    <p class="mudo peq">Prefere montar a dieta em PDF ou Word? Envie aqui e o aluno abre pelo app. Não precisa preencher a lista abaixo.</p>
    <input type="file" accept=".pdf,.doc,.docx,application/pdf" data-f="arq-dieta" hidden>
    ${lista.length ? lista.map((m) => linhaArquivo(m, `<button class="btn pequeno secundario" type="button" data-acao="p-arq-ver" data-id="${escaparHtml(m.id)}">${m.ext === 'pdf' ? 'Abrir' : 'Baixar'}</button><button class="btn pequeno perigo-claro" type="button" data-acao="p-arq-remover" data-id="${escaparHtml(m.id)}" aria-label="Remover ${escaparHtml(m.nome)}">✕</button>`)).join('') : '<p class="mudo vazio-peq">Nenhum arquivo enviado.</p>'}
  </section>`;
}

// Escolhe o arquivo no aparelho e envia. Usado pelo botão "+ Enviar" do personal.
export function escolherEEnviar(alunoUid) {
  const entrada = document.createElement('input');
  entrada.type = 'file';
  entrada.accept = '.pdf,.doc,.docx,application/pdf';
  entrada.addEventListener('change', async () => {
    const arq = entrada.files && entrada.files[0];
    if (!arq) return;
    toast('Enviando…');
    const r = await enviarArquivoDieta(alunoUid, arq);
    toast(r.ok ? 'Arquivo enviado. O aluno já pode abrir.' : r.erro);
  });
  entrada.click();
}
