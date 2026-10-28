// Ponto de partida do app: decide qual tela mostrar e liga os cliques às ações.
import { configurado, auth, onAuthStateChanged, signOut } from './firebase.js';
import { estado, iniciarDados, pararDados } from './estado.js';
import { nav } from './nav.js';
import { htmlEntrada, htmlCompletar, htmlCarregando, htmlSemConfig, acoesAuth, formsAuth } from './auth.js';
import { hoje } from './hoje.js';
import { treinos } from './treinos.js';
import { dieta } from './dieta.js';
import { progresso } from './progresso.js';
import { contaTela, configTela } from './perfil.js';
import { personal, pararPersonal } from './personal.js';
import { acoesRecados } from './recados.js';
import { bloqueado } from './assinatura.js';
import { abrirBoasVindas } from './ajuda.js';
import { abrirOnboarding } from './onboarding.js';
import { treinoAberto } from './treinar.js';
import { aplicarTema } from './tema.js';
import { escaparHtml } from './util.js';

aplicarTema();
const app = document.getElementById('app');

const ICONES = {
  hoje: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  treinos: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  dieta: '<path d="M12 7c-2-3-7-2-7 3 0 5 4 10 7 10s7-5 7-10c0-5-5-6-7-3zM12 7c0-2 1-3 3-4"/>',
  progresso: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  alunos: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M16 4.5a3.5 3.5 0 0 1 0 7M22 20c0-3-2-4.8-5-5.3"/>'
};
const ABAS = [
  { id: 'hoje', nome: 'Hoje', tela: hoje },
  { id: 'treinos', nome: 'Treinos', tela: treinos },
  { id: 'dieta', nome: 'Dieta', tela: dieta },
  { id: 'progresso', nome: 'Progresso', tela: progresso },
  { id: 'alunos', nome: 'Alunos', tela: personal, soPersonal: true }
];
// Telas que não ficam no menu de baixo: abrem pela foto/inicial no topo.
const EXTRAS = [
  { id: 'conta', nome: 'Minha conta', tela: contaTela },
  { id: 'config', nome: 'Configurações', tela: configTela }
];
const TELAS = [...ABAS, ...EXTRAS];
const ehExtra = (id) => EXTRAS.some((e) => e.id === id);

// Todas as ações e formulários das telas num lugar só.
const ACOES = { ...acoesAuth, ...acoesRecados };
const MUDANCAS = {};
TELAS.forEach(({ tela }) => {
  Object.assign(ACOES, tela.acoes || {});
  Object.assign(MUDANCAS, tela.mudancas || {});
});
ACOES.aba = (el) => nav.irPara(el.dataset.aba);
ACOES.voltar = () => nav.voltar();
ACOES['sair-direto'] = () => signOut(auth);

const souPersonal = () => !!(estado.perfil && estado.perfil.papel === 'personal');
// Com a assinatura vencida só ficam Minha conta e Configurações (sem menu de baixo).
const abasVisiveis = () => (bloqueado() ? [] : ABAS.filter((a) => !a.soPersonal || souPersonal()));
let navAssinatura = '';

let telaAtual = ''; // 'entrada' | 'carregando' | 'completar' | 'principal' | 'config'
let abaAtual = 'hoje';
let pilha = []; // de onde a pessoa veio (para o botão Voltar)
let desenhoMarcado = false;
let entrando = null;

// Faz os blocos da aba "entrarem" deslizando (só ao abrir a aba, não a cada atualização de dados).
function animarEntrada() {
  const c = document.getElementById('conteudo');
  if (!c) return;
  c.classList.add('entrando');
  clearTimeout(entrando);
  entrando = setTimeout(() => c.classList.remove('entrando'), 800);
}

function htmlNav() {
  return `
        <div class="nav-marca" aria-hidden="true"><svg viewBox="0 0 512 512"><rect width="512" height="512" rx="110" fill="#181b22"/><g fill="#c6f432"><rect x="196" y="236" width="120" height="40" rx="8"/><rect x="150" y="176" width="46" height="160" rx="14"/><rect x="316" y="176" width="46" height="160" rx="14"/><rect x="108" y="206" width="34" height="100" rx="12"/><rect x="370" y="206" width="34" height="100" rx="12"/></g></svg><b>Treino</b></div>
        ${abasVisiveis().map((a) => `<button type="button" class="nav-btn" data-acao="aba" data-aba="${a.id}" aria-label="${a.nome}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[a.id]}</svg><span>${a.nome}</span></button>`).join('')}`;
}

function htmlBarra() {
  const nome = ((estado.perfil && estado.perfil.nome) || '').trim();
  const inicial = (nome || '?').charAt(0).toUpperCase();
  return `
      <div class="topbar-marca" aria-hidden="true"><svg viewBox="0 0 512 512"><rect width="512" height="512" rx="110" fill="#181b22"/><g fill="#c6f432"><rect x="196" y="236" width="120" height="40" rx="8"/><rect x="150" y="176" width="46" height="160" rx="14"/><rect x="316" y="176" width="46" height="160" rx="14"/><rect x="108" y="206" width="34" height="100" rx="12"/><rect x="370" y="206" width="34" height="100" rx="12"/></g></svg><b>Treino</b></div>
      <button type="button" class="conta-btn" data-acao="aba" data-aba="conta" aria-label="Minha conta">
        <span class="conta-nome">${escaparHtml(nome.split(' ')[0])}</span><span class="avatar peq">${escaparHtml(inicial)}</span>
      </button>`;
}

function montarPrincipal() {
  navAssinatura = abasVisiveis().map((a) => a.id).join(',');
  app.innerHTML = `
    <div class="shell">
      <header id="topbar" class="topbar">${htmlBarra()}</header>
      <main id="conteudo" class="conteudo" tabindex="-1"></main>
      <nav class="nav" aria-label="Menu principal" ${abasVisiveis().length ? '' : 'hidden'}>${htmlNav()}
      </nav>
    </div>`;
}

let boasVistas = false;
function boasVindasSeNovo() {
  if (boasVistas || !estado.perfil || estado.perfil.viuBoasVindas !== false) return;
  boasVistas = true;
  setTimeout(() => (estado.perfil && estado.perfil.papel === 'personal' ? abrirBoasVindas(true) : abrirOnboarding()), 400);
}

function renderizar() {
  if (telaAtual !== 'principal') return;
  boasVindasSeNovo();
  const conteudo = document.getElementById('conteudo');
  if (!conteudo) return;
  // Se a lista de abas mudou (ex.: a pessoa virou personal), refaz o menu.
  const assin = abasVisiveis().map((a) => a.id).join(',');
  if (assin !== navAssinatura) {
    navAssinatura = assin;
    const menu = document.querySelector('.nav');
    if (menu) { menu.innerHTML = htmlNav(); menu.hidden = abasVisiveis().length === 0; }
  }
  if (!ehExtra(abaAtual) && !abasVisiveis().some((a) => a.id === abaAtual)) abaAtual = abasVisiveis().length ? abasVisiveis()[0].id : 'conta';
  const barra = document.getElementById("topbar");
  if (barra) barra.innerHTML = htmlBarra();
  const aba = TELAS.find((a) => a.id === abaAtual);
  const y = window.scrollY;
  conteudo.innerHTML = aba.tela.render();
  document.querySelectorAll('.nav-btn').forEach((b) => {
    const ativo = b.dataset.aba === abaAtual;
    b.classList.toggle('ativo', ativo);
    if (ativo) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  const cb = document.querySelector('.conta-btn');
  if (cb) cb.classList.toggle('ativo', ehExtra(abaAtual));
  window.scrollTo(0, y);
}

// Junta várias mudanças seguidas numa só atualização de tela.
function agendarRender() {
  if (desenhoMarcado) return;
  desenhoMarcado = true;
  requestAnimationFrame(() => { desenhoMarcado = false; renderizar(); });
}

nav.irPara = (id) => {
  if (!ehExtra(id) && !abasVisiveis().some((a) => a.id === id)) return;
  const mudou = id !== abaAtual;
  if (mudou) { if (ehExtra(id)) pilha.push(abaAtual); else pilha = []; }
  abaAtual = id;
  if (mudou) animarEntrada();
  renderizar();
  if (mudou) window.scrollTo(0, 0);
};
nav.voltar = () => {
  const alvo = pilha.pop() || (abasVisiveis().length ? abasVisiveis()[0].id : 'conta');
  const mudou = alvo !== abaAtual;
  abaAtual = alvo;
  if (mudou) animarEntrada();
  renderizar();
  if (mudou) window.scrollTo(0, 0);
};
nav.renderizar = renderizar;

function escolherTela() {
  let nova;
  if (!estado.uid) nova = 'entrada';
  else if (estado.perfil === undefined || estado.criandoConta) nova = 'carregando';
  else if (estado.perfil === null) nova = 'completar';
  else nova = 'principal';

  if (nova !== telaAtual) {
    telaAtual = nova;
    if (nova === 'entrada') app.innerHTML = htmlEntrada();
    else if (nova === 'carregando') app.innerHTML = htmlCarregando();
    else if (nova === 'completar') app.innerHTML = htmlCompletar();
    else { montarPrincipal(); animarEntrada(); renderizar(); }
  }
}

function aoMudarDados() {
  escolherTela();
  if (telaAtual === 'principal') agendarRender();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-acao]');
  if (!el) return;
  const f = ACOES[el.dataset.acao];
  if (f) { e.preventDefault(); f(el, e); }
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-mudar]');
  if (!el) return;
  const f = MUDANCAS[el.dataset.mudar];
  if (f) f(el, e);
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const f = formsAuth[form.dataset.form];
  if (f) f(form);
});

// Brilho que acompanha o mouse nos cartões (só em computador com mouse).
if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.addEventListener('mousemove', (e) => {
    const alvo = e.target.closest && e.target.closest('.card, .tile, .hero-treino, .ex-card, .num-card');
    if (!alvo) return;
    const r = alvo.getBoundingClientRect();
    alvo.style.setProperty('--mx', `${e.clientX - r.left}px`);
    alvo.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
}

// Quando o app volta para a frente num dia novo, atualiza "hoje".
let diaVisto = new Date().toDateString();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const hojeTexto = new Date().toDateString();
  if (hojeTexto !== diaVisto) { diaVisto = hojeTexto; if (!treinoAberto()) renderizar(); }
});

if (!configurado) {
  telaAtual = 'config';
  app.innerHTML = htmlSemConfig();
} else {
  app.innerHTML = htmlCarregando();
  onAuthStateChanged(auth, (usuario) => {
    if (usuario) {
      iniciarDados(usuario.uid, usuario.email, aoMudarDados);
      estado.nomeSugerido = usuario.displayName || '';
    } else {
      pararPersonal();
      pararDados();
      boasVistas = false;
    }
    escolherTela();
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Sem modo offline:', e));
  });
}
