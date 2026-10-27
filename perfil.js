// Aba Perfil: dados da conta, backup e sair.
import { auth, signOut } from './firebase.js';
import { estado } from './estado.js';
import { abrirFolha, confirmar } from './folha.js';
import { escaparHtml, dataLocal, toast, numero } from './util.js';
import { salvarPerfil, lerTudo, gravarVarios } from './dados.js';
import { temaSalvo, definirTema } from './tema.js';
import { nav } from './nav.js';
import { metaVolume, metaAgua, formatarVolume } from './metricas.js';

const COLECOES = ['treinos', 'regras', 'sessoes', 'peso', 'checks', 'agua'];

async function baixarBackup() {
  try {
    toast('Preparando o backup…');
    const listas = await Promise.all(COLECOES.map((c) => lerTudo(estado.uid, c)));
    const dados = { app: 'treino', versao: 1, exportadoEm: new Date().toISOString() };
    COLECOES.forEach((c, i) => { dados[c] = listas[i]; });
    const nome = `backup-treino-${dataLocal()}.json`;
    const arquivo = new File([JSON.stringify(dados, null, 2)], nome, { type: 'application/json' });
    // No iPhone, o jeito mais fácil é abrir o menu de compartilhar e escolher "Salvar em Arquivos".
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      try { await navigator.share({ files: [arquivo], title: 'Backup do Treino' }); return; } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(arquivo);
    const a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) {
    console.error(e);
    toast('Não consegui gerar o backup. Tente de novo.');
  }
}

async function restaurarBackup(arquivo) {
  let dados;
  try {
    dados = JSON.parse(await arquivo.text());
  } catch { return toast('Esse arquivo não é um backup válido.'); }
  if (!dados || dados.app !== 'treino') return toast('Esse arquivo não é um backup do Treino.');
  const listas = {};
  COLECOES.forEach((c) => { listas[c] = Array.isArray(dados[c]) ? dados[c].filter((x) => x && typeof x.id === 'string' && x.id) : []; });
  const resumo = COLECOES.map((c) => `${listas[c].length} ${c}`).join(', ');
  const ok = await confirmar(`Restaurar o backup (${resumo})? O que já existe com o mesmo código é substituído; o resto fica como está.`, { ok: 'Restaurar' });
  if (!ok) return;
  try {
    for (const c of COLECOES) if (listas[c].length) await gravarVarios(estado.uid, c, listas[c]);
    toast('Backup restaurado.');
  } catch (e) {
    console.error(e);
    toast('Não consegui restaurar o backup.');
  }
}

export const perfil = {
  render() {
    const p = estado.perfil || {};
    const personal = p.papel === 'personal';
    const inicial = (p.nome || '?').trim().charAt(0).toUpperCase();
    return `
    <header class="topo"><h1>Perfil</h1></header>
    <section class="card perfil-topo">
      <div class="avatar" aria-hidden="true">${escaparHtml(inicial)}</div>
      <div>
        <h2>${escaparHtml(p.nome || '')}</h2>
        <p class="mudo peq">${escaparHtml(estado.email)}</p>
        <span class="selo">${personal ? 'Conta de personal' : 'Conta de aluno'}</span>
      </div>
    </section>
    ${personal ? `<section class="card destaque"><p><strong>Área do personal em construção.</strong></p>
      <p class="mudo">Convidar alunos e montar treinos para eles chega na próxima fase. Por enquanto você usa o app como aluno.</p></section>` : ''}
    <div class="grade-cards">
    <section class="card">
      <h2>Minhas metas</h2>
      <p class="mudo peq">Volume por dia: <strong>${metaVolume() ? formatarVolume(metaVolume()) : 'sem meta'}</strong><br>Água por dia: <strong>${metaAgua() ? (metaAgua() / 1000).toLocaleString('pt-BR') + ' L' : 'sem meta'}</strong></p>
      <div class="acoes-card"><button class="btn secundario cheio" type="button" data-acao="metas-editar">Mudar metas</button></div>
    </section>
    <section class="card">
      <h2>Aparência</h2>
      <p class="mudo peq">Automático acompanha o modo claro ou escuro do seu aparelho.</p>
      <div class="acoes-card">
        <div class="seg tema" role="group" aria-label="Tema do app">
          ${[['auto', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']].map(([id, nome]) => `<button type="button" aria-pressed="${temaSalvo() === id}" data-acao="tema" data-tema="${id}">${nome}</button>`).join('')}
        </div>
      </div>
    </section>
    <section class="card">
      <h2>Seus dados</h2>
      <p class="mudo peq">O backup é um arquivo com seus treinos, dieta, histórico e peso. Guarde onde quiser.</p>
      <input type="file" id="arq-backup" accept="application/json,.json" hidden data-mudar="backup-arquivo">
      <div class="acoes-card">
        <button class="btn secundario cheio" type="button" data-acao="backup-baixar">Salvar backup</button>
        <button class="btn secundario cheio" type="button" data-acao="backup-restaurar">Restaurar backup</button>
      </div>
    </section>
    <section class="card">
      <h2>Conta</h2>
      <p class="mudo peq">Nome, e-mail e saída da conta.</p>
      <div class="acoes-card">
        <button class="btn secundario cheio" type="button" data-acao="perfil-nome">Mudar meu nome</button>
        <button class="btn perigo-claro cheio" type="button" data-acao="sair">Sair da conta</button>
      </div>
    </section>
    </div>
    <p class="aviso-rodape">Treino · versão 1</p>`;
  },
  mudancas: {
    'backup-arquivo': (el) => {
      const arq = el.files && el.files[0];
      el.value = '';
      if (arq) restaurarBackup(arq);
    }
  },
  acoes: {
    tema: (el) => {
      definirTema(el.dataset.tema);
      nav.renderizar();
    },
    'perfil-nome': () => {
      const f = abrirFolha(`
        <h2>Seu nome</h2>
        <label class="campo"><input class="in" data-f="nome" maxlength="60" value="${escaparHtml((estado.perfil || {}).nome || '')}"></label>
        <p class="erro" data-erro role="alert"></p>
        <div class="linha-botoes"><button class="btn secundario" type="button" data-fechar>Cancelar</button><button class="btn" type="button" data-ed="salvar">Salvar</button></div>`);
      f.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-ed="salvar"]')) return;
        const nome = f.el.querySelector('[data-f="nome"]').value.trim();
        if (nome.length < 2) { f.el.querySelector('[data-erro]').textContent = 'Digite seu nome.'; return; }
        salvarPerfil(estado.uid, { nome }, { merge: true });
        f.fechar();
      });
    },
    'metas-editar': () => {
      const f = abrirFolha(`
        <h2>Minhas metas</h2>
        <label class="campo">Volume por dia (kg) — deixe vazio para não ter meta
          <input class="in" inputmode="numeric" data-f="vol" placeholder="Ex.: o valor que você quiser" value="${metaVolume() || ''}"></label>
        <label class="campo">Água por dia (litros) — deixe vazio para não ter meta
          <input class="in" inputmode="decimal" data-f="agua" placeholder="Ex.: 3" value="${metaAgua() ? String(metaAgua() / 1000).replace('.', ',') : ''}"></label>
        <p class="erro" data-erro role="alert"></p>
        <div class="linha-botoes"><button class="btn secundario" type="button" data-fechar>Cancelar</button><button class="btn" type="button" data-ed="salvar">Salvar</button></div>`);
      f.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-ed="salvar"]')) return;
        const tv = f.el.querySelector('[data-f="vol"]').value.trim();
        const ta = f.el.querySelector('[data-f="agua"]').value.trim();
        const v = tv ? numero(tv) : null;
        const a = ta ? numero(ta) : null;
        const erro = f.el.querySelector('[data-erro]');
        if ((tv && (v === null || v <= 0 || v > 1000000)) || (ta && (a === null || a <= 0 || a > 20))) { erro.textContent = 'Digite números válidos (ou deixe vazio).'; return; }
        salvarPerfil(estado.uid, { metaVolume: v, metaAgua: a === null ? null : Math.round(a * 1000) }, { merge: true });
        f.fechar();
        toast('Metas salvas.');
      });
    },
    'backup-baixar': () => baixarBackup(),
    'backup-restaurar': () => document.getElementById('arq-backup').click(),
    sair: async () => {
      if (await confirmar('Sair da conta?', { ok: 'Sair' })) await signOut(auth);
    }
  }
};
