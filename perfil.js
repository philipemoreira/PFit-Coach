// Aba Perfil: dados da conta, backup e sair.
import { auth, signOut, db, doc, getDoc } from './firebase.js';
import { estado } from './estado.js';
import { abrirFolha, confirmar } from './folha.js';
import { escaparHtml, dataLocal, toast, numero, formatarDataCurta } from './util.js';
import { salvarPerfil, lerTudo, gravarVarios, salvarGlobal, removerGlobal } from './dados.js';
import { temaSalvo, definirTema } from './tema.js';
import { nav } from './nav.js';
import { metaVolume, metaAgua, metaPeso, metaMacros, formatarVolume } from './metricas.js';
import { abrirPrivacidade, abrirExclusao } from './conta.js';
import { blocoAssinatura } from './assinatura.js';

const COLECOES = ['treinos', 'regras', 'sessoes', 'peso', 'checks', 'agua', 'medidas', 'alimentos', 'refeicoes'];

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
  // Quem tem personal não pode mexer no treino e na dieta (o personal é quem monta).
  const COLS = estado.vinculo ? COLECOES.filter((c) => c !== 'treinos' && c !== 'regras') : COLECOES;
  COLS.forEach((c) => { listas[c] = Array.isArray(dados[c]) ? dados[c].filter((x) => x && typeof x.id === 'string' && x.id) : []; });
  const resumo = COLS.map((c) => `${listas[c].length} ${c}`).join(', ');
  const ok = await confirmar(`Restaurar o backup (${resumo})? O que já existe com o mesmo código é substituído; o resto fica como está.`, { ok: 'Restaurar' });
  if (!ok) return;
  try {
    for (const c of COLS) if (listas[c].length) await gravarVarios(estado.uid, c, listas[c]);
    toast('Backup restaurado.');
  } catch (e) {
    console.error(e);
    toast('Não consegui restaurar o backup.');
  }
}

function cartaoPersonal(souPersonal) {
  const v = estado.vinculo;
  if (v) {
    return `
    <section class="card">
      <h2>Meu personal</h2>
      <p>${escaparHtml(v.personalNome || 'Personal')}</p>
      <p class="mudo peq">Conectado${v.criadoEm ? ' desde ' + formatarDataCurta(String(v.criadoEm).slice(0, 10)) : ''}. Ele monta seu treino e sua dieta e vê o seu progresso.</p>
      <div class="acoes-card">
        <button class="btn secundario cheio" type="button" data-acao="recados-abrir">Recados</button>
        <button class="btn perigo-claro cheio" type="button" data-acao="vinculo-desligar">Desligar do personal</button>
      </div>
    </section>`;
  }
  return `
  <section class="card">
    <h2>Personal</h2>
    <p class="mudo peq">Tem um personal? Digite o código que ele te passou. Ele poderá ver seus treinos, dieta, peso e medidas, e montar seu treino e sua dieta.</p>
    <div class="acoes-card">
      <button class="btn secundario cheio" type="button" data-acao="vinculo-conectar">Tenho um código de personal</button>
      ${souPersonal ? '' : '<button class="btn secundario cheio" type="button" data-acao="personal-ativar">Sou personal: ativar aba Alunos</button>'}
    </div>
  </section>`;
}

export const perfil = {
  render() {
    const p = estado.perfil || {};
    const personal = p.papel === 'personal';
    const inicial = (p.nome || '?').trim().charAt(0).toUpperCase();
    return `
    <header class="topo"><h1>Perfil</h1></header>
    ${blocoAssinatura()}
    <section class="card perfil-topo">
      <div class="avatar" aria-hidden="true">${escaparHtml(inicial)}</div>
      <div>
        <h2>${escaparHtml(p.nome || '')}</h2>
        <p class="mudo peq">${escaparHtml(estado.email)}</p>
        <span class="selo">${personal ? 'Conta de personal' : 'Conta de aluno'}</span>
      </div>
    </section>
    <div class="grade-cards">
    ${cartaoPersonal(personal)}
    <section class="card">
      <h2>Minhas metas</h2>
      ${estado.vinculo ? '<p class="mudo peq">Definidas pelo seu personal.</p>' : ''}
      <p class="mudo peq">Volume por dia: <strong>${metaVolume() ? formatarVolume(metaVolume()) : 'sem meta'}</strong><br>Água por dia: <strong>${metaAgua() ? (metaAgua() / 1000).toLocaleString('pt-BR') + ' L' : 'sem meta'}</strong><br>Peso desejado: <strong>${metaPeso() ? metaPeso().toLocaleString('pt-BR') + ' kg' : 'sem meta'}</strong><br>Calorias por dia: <strong>${metaMacros().kcal ? metaMacros().kcal.toLocaleString('pt-BR') + ' kcal' : 'sem meta'}</strong><br>Proteína · carbo · gordura: <strong>${['prot', 'carb', 'gord'].map((k) => (metaMacros()[k] ? metaMacros()[k] + ' g' : '—')).join(' · ')}</strong></p>
      ${estado.vinculo ? '' : '<div class="acoes-card"><button class="btn secundario cheio" type="button" data-acao="metas-editar">Mudar metas</button></div>'}
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
      <p class="mudo peq">O backup é um arquivo com seus treinos, dieta, histórico, peso, medidas e alimentos. Guarde onde quiser. (As fotos não entram no backup.)</p>
      <input type="file" id="arq-backup" accept="application/json,.json" hidden data-mudar="backup-arquivo">
      <div class="acoes-card">
        <button class="btn secundario cheio" type="button" data-acao="backup-baixar">Salvar backup</button>
        <button class="btn secundario cheio" type="button" data-acao="backup-restaurar">Restaurar backup</button>
      </div>
    </section>
    <section class="card larga">
      <h2>Conta</h2>
      <p class="mudo peq">Nome, e-mail e saída da conta.</p>
      <div class="acoes-card ${'linha2'}">
        <button class="btn secundario cheio" type="button" data-acao="perfil-nome">Mudar meu nome</button>
        <button class="btn secundario cheio" type="button" data-acao="privacidade">Privacidade e termos</button>
        <button class="btn perigo-claro cheio" type="button" data-acao="sair">Sair da conta</button>
        <button class="link perigo-txt" type="button" data-acao="conta-excluir">Excluir minha conta</button>
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
    privacidade: () => abrirPrivacidade(),
    'conta-excluir': () => abrirExclusao(),
    'personal-ativar': async () => {
      if (!(await confirmar('Ativar a aba Alunos? Você poderá convidar alunos e montar treinos para eles. Seus próprios treinos continuam funcionando normalmente.', { ok: 'Ativar' }))) return;
      salvarPerfil(estado.uid, { papel: 'personal' }, { merge: true });
      toast('Aba Alunos ativada.');
    },
    'vinculo-desligar': async () => {
      if (!(await confirmar('Desligar do seu personal? Ele deixa de ver seus dados e de montar seu treino. O que já foi montado fica com você, e você volta a poder editar.', { ok: 'Desligar', perigo: true }))) return;
      try { await removerGlobal('vinculos', estado.uid); toast('Você se desligou do personal.'); } catch (e) { console.error(e); toast('Não consegui desligar. Tente de novo.'); }
    },
    'vinculo-conectar': () => {
      const f = abrirFolha(`
        <h2>Código do personal</h2>
        <label class="campo">Código<input class="in codigo-in" data-f="codigo" maxlength="8" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="8 letras e números"></label>
        <p class="mudo peq">Ao conectar, seu personal poderá ver seus treinos feitos, dieta, peso, água e medidas, e montar seu treino e sua dieta. Você pode se desligar quando quiser.</p>
        <p class="erro" data-erro role="alert"></p>
        <div class="linha-botoes"><button class="btn secundario" type="button" data-fechar>Cancelar</button><button class="btn" type="button" data-ed="conectar">Conectar</button></div>`);
      const erro = (t) => { f.el.querySelector('[data-erro]').textContent = t; };
      f.el.addEventListener('click', async (e) => {
        if (!e.target.closest('[data-ed="conectar"]')) return;
        const codigo = f.el.querySelector('[data-f="codigo"]').value.trim().toUpperCase();
        if (!/^[A-Z2-9]{8}$/.test(codigo)) { erro('O código tem 8 letras e números.'); return; }
        erro('');
        let convite;
        try {
          const snap = await getDoc(doc(db, 'convites', codigo));
          if (!snap.exists()) { erro('Código não encontrado. Confira com seu personal.'); return; }
          convite = snap.data();
        } catch (err) { console.error(err); erro('Não consegui verificar o código. Confira a internet e tente de novo.'); return; }
        if (convite.personalUid === estado.uid) { erro('Esse código é o seu próprio.'); return; }
        if (!(await confirmar(`Conectar com ${convite.personalNome || 'esse personal'}? Ele passará a ver seus dados e a montar seu treino e sua dieta.`, { ok: 'Conectar' }))) return;
        try {
          await salvarGlobal('vinculos', estado.uid, {
            alunoUid: estado.uid, alunoNome: (estado.perfil && estado.perfil.nome) || '', alunoEmail: estado.email,
            personalUid: convite.personalUid, personalNome: convite.personalNome || '', codigo, criadoEm: new Date().toISOString()
          });
          f.fechar();
          toast('Conectado ao personal.');
        } catch (err) { console.error(err); erro('Não consegui conectar. Você já pode ter um personal, ou o código não vale mais.'); }
      });
    },
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
        <label class="campo">Peso desejado (kg) — deixe vazio para não ter meta
          <input class="in" inputmode="decimal" data-f="peso" placeholder="Ex.: 80" value="${metaPeso() ? String(metaPeso()).replace('.', ',') : ''}"></label>
        <label class="campo">Calorias por dia (kcal) — vazio = sem meta
          <input class="in" inputmode="numeric" data-f="kcal" value="${metaMacros().kcal || ''}"></label>
        <div class="grade3">
          <label class="campo">Proteína (g)<input class="in" inputmode="numeric" data-f="prot" value="${metaMacros().prot || ''}"></label>
          <label class="campo">Carbo (g)<input class="in" inputmode="numeric" data-f="carb" value="${metaMacros().carb || ''}"></label>
          <label class="campo">Gordura (g)<input class="in" inputmode="numeric" data-f="gord" value="${metaMacros().gord || ''}"></label>
        </div>
        <p class="erro" data-erro role="alert"></p>
        <div class="linha-botoes"><button class="btn secundario" type="button" data-fechar>Cancelar</button><button class="btn" type="button" data-ed="salvar">Salvar</button></div>`);
      f.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-ed="salvar"]')) return;
        const tp = f.el.querySelector('[data-f="peso"]').value.trim();
        const pe = tp ? numero(tp) : null;
        const mac = {};
        let macroRuim = false;
        [['kcal', 'metaKcal', 20000], ['prot', 'metaProt', 1000], ['carb', 'metaCarb', 2000], ['gord', 'metaGord', 1000]].forEach(([k, campo, max]) => {
          const t = f.el.querySelector(`[data-f="${k}"]`).value.trim();
          const n = t ? numero(t) : null;
          if (t && (n === null || n <= 0 || n > max)) macroRuim = true;
          mac[campo] = n;
        });
        const tv = f.el.querySelector('[data-f="vol"]').value.trim();
        const ta = f.el.querySelector('[data-f="agua"]').value.trim();
        const v = tv ? numero(tv) : null;
        const a = ta ? numero(ta) : null;
        const erro = f.el.querySelector('[data-erro]');
        if ((tv && (v === null || v <= 0 || v > 1000000)) || (ta && (a === null || a <= 0 || a > 20)) || (tp && (pe === null || pe < 20 || pe > 400)) || macroRuim) { erro.textContent = 'Digite números válidos (ou deixe vazio).'; return; }
        salvarPerfil(estado.uid, { metaVolume: v, metaAgua: a === null ? null : Math.round(a * 1000), metaPeso: pe, ...mac }, { merge: true });
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
