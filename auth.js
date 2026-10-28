// Telas de entrada: login, criar conta, completar cadastro e avisos iniciais.
import {
  auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
  GoogleAuthProvider, signInWithPopup
} from './firebase.js';
import { escaparHtml, toast } from './util.js';
import { conectarPersonal, consultarConvite, CODIGO_OK } from './vinculo.js';
import { abrirTermos, abrirPrivacidade } from './conta.js';
import { PRECOS } from './assinatura.js';
import { estado } from './estado.js';
import { salvarPerfil } from './dados.js';

let modo = 'entrar'; // 'entrar' ou 'criar'
let emailLembrado = ''; // mantém o e-mail digitado quando a pessoa troca entre Entrar e Criar conta

const LOGO = `<svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="110" fill="#181b22"/><g fill="#c6f432"><rect x="196" y="236" width="120" height="40" rx="8"/><rect x="150" y="176" width="46" height="160" rx="14"/><rect x="316" y="176" width="46" height="160" rx="14"/><rect x="108" y="206" width="34" height="100" rx="12"/><rect x="370" y="206" width="34" height="100" rx="12"/></g></svg>`;

const ic = (caminho) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${caminho}</svg>`;
const ICONE = {
  email: ic('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7.5l8.5 6 8.5-6"/>'),
  senha: ic('<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  nome: ic('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>')
};
const OLHO = `<button type="button" class="olho" data-acao="olho" aria-pressed="false" aria-label="Mostrar senha">
  <svg class="i-aberto" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
  <svg class="i-fechado" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 7.6C3.9 9.3 2 12 2 12s3.5 6 10 6c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
</button>`;
const GOOGLE = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

const MENSAGENS = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'Esse e-mail não parece válido.',
  'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Toque em "Entrar".',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Espere um pouco e tente de novo.',
  'auth/network-request-failed': 'Sem internet. Confira a conexão e tente de novo.',
  'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Libere pop-ups para este site ou entre com e-mail e senha.',
  'auth/unauthorized-domain': 'Este endereço ainda não foi autorizado no Firebase.',
  'auth/operation-not-allowed': 'O login com Google não está ativado no Firebase.',
  'auth/account-exists-with-different-credential': 'Já existe uma conta com esse e-mail criada com senha. Entre com e-mail e senha.'
};
const traduzir = (e) => MENSAGENS[e && e.code] || 'Não deu certo. Tente de novo em instantes.';

// Campo com rótulo que sobe quando você digita, ícone e (na senha) o olhinho.
const campo = ({ nome, rotulo, tipo = 'text', icone, auto, valor = '', extra = '' }) => `
  <div class="fl">
    ${icone}
    <input class="fl-in" id="f-${nome}" name="${nome}" type="${tipo}" placeholder=" " autocomplete="${auto}" ${extra} value="${escaparHtml(valor)}">
    <label for="f-${nome}">${rotulo}</label>
    ${tipo === 'password' ? OLHO : ''}
  </div>`;

const preco = (v) => 'R$ ' + v.toFixed(2).replace('.', ',');

// ---------- Cadastro em etapas: 1) como vai usar  2) código do personal (se tiver)  3) dados da conta ----------
const novoCad = () => ({ passo: 'tipo', tipo: null, codigo: '', personalNome: '' });
let cad = novoCad();

const TIPOS = {
  sozinho: {
    titulo: 'Treino por conta própria', desc: 'Monte seus treinos e sua dieta do seu jeito.',
    tag: () => `15 dias grátis · depois ${preco(PRECOS.aluno)}/mês`,
    resumo: 'Por conta própria',
    icone: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'
  },
  'com-personal': {
    titulo: 'Tenho um personal', desc: 'Siga o treino e a dieta que ele montou. Você só executa.',
    tag: () => 'Sem custo para você',
    resumo: 'Com meu personal',
    icone: '<circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5S15.5 16.5 15.5 20M16 14.5c3 0 5.5 1.7 5.5 4.5"/>'
  },
  personal: {
    titulo: 'Sou personal', desc: 'Monte treinos e dietas e acompanhe seus alunos.',
    tag: () => `15 dias grátis · a partir de ${preco(PRECOS.p5)}/mês`,
    resumo: 'Sou personal',
    icone: '<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/>'
  }
};

const setaVoltar = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const cabecalhoPasso = (n, total, titulo, sub) => `
  <div class="passo-topo">
    <button type="button" class="icone-btn" data-acao="cad-voltar" aria-label="Voltar">${setaVoltar}</button>
    <span class="passo-n">Etapa ${n} de ${total}</span>
    <span class="passo-vazio"></span>
  </div>
  <div class="passo-barra" aria-hidden="true"><i style="width:${(n / total) * 100}%"></i></div>
  <h1>${titulo}</h1>
  <p class="sub">${sub}</p>`;

const totalPassos = () => (cad.tipo === 'com-personal' ? 3 : 2);
const resumoEscolha = () => `
  <div class="escolha-resumo">
    <div><small>Você escolheu</small><strong>${escaparHtml(TIPOS[cad.tipo].resumo)}${cad.personalNome ? ` · ${escaparHtml(cad.personalNome)}` : ''}</strong></div>
    <button type="button" class="link" data-acao="cad-trocar">Trocar</button>
  </div>`;

function htmlPassoTipo() {
  return `
      <div class="logo-grande">${LOGO}</div>
      <h1>Criar conta</h1>
      <p class="sub">Como você vai usar o Treino?</p>
      <div class="tipos">
        ${Object.entries(TIPOS).map(([id, t]) => `
        <button type="button" class="tipo-card" data-acao="cad-tipo" data-tipo="${id}">
          <span class="tipo-ico">${ic(t.icone)}</span>
          <span class="tipo-txt"><strong>${t.titulo}</strong><small>${t.desc}</small><em>${t.tag()}</em></span>
          <svg class="tipo-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
        </button>`).join('')}
      </div>
      <p class="rodape-entrada">Já tem conta? <button type="button" class="link" data-acao="modo-entrada" data-modo="entrar">Entrar</button></p>`;
}

function htmlPassoCodigo() {
  return `
      ${cabecalhoPasso(2, 3, 'Código do seu personal', 'Peça o código de 8 letras e números ao seu personal. Ele aparece na aba Alunos dele.')}
      <form data-form="codigo" novalidate>
        <input class="codigo-grande" name="codigo" type="text" maxlength="8" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="••••••••" aria-label="Código do personal" value="${escaparHtml(cad.codigo)}">
        <p class="erro" role="alert" data-erro></p>
        <button class="btn cheio grande-btn" type="submit">Verificar código</button>
      </form>
      <details class="ajuda-codigo"><summary>Ainda não tenho o código</summary>
        <p>Peça ao seu personal para abrir a aba <b>Alunos</b> no app e te passar o código. Se você quer usar o app sem personal, volte e escolha <b>Treino por conta própria</b>.</p>
        <button type="button" class="link" data-acao="cad-trocar">Escolher outra opção</button>
      </details>`;
}

function htmlLegal() {
  return `<p class="legal-curto">Ao continuar, você concorda com os <button type="button" class="link" data-acao="cad-termos">Termos de uso</button> e a <button type="button" class="link" data-acao="cad-privacidade">Política de privacidade</button>.</p>`;
}

function htmlPassoConta() {
  const n = totalPassos();
  return `
      ${cabecalhoPasso(n, n, 'Crie sua conta', 'Falta só isso para começar.')}
      ${resumoEscolha()}
      <form data-form="criar" id="form-entrada" novalidate>
        ${campo({ nome: 'nome', rotulo: 'Seu nome', icone: ICONE.nome, auto: 'name', extra: 'maxlength="60"' })}
        ${campo({ nome: 'email', rotulo: 'E-mail', tipo: 'email', icone: ICONE.email, auto: 'email', valor: emailLembrado, extra: 'inputmode="email" autocapitalize="off" spellcheck="false"' })}
        ${campo({ nome: 'senha', rotulo: 'Senha (mínimo 6 caracteres)', tipo: 'password', icone: ICONE.senha, auto: 'new-password' })}
        <p class="erro" role="alert" data-erro></p>
        <button class="btn cheio grande-btn" type="submit">Criar minha conta</button>
        <div class="ou"><span>ou</span></div>
        <button class="btn-google" type="button" data-acao="google-entrar">${GOOGLE}<span>Continuar com Google</span></button>
        ${htmlLegal()}
      </form>`;
}

// Quem entrou com o Google e ainda não tem cadastro: confirma o nome e termina.
function htmlPassoNome() {
  const n = totalPassos();
  return `
      ${cabecalhoPasso(n, n, 'Confirme seu nome', 'Como você quer ser chamado no app?')}
      ${resumoEscolha()}
      <form data-form="completar" novalidate>
        ${campo({ nome: 'nome', rotulo: 'Seu nome', icone: ICONE.nome, auto: 'name', valor: estado.nomeSugerido || '', extra: 'maxlength="60"' })}
        <p class="erro" role="alert" data-erro></p>
        <button class="btn cheio grande-btn" type="submit">Começar</button>
        ${htmlLegal()}
        <button class="link centro" type="button" data-acao="sair-direto">Sair</button>
      </form>`;
}

const papelDe = (tipo) => (tipo === 'personal' ? 'personal' : 'aluno');
async function ligarAoPersonal(uid, nome, email) {
  if (cad.tipo !== 'com-personal') return;
  const r = await conectarPersonal({ uid, nome, email, codigo: cad.codigo });
  setTimeout(() => toast(r.ok
    ? `Conectado com ${r.personalNome}!`
    : `Conta criada, mas ${r.erro.charAt(0).toLowerCase() + r.erro.slice(1)} Tente de novo em Minha conta → Tenho um código de personal.`), 700);
}

const painelMarca = `
  <aside class="entrada-marca">
    <div class="logo-pequeno">${LOGO}</div>
    <h2>Treino e dieta,<br>num lugar só.</h2>
    <ul>
      <li>Treinos com séries, cargas e descanso</li>
      <li>Dieta com checklist para cada dia</li>
      <li>Progresso em gráficos</li>
    </ul>
  </aside>`;

export function htmlEntrada() {
  if (modo === 'criar') {
    const passo = cad.tipo ? cad.passo : 'tipo';
    const corpo = passo === 'codigo' ? htmlPassoCodigo() : passo === 'conta' ? htmlPassoConta() : htmlPassoTipo();
    return `
  <main class="entrada">
    ${painelMarca}
    <div class="entrada-caixa">${corpo}</div>
  </main>`;
  }
  return `
  <main class="entrada">
    ${painelMarca}
    <div class="entrada-caixa">
      <div class="logo-grande">${LOGO}</div>
      <h1>Bem-vindo</h1>
      <p class="sub">Entre para ver seu treino e sua dieta.</p>
      <form data-form="entrar" id="form-entrada" novalidate>
        ${campo({ nome: 'email', rotulo: 'E-mail', tipo: 'email', icone: ICONE.email, auto: 'email', valor: emailLembrado, extra: 'inputmode="email" autocapitalize="off" spellcheck="false"' })}
        ${campo({ nome: 'senha', rotulo: 'Senha', tipo: 'password', icone: ICONE.senha, auto: 'current-password' })}
        <p class="erro" role="alert" data-erro></p>
        <p class="aviso-ok" data-ok></p>
        <button class="btn cheio grande-btn" type="submit">Entrar</button>
        <button class="link centro" type="button" data-acao="esqueci-senha">Esqueci minha senha</button>
        <div class="ou"><span>ou</span></div>
        <button class="btn-google" type="button" data-acao="google-entrar">${GOOGLE}<span>Continuar com Google</span></button>
      </form>
      <p class="rodape-entrada">Ainda não tem conta? <button type="button" class="link" data-acao="modo-entrada" data-modo="criar">Criar conta</button></p>
    </div>
  </main>`;
}

// Cadastro de quem entrou com o Google e ainda não escolheu como vai usar o app.
export function htmlCompletar() {
  const passo = cad.tipo ? (cad.passo === 'codigo' ? 'codigo' : 'nome') : 'tipo';
  const corpo = passo === 'codigo' ? htmlPassoCodigo() : passo === 'nome' ? htmlPassoNome() : htmlPassoTipo().replace(/<p class="rodape-entrada">[\s\S]*?<\/p>/, '<button class="link centro" type="button" data-acao="sair-direto">Sair</button>');
  return `
  <main class="entrada">
    ${painelMarca}
    <div class="entrada-caixa">${corpo}</div>
  </main>`;
}

export function htmlCarregando() {
  return `<main class="carregando"><div class="spinner" aria-label="Carregando"></div></main>`;
}

export function htmlSemConfig() {
  return `
  <main class="entrada">
    <div class="entrada-caixa">
      <div class="logo-grande">${LOGO}</div>
      <h1>Quase lá</h1>
      <p class="sub">O app ainda não está ligado ao Firebase (o lugar onde ficam o login e os dados).</p>
      <p>Falta preencher o arquivo <strong>firebase-config.js</strong> com os dados do projeto. Isso a gente faz juntos, passo a passo, no chat.</p>
    </div>
  </main>`;
}

function erroNoForm(form, texto) {
  const e = form.querySelector('[data-erro]');
  if (e) e.textContent = texto || '';
  const ok = form.querySelector('[data-ok]');
  if (ok) ok.textContent = '';
}
const travar = (form, sim) => form.querySelectorAll('button').forEach((b) => { b.disabled = sim; });

function redesenhar() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = (estado.uid && estado.perfil === null) ? htmlCompletar() : htmlEntrada();
  const alvo = app.querySelector('.codigo-grande, #f-nome');
  if (alvo && window.matchMedia('(min-width: 700px)').matches) alvo.focus();
}

export const acoesAuth = {
  'modo-entrada': (el) => {
    const campoEmail = document.getElementById('f-email');
    if (campoEmail) emailLembrado = campoEmail.value;
    modo = el.dataset.modo === 'criar' ? 'criar' : 'entrar';
    cad = novoCad();
    document.getElementById('app').innerHTML = htmlEntrada();
  },
  'cad-tipo': (el) => {
    const tipo = el.dataset.tipo;
    if (!TIPOS[tipo]) return;
    cad = { ...novoCad(), tipo, passo: tipo === 'com-personal' ? 'codigo' : 'conta' };
    redesenhar();
  },
  'cad-voltar': () => {
    const campoEmail = document.getElementById('f-email');
    if (campoEmail) emailLembrado = campoEmail.value;
    if (cad.passo === 'conta' && cad.tipo === 'com-personal') { cad.passo = 'codigo'; redesenhar(); return; }
    cad = novoCad();
    redesenhar();
  },
  'cad-trocar': () => { cad = novoCad(); redesenhar(); },
  'cad-termos': () => abrirTermos(),
  'cad-privacidade': () => abrirPrivacidade(),
  olho: (el) => {
    const entrada = el.closest('.fl').querySelector('input');
    const mostrar = entrada.type === 'password';
    entrada.type = mostrar ? 'text' : 'password';
    el.setAttribute('aria-pressed', String(mostrar));
    el.setAttribute('aria-label', mostrar ? 'Esconder senha' : 'Mostrar senha');
  },
  'esqueci-senha': async (el) => {
    const form = el.closest('form');
    const email = form.elements.email.value.trim();
    if (!email) return erroNoForm(form, 'Digite seu e-mail no campo acima e toque de novo.');
    erroNoForm(form, '');
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (e) {
      if (e && (e.code === 'auth/invalid-email' || e.code === 'auth/network-request-failed')) return erroNoForm(form, traduzir(e));
    }
    form.querySelector('[data-ok]').textContent = 'Se esse e-mail tiver conta, enviamos um link para criar a senha nova. Olhe também a caixa de spam.';
  },
  'google-entrar': async (el) => {
    const form = el.closest('form');
    erroNoForm(form, '');
    travar(form, true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      if (cad.tipo && cad.passo !== 'codigo') cad.passo = 'nome';
    } catch (e) {
      // Fechar a janelinha do Google não é erro: a pessoa só desistiu.
      if (e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request')) {
        // sem mensagem
      } else if (e && MENSAGENS[e.code]) {
        erroNoForm(form, traduzir(e));
      } else {
        erroNoForm(form, 'Não consegui entrar com o Google. Se você estiver no app instalado no iPhone, use e-mail e senha.');
      }
    } finally {
      travar(form, false);
    }
  }
};

export const formsAuth = {
  entrar: async (form) => {
    const email = form.elements.email.value.trim();
    const senha = form.elements.senha.value;
    if (!email || !senha) return erroNoForm(form, 'Preencha o e-mail e a senha.');
    erroNoForm(form, '');
    travar(form, true);
    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (e) {
      erroNoForm(form, traduzir(e));
      travar(form, false);
    }
  },
  // Etapa do código: confere se o código existe e mostra o nome do personal antes de criar a conta.
  codigo: async (form) => {
    const codigo = form.elements.codigo.value.trim().toUpperCase();
    if (!CODIGO_OK.test(codigo)) return erroNoForm(form, 'O código tem 8 letras e números (sem I, O, 0 e 1).');
    erroNoForm(form, '');
    travar(form, true);
    const r = await consultarConvite(codigo);
    travar(form, false);
    if (!r.ok) return erroNoForm(form, r.erro);
    cad.codigo = codigo;
    cad.personalNome = r.personalNome;
    cad.passo = (estado.uid && estado.perfil === null) ? 'nome' : 'conta';
    redesenhar();
  },
  criar: async (form) => {
    if (!cad.tipo) { redesenhar(); return; }
    const nome = form.elements.nome.value.trim();
    const email = form.elements.email.value.trim();
    const senha = form.elements.senha.value;
    const papel = papelDe(cad.tipo);
    if (nome.length < 2) return erroNoForm(form, 'Digite seu nome.');
    if (!email) return erroNoForm(form, 'Digite seu e-mail.');
    if (senha.length < 6) return erroNoForm(form, 'A senha precisa ter pelo menos 6 caracteres.');
    erroNoForm(form, '');
    travar(form, true);
    estado.criandoConta = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      salvarPerfil(cred.user.uid, { nome, papel, email, criadoEm: new Date().toISOString(), viuBoasVindas: false });
      await ligarAoPersonal(cred.user.uid, nome, email);
      cad = novoCad();
    } catch (e) {
      erroNoForm(form, traduzir(e));
      travar(form, false);
    } finally {
      estado.criandoConta = false;
    }
  },
  completar: async (form) => {
    if (!cad.tipo) { redesenhar(); return; }
    const nome = form.elements.nome.value.trim();
    if (nome.length < 2) return erroNoForm(form, 'Digite seu nome.');
    travar(form, true);
    const uid = estado.uid;
    salvarPerfil(uid, { nome, papel: papelDe(cad.tipo), email: estado.email, criadoEm: new Date().toISOString(), viuBoasVindas: false });
    await ligarAoPersonal(uid, nome, estado.email);
    cad = novoCad();
  }
};
