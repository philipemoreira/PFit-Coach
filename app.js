// Ponto de partida do app: decide qual tela mostrar e liga os cliques às ações.
import { configurado, auth, onAuthStateChanged, signOut } from './firebase.js';
import { estado, iniciarDados, pararDados } from './estado.js';
import { nav } from './nav.js';
import { htmlEntrada, htmlCompletar, htmlCarregando, htmlSemConfig, acoesAuth, formsAuth } from './auth.js';
import { hoje } from './hoje.js';
import { treinos } from './treinos.js';
import { dieta } from './dieta.js';
import { progresso } from './progresso.js';
import { perfil } from './perfil.js';
import { treinoAberto } from './treinar.js';
import { aplicarTema } from './tema.js';

aplicarTema();
const app = document.getElementById('app');

const ICONES = {
  hoje: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  treinos: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  dieta: '<path d="M12 7c-2-3-7-2-7 3 0 5 4 10 7 10s7-5 7-10c0-5-5-6-7-3zM12 7c0-2 1-3 3-4"/>',
  progresso: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'
};
const ABAS = [
  { id: 'hoje', nome: 'Hoje', tela: hoje },
  { id: 'treinos', nome: 'Treinos', tela: treinos },
  { id: 'dieta', nome: 'Dieta', tela: dieta },
  { id: 'progresso', nome: 'Progresso', tela: progresso },
  { id: 'perfil', nome: 'Perfil', tela: perfil }
];

// Todas as ações e formulários das telas num lugar só.
const ACOES = { ...acoesAuth };
const MUDANCAS = {};
ABAS.forEach(({ tela }) => {
  Object.assign(ACOES, tela.acoes || {});
  Object.assign(MUDANCAS, tela.mudancas || {});
});
ACOES.aba = (el) => nav.irPara(el.dataset.aba);
ACOES['sair-direto'] = () => signOut(auth);

let telaAtual = ''; // 'entrada' | 'carregando' | 'completar' | 'principal' | 'config'
let abaAtual = 'hoje';
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

function montarPrincipal() {
  app.innerHTML = `
    <div class="shell">
      <main id="conteudo" class="conteudo" tabindex="-1"></main>
      <nav class="nav" aria-label="Menu principal">
        ${ABAS.map((a) => `<button type="button" class="nav-btn" data-acao="aba" data-aba="${a.id}" aria-label="${a.nome}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[a.id]}</svg><span>${a.nome}</span></button>`).join('')}
      </nav>
    </div>`;
}

function renderizar() {
  if (telaAtual !== 'principal') return;
  const conteudo = document.getElementById('conteudo');
  if (!conteudo) return;
  const aba = ABAS.find((a) => a.id === abaAtual);
  const y = window.scrollY;
  conteudo.innerHTML = aba.tela.render();
  document.querySelectorAll('.nav-btn').forEach((b) => {
    const ativo = b.dataset.aba === abaAtual;
    b.classList.toggle('ativo', ativo);
    if (ativo) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  window.scrollTo(0, y);
}

// Junta várias mudanças seguidas numa só atualização de tela.
function agendarRender() {
  if (desenhoMarcado) return;
  desenhoMarcado = true;
  requestAnimationFrame(() => { desenhoMarcado = false; renderizar(); });
}

nav.irPara = (id) => {
  if (!ABAS.some((a) => a.id === id)) return;
  const mudou = id !== abaAtual;
  abaAtual = id;
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
    } else {
      pararDados();
    }
    escolherTela();
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Sem modo offline:', e));
  });
}
