// Aba Perfil: dados da conta, backup e sair.
import { auth, signOut, db, doc, getDoc } from './firebase.js';
import { estado } from './estado.js';
import { abrirFolha, confirmar, fecharTodasFolhas } from './folha.js';
import { escaparHtml, dataLocal, toast, numero, formatarDataCurta, avatarHtml, reduzirFoto } from './util.js';
import { salvarPerfil, lerTudo, gravarVarios, salvarGlobal, removerGlobal } from './dados.js';
import { temaSalvo, definirTema } from './tema.js';
import { nav } from './nav.js';
import { metaVolume, metaAgua, metaPeso, metaMacros, formatarVolume } from './metricas.js';
import { abrirPrivacidade, abrirTermos, abrirExclusao } from './conta.js';
import { abrirAjuda } from './ajuda.js';
import { abrirOnboarding, resumoAnamnese, idadeDe } from './onboarding.js';
import { avisoVencido, resumoPlano, folhaPlanos, bloqueado } from './assinatura.js';

const COLECOES = ['treinos', 'regras', 'dietaItens', 'sessoes', 'peso', 'checks', 'agua', 'medidas', 'alimentos', 'refeicoes'];

async function baixarBackup() {
  try {
    toast('Preparando o backup…');
    const listas = await Promise.all(COLECOES.map((c) => lerTudo(estado.uid, c)));
    const dados = { app: 'treino', versao: 1, exportadoEm: new Date().toISOString() };
    COLECOES.forEach((c, i) => { dados[c] = listas[i]; });
    const nome = `backup-pfit-coach-${dataLocal()}.json`;
    const arquivo = new File([JSON.stringify(dados, null, 2)], nome, { type: 'application/json' });
    // No iPhone, o jeito mais fácil é abrir o menu de compartilhar e escolher "Salvar em Arquivos".
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      try { await navigator.share({ files: [arquivo], title: 'Backup do PFit Coach' }); return; } catch (e) {
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
  if (!dados || dados.app !== 'treino') return toast('Esse arquivo não é um backup do PFit Coach.');
  const listas = {};
  // Quem tem personal não pode mexer no treino e na dieta (o personal é quem monta).
  const COLS = estado.vinculo ? COLECOES.filter((c) => c !== 'treinos' && c !== 'regras' && c !== 'dietaItens') : COLECOES;
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

function cartaoSaude(p) {
  return `
    <section class="card">
    <h2>Meus dados e saúde</h2>
    ${resumoAnamnese(p.anamnese).length
  ? `<div class="lista-metas">${resumoAnamnese(p.anamnese).map(([k, v]) => `<div><span>${escaparHtml(k)}</span><strong>${escaparHtml(v)}</strong></div>`).join('')}</div>`
  : '<p class="mudo peq">Você ainda não respondeu. Leva 1 minuto e o app já sugere suas metas.</p>'}
    <div class="acoes-card"><button class="btn secundario cheio" type="button" data-acao="onboarding-refazer">${p.anamnese ? 'Atualizar respostas' : 'Responder agora'}</button></div>
  </section>`;
}

function cartaoPersonal() {
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
    </div>
  </section>`;
}

// Conta de personal: só os dados pessoais dele (nome, e-mail, idade). Nada de treino ou dieta próprios.
function cartaoDadosPersonal(p) {
  const idade = idadeDe(p.nascimento);
  return `
  <section class="card">
    <h2>Dados pessoais</h2>
    <div class="lista-metas">
      <div><span>Nome</span><strong>${escaparHtml(p.nome || '')}</strong></div>
      <div><span>E-mail</span><strong>${escaparHtml(estado.email || '')}</strong></div>
      <div><span>Data de nascimento</span><strong>${p.nascimento ? `${escaparHtml(formatarDataCurta(p.nascimento))}${idade !== null ? ` · ${idade} anos` : ''}` : 'não informada'}</strong></div>
    </div>
    <div class="acoes-card"><button class="btn secundario cheio" type="button" data-acao="personal-dados">${p.nascimento ? 'Editar data de nascimento' : 'Informar data de nascimento'}</button></div>
  </section>`;
}

const secao = (titulo, sub, cards) => `
    <section class="secao">
      <div class="secao-cab"><h2>${titulo}</h2>${sub ? `<p>${sub}</p>` : ''}</div>
      <div class="grade-cards">${cards}</div>
    </section>`;

const SETA = '<svg class="linha-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
// Linha de menu: título, explicação curta e seta. Serve para botões e para atalhos de tela.
const linha = (acao, titulo, sub, extra = '', classe = '') => `
      <button type="button" class="linha-menu ${classe}" data-acao="${acao}" ${extra}>
        <span class="linha-txt"><b>${titulo}</b>${sub ? `<small>${sub}</small>` : ''}</span>${SETA}
      </button>`;
const topoSub = (titulo) => `
    <header class="topo topo-sub">
      ${bloqueado() && titulo === 'Minha conta' ? '' : '<button type="button" class="voltar" data-acao="voltar" aria-label="Voltar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>'}
      <h1>${titulo}</h1>
    </header>`;

// Janela de UMA meta só (volume, água ou calorias), aberta pelo botão "Definir meta" de cada cartão.
const METAS_JANELA = {
  volume: {
    icone: '🏋️', titulo: 'Meta de volume por dia',
    desc: 'Quantos quilos você quer levantar em um dia. É a soma de carga × repetições dos seus treinos.',
    campos: () => [{ k: 'vol', rotulo: 'Volume por dia', un: 'kg', modo: 'numeric', valor: metaVolume() || '', ph: '0' }],
    tem: () => !!metaVolume(),
    ler(g) {
      const t = g('vol'); const v = t ? numero(t) : null;
      if (!t || v === null || v <= 0 || v > 1000000) return null;
      return { metaVolume: v };
    },
    limpar: { metaVolume: null }
  },
  agua: {
    icone: '💧', titulo: 'Meta de água por dia',
    desc: 'Quantos litros você quer beber por dia. Um copo no app é 250 ml.',
    campos: () => [{ k: 'agua', rotulo: 'Água por dia', un: 'litros', modo: 'decimal', valor: metaAgua() ? String(metaAgua() / 1000).replace('.', ',') : '', ph: '0', atalhos: ['2', '2,5', '3', '3,5', '4'] }],
    tem: () => !!metaAgua(),
    ler(g) {
      const t = g('agua'); const a = t ? numero(t) : null;
      if (!t || a === null || a <= 0 || a > 20) return null;
      return { metaAgua: Math.round(a * 1000) };
    },
    limpar: { metaAgua: null }
  },
  kcal: {
    icone: '🔥', titulo: 'Meta de calorias por dia',
    desc: 'Calorias do dia. Proteína, carboidrato e gordura são opcionais.',
    campos: () => {
      const m = metaMacros();
      return [
        { k: 'kcal', rotulo: 'Calorias por dia', un: 'kcal', modo: 'numeric', valor: m.kcal || '', ph: '0' },
        { k: 'prot', rotulo: 'Proteína', un: 'g', modo: 'numeric', valor: m.prot || '', ph: '—', pequeno: true },
        { k: 'carb', rotulo: 'Carboidrato', un: 'g', modo: 'numeric', valor: m.carb || '', ph: '—', pequeno: true },
        { k: 'gord', rotulo: 'Gordura', un: 'g', modo: 'numeric', valor: m.gord || '', ph: '—', pequeno: true }
      ];
    },
    tem: () => !!metaMacros().kcal,
    ler(g) {
      const out = {};
      for (const [k, campo, max, obrig] of [['kcal', 'metaKcal', 20000, true], ['prot', 'metaProt', 1000, false], ['carb', 'metaCarb', 2000, false], ['gord', 'metaGord', 1000, false]]) {
        const t = g(k);
        if (!t) { if (obrig) return null; out[campo] = null; continue; }
        const n = numero(t);
        if (n === null || n <= 0 || n > max) return null;
        out[campo] = n;
      }
      return out;
    },
    limpar: { metaKcal: null, metaProt: null, metaCarb: null, metaGord: null }
  }
};

function abrirMeta(tipo) {
  const cfg = METAS_JANELA[tipo];
  if (!cfg) return;
  const campos = cfg.campos();
  const principais = campos.filter((c) => !c.pequeno);
  const extras = campos.filter((c) => c.pequeno);
  const campoHtml = (c) => `<label class="meta-campo ${c.pequeno ? 'peq' : ''}"><span class="meta-rot">${escaparHtml(c.rotulo)}</span>
      <span class="meta-linha"><input class="meta-in" inputmode="${c.modo}" data-f="${c.k}" placeholder="${c.ph}" value="${escaparHtml(String(c.valor))}" autocomplete="off"><span class="meta-un">${escaparHtml(c.un)}</span></span></label>
      ${c.atalhos ? `<div class="meta-atalhos" aria-label="Atalhos">${c.atalhos.map((a) => `<button type="button" class="chip-meta" data-atalho="${c.k}" data-v="${a}">${a} L</button>`).join('')}</div>` : ''}`;
  const f = abrirFolha(`
    <div class="meta-janela">
      <div class="meta-icone" aria-hidden="true">${cfg.icone}</div>
      <h2>${escaparHtml(cfg.titulo)}</h2>
      <p class="mudo">${escaparHtml(cfg.desc)}</p>
      ${principais.map(campoHtml).join('')}
      ${extras.length ? `<div class="meta-extras">${extras.map(campoHtml).join('')}</div>` : ''}
      <p class="erro" data-erro role="alert"></p>
      <div class="linha-botoes"><button class="btn secundario" type="button" data-fechar>Cancelar</button><button class="btn" type="button" data-ed="salvar">Salvar meta</button></div>
      ${cfg.tem() ? '<button class="link meta-remover" type="button" data-ed="remover">Remover meta</button>' : ''}
    </div>`);
  const entrada = f.el.querySelector('.meta-in');
  setTimeout(() => { try { entrada.focus(); entrada.select(); } catch { /* ok */ } }, 250);
  f.el.addEventListener('click', (e) => {
    const at = e.target.closest('[data-atalho]');
    if (at) { f.el.querySelector(`[data-f="${at.dataset.atalho}"]`).value = at.dataset.v; return; }
    if (e.target.closest('[data-ed="remover"]')) {
      salvarPerfil(estado.uid, cfg.limpar, { merge: true });
      f.fechar(); toast('Meta removida.');
      return;
    }
    if (!e.target.closest('[data-ed="salvar"]')) return;
    const dados = cfg.ler((k) => (f.el.querySelector(`[data-f="${k}"]`) || { value: '' }).value.trim());
    if (!dados) { f.el.querySelector('[data-erro]').textContent = 'Digite um número válido.'; return; }
    salvarPerfil(estado.uid, dados, { merge: true });
    f.fechar(); toast('Meta salva.');
  });
  f.el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); f.el.querySelector('[data-ed="salvar"]').click(); } });
}

// Tela "Minha conta": quem sou eu, assinatura, personal e respostas iniciais.
export const contaTela = {
  render() {
    const p = estado.perfil || {};
    const personal = p.papel === 'personal';
    return `
    ${topoSub('Minha conta')}
    <section class="card conta-card">
      <div class="perfil-topo">
        <button type="button" class="avatar-btn" data-acao="foto-perfil" aria-label="Trocar foto de perfil">
          ${avatarHtml(p.foto, p.nome)}
          <span class="avatar-cam" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.4"/></svg></span>
        </button>
        <div class="perfil-quem">
          <h2>${escaparHtml(p.nome || '')}</h2>
          <p class="mudo peq">${escaparHtml(estado.email)}</p>
          <span class="selo">${personal ? 'Conta de personal' : 'Conta de aluno'}</span>
        </div>
        <button class="btn pequeno secundario perfil-editar" type="button" data-acao="perfil-nome">Editar nome</button>
      </div>
    </section>
    ${avisoVencido()}
    <section class="secao">
      <div class="linhas">
        ${personal ? '' : linha('personal-abrir', 'Meu personal', estado.vinculo ? escaparHtml(estado.vinculo.personalNome || 'Conectado') : 'Conectar com o código dele')}
        ${personal ? '' : linha('saude-abrir', 'Meus dados e saúde', p.anamnese ? 'Ver ou atualizar suas respostas' : 'Responder o questionário inicial (1 minuto)')}
        ${resumoPlano() ? linha('planos-abrir', 'Meu plano', resumoPlano().sub, '', resumoPlano().venc ? 'perigo' : '') : ''}
        ${linha('aba', 'Configurações', personal ? 'Dados pessoais, tema e privacidade' : 'Tema, metas, backup e privacidade', 'data-aba="config"')}
        ${linha('ajuda', 'Ajuda', 'Como usar o app e falar com o suporte')}
      </div>
    </section>
    <section class="secao">
      <button class="btn perigo-claro cheio" type="button" data-acao="sair">Sair da conta</button>
    </section>
    <p class="aviso-rodape">PFit Coach · versão 1</p>`;
  },
  acoes: {
    'planos-abrir': () => abrirFolha(folhaPlanos()),
    'personal-abrir': () => abrirFolha(`${cartaoPersonal()}<button class="btn secundario cheio" type="button" data-fechar>Fechar</button>`),
    'saude-abrir': () => abrirFolha(`${cartaoSaude(estado.perfil || {})}<button class="btn secundario cheio" type="button" data-fechar>Fechar</button>`, { classe: 'folha-alta' }),
    privacidade: () => abrirPrivacidade(),
    termos: () => abrirTermos(),
    'onboarding-refazer': () => { fecharTodasFolhas(); abrirOnboarding({ refazer: true }); },
    ajuda: () => abrirAjuda(),
    'conta-excluir': () => abrirExclusao(),
    'personal-dados': () => {
      const atual = (estado.perfil || {}).nascimento || '';
      const f = abrirFolha(`
        <h2>Data de nascimento</h2>
        <label class="campo">Sua data de nascimento<input class="in" type="date" data-f="nasc" max="${dataLocal()}" value="${escaparHtml(atual)}"></label>
        <p class="erro" data-erro role="alert"></p>
        <div class="linha-botoes"><button class="btn secundario" type="button" data-fechar>Cancelar</button><button class="btn" type="button" data-ed="salvar">Salvar</button></div>`);
      f.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-ed="salvar"]')) return;
        const v = f.el.querySelector('[data-f="nasc"]').value;
        const idade = idadeDe(v);
        if (!v || idade === null || idade < 14 || idade > 110) { f.el.querySelector('[data-erro]').textContent = 'Escolha uma data de nascimento válida.'; return; }
        salvarPerfil(estado.uid, { nascimento: v }, { merge: true });
        f.fechar();
        toast('Data de nascimento salva.');
      });
    },
    'vinculo-desligar': async () => {
      fecharTodasFolhas();
      if (!(await confirmar('Desligar do seu personal? Ele deixa de ver seus dados e de montar seu treino. O que já foi montado fica com você, e você volta a poder editar.', { ok: 'Desligar', perigo: true }))) return;
      try { await removerGlobal('vinculos', estado.uid); toast('Você se desligou do personal.'); } catch (e) { console.error(e); toast('Não consegui desligar. Tente de novo.'); }
    },
    'vinculo-conectar': () => {
      fecharTodasFolhas();
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
    'foto-perfil': () => {
      const tem = !!((estado.perfil || {}).foto);
      const f = abrirFolha(`
        <h2>Foto de perfil</h2>
        <div class="foto-previa">${avatarHtml((estado.perfil || {}).foto, (estado.perfil || {}).nome, 'grande')}</div>
        <p class="mudo peq">Escolha uma foto da galeria ou tire uma agora. Ela é cortada em quadrado e fica só na sua conta.</p>
        <p class="erro" data-erro role="alert"></p>
        <div class="linha-botoes"><button class="btn" type="button" data-ed="escolher">${tem ? 'Trocar foto' : 'Escolher foto'}</button>${tem ? '<button class="btn perigo-claro" type="button" data-ed="remover">Remover</button>' : ''}<button class="btn secundario" type="button" data-fechar>Cancelar</button></div>`);
      f.el.addEventListener('click', (e) => {
        if (e.target.closest('[data-ed="remover"]')) { salvarPerfil(estado.uid, { foto: null }, { merge: true }); f.fechar(); toast('Foto removida.'); return; }
        if (!e.target.closest('[data-ed="escolher"]')) return;
        const entrada = document.createElement('input');
        entrada.type = 'file'; entrada.accept = 'image/*';
        entrada.addEventListener('change', async () => {
          const arq = entrada.files && entrada.files[0];
          if (!arq) return;
          try {
            const foto = await reduzirFoto(arq);
            await salvarPerfil(estado.uid, { foto }, { merge: true });
            f.fechar(); toast('Foto atualizada.');
          } catch (err) {
            console.error(err);
            const el = f.el.querySelector('[data-erro]'); if (el) el.textContent = 'Não consegui usar essa imagem. Tente outra.';
          }
        });
        entrada.click();
      });
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
    'meta-editar': (el) => abrirMeta(el.dataset.meta),
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

// Tela "Configurações": aparência, metas, dados e privacidade, ajuda.
export const configTela = {
  render() {
    const m = metaMacros();
    const personal = !!(estado.perfil && estado.perfil.papel === 'personal');
    return `
    ${topoSub('Configurações')}
    ${personal ? secao('Dados pessoais', 'As informações do seu perfil de personal.', cartaoDadosPersonal(estado.perfil || {})) : ''}
    ${secao('Aparência', 'Escolha como o app aparece. A mudança é na hora.', `
    <section class="card">
      <div class="seg tema" role="group" aria-label="Tema do app">
        ${[['auto', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']].map(([id, nome]) => `<button type="button" aria-pressed="${temaSalvo() === id}" data-acao="tema" data-tema="${id}">${nome}</button>`).join('')}
      </div>
      <p class="mudo peq dica-tema">Automático acompanha o modo claro ou escuro do seu aparelho.</p>
    </section>`)}
    ${personal ? '' : secao('Metas', 'O que você quer alcançar a cada dia.', `
    <section class="card">
      ${estado.vinculo ? '<p class="mudo peq">Definidas pelo seu personal.</p>' : ''}
      <div class="lista-metas">
        <div><span>Volume por dia</span><strong>${metaVolume() ? formatarVolume(metaVolume()) : 'sem meta'}</strong></div>
        <div><span>Água por dia</span><strong>${metaAgua() ? (metaAgua() / 1000).toLocaleString('pt-BR') + ' L' : 'sem meta'}</strong></div>
        <div><span>Peso desejado</span><strong>${metaPeso() ? metaPeso().toLocaleString('pt-BR') + ' kg' : 'sem meta'}</strong></div>
        <div><span>Calorias por dia</span><strong>${m.kcal ? m.kcal.toLocaleString('pt-BR') + ' kcal' : 'sem meta'}</strong></div>
        <div><span>Proteína · carbo · gordura</span><strong>${['prot', 'carb', 'gord'].map((k) => (m[k] ? m[k] + ' g' : '—')).join(' · ')}</strong></div>
      </div>
      ${estado.vinculo ? '' : '<div class="acoes-card"><button class="btn secundario cheio" type="button" data-acao="metas-editar">Mudar metas</button></div>'}
    </section>`)}
    <section class="secao">
      <div class="secao-cab"><h2>Dados e privacidade</h2><p>${personal ? 'Leia as regras do app ou apague a conta.' : 'Guarde uma cópia, leia as regras ou apague tudo. As fotos não entram no backup.'}</p></div>
      <input type="file" id="arq-backup" accept="application/json,.json" hidden data-mudar="backup-arquivo">
      <div class="linhas">
        ${personal ? '' : `${linha('backup-baixar', 'Salvar backup', 'Treinos, dieta, histórico, peso e medidas')}
        ${linha('backup-restaurar', 'Restaurar backup', 'Volta os dados de um arquivo salvo')}`}
        ${linha('privacidade', 'Privacidade', 'Como seus dados são usados')}
        ${linha('termos', 'Termos de uso', 'As regras do app')}
      </div>
    </section>
    <section class="secao">
      <div class="secao-cab"><h2>Ajuda</h2></div>
      <div class="linhas">
        ${linha('ajuda', 'Como usar o app', 'Passo a passo, instalar no celular e suporte')}
      </div>
    </section>
    <section class="secao">
      <div class="secao-cab"><h2>Zona de cuidado</h2></div>
      <div class="linhas">
        ${linha('conta-excluir', 'Excluir minha conta', 'Apaga a conta e todos os dados para sempre', '', 'perigo')}
      </div>
    </section>
    <p class="aviso-rodape">PFit Coach · versão 1</p>`;
  },
  mudancas: {
    'backup-arquivo': (el) => {
      const arq = el.files && el.files[0];
      el.value = '';
      if (arq) restaurarBackup(arq);
    }
  },
  acoes: {}
};

