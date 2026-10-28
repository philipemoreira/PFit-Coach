// Telas de entrada: login, criar conta, completar cadastro e avisos iniciais.
import {
  auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
  GoogleAuthProvider, signInWithPopup
} from './firebase.js';
import { escaparHtml } from './util.js';
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

const escolhaPapel = (marcado = 'aluno') => `
  <fieldset class="escolha-papel">
    <legend class="rotulo">Como você vai usar o app?</legend>
    <label class="opcao-papel"><input type="radio" name="papel" value="aluno" ${marcado === 'aluno' ? 'checked' : ''}>
      <span class="papel-corpo"><strong>Aluno</strong><small>Quero treinar e acompanhar minha dieta.</small></span></label>
    <label class="opcao-papel"><input type="radio" name="papel" value="personal" ${marcado === 'personal' ? 'checked' : ''}>
      <span class="papel-corpo"><strong>Personal</strong><small>Vou montar treinos para alunos. A área do personal ainda está chegando.</small></span></label>
  </fieldset>`;

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
  const criar = modo === 'criar';
  return `
  <main class="entrada">
    ${painelMarca}
    <div class="entrada-caixa">
      <div class="logo-grande">${LOGO}</div>
      <h1>${criar ? 'Criar conta' : 'Bem-vindo'}</h1>
      <p class="sub">${criar ? 'Leva menos de um minuto.' : 'Entre para ver seu treino e sua dieta.'}</p>
      <div class="seg" role="tablist">
        <button type="button" role="tab" aria-selected="${!criar}" class="${!criar ? 'ativo' : ''}" data-acao="modo-entrada" data-modo="entrar">Entrar</button>
        <button type="button" role="tab" aria-selected="${criar}" class="${criar ? 'ativo' : ''}" data-acao="modo-entrada" data-modo="criar">Criar conta</button>
      </div>
      <form data-form="${criar ? 'criar' : 'entrar'}" id="form-entrada" novalidate>
        ${criar ? campo({ nome: 'nome', rotulo: 'Seu nome', icone: ICONE.nome, auto: 'name', extra: 'maxlength="60"' }) : ''}
        ${campo({ nome: 'email', rotulo: 'E-mail', tipo: 'email', icone: ICONE.email, auto: 'email', valor: emailLembrado, extra: 'inputmode="email" autocapitalize="off" spellcheck="false"' })}
        ${campo({ nome: 'senha', rotulo: 'Senha', tipo: 'password', icone: ICONE.senha, auto: criar ? 'new-password' : 'current-password' })}
        ${criar ? escolhaPapel() : ''}
        <p class="erro" role="alert" data-erro></p>
        <p class="aviso-ok" data-ok></p>
        <button class="btn cheio grande-btn" type="submit">${criar ? 'Criar minha conta' : 'Entrar'}</button>
        ${criar ? '' : '<button class="link centro" type="button" data-acao="esqueci-senha">Esqueci minha senha</button>'}
        <div class="ou"><span>ou</span></div>
        <button class="btn-google" type="button" data-acao="google-entrar">${GOOGLE}<span>Continuar com Google</span></button>
      </form>
    </div>
  </main>`;
}

export function htmlCompletar() {
  return `
  <main class="entrada">
    ${painelMarca}
    <div class="entrada-caixa">
      <h1>Falta pouco</h1>
      <p class="sub">Complete seu cadastro para começar.</p>
      <form data-form="completar" novalidate>
        ${campo({ nome: 'nome', rotulo: 'Seu nome', icone: ICONE.nome, auto: 'name', valor: estado.nomeSugerido || '', extra: 'maxlength="60"' })}
        ${escolhaPapel()}
        <p class="erro" role="alert" data-erro></p>
        <button class="btn cheio grande-btn" type="submit">Continuar</button>
        <button class="link centro" type="button" data-acao="sair-direto">Sair</button>
      </form>
    </div>
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

export const acoesAuth = {
  'modo-entrada': (el) => {
    const campoEmail = document.getElementById('f-email');
    if (campoEmail) emailLembrado = campoEmail.value;
    modo = el.dataset.modo === 'criar' ? 'criar' : 'entrar';
    document.getElementById('app').innerHTML = htmlEntrada();
  },
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
  criar: async (form) => {
    const nome = form.elements.nome.value.trim();
    const email = form.elements.email.value.trim();
    const senha = form.elements.senha.value;
    const papel = form.elements.papel.value === 'personal' ? 'personal' : 'aluno';
    if (nome.length < 2) return erroNoForm(form, 'Digite seu nome.');
    if (!email) return erroNoForm(form, 'Digite seu e-mail.');
    if (senha.length < 6) return erroNoForm(form, 'A senha precisa ter pelo menos 6 caracteres.');
    erroNoForm(form, '');
    travar(form, true);
    estado.criandoConta = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      salvarPerfil(cred.user.uid, { nome, papel, email, criadoEm: new Date().toISOString(), viuBoasVindas: false });
    } catch (e) {
      erroNoForm(form, traduzir(e));
      travar(form, false);
    } finally {
      estado.criandoConta = false;
    }
  },
  completar: async (form) => {
    const nome = form.elements.nome.value.trim();
    const papel = form.elements.papel.value === 'personal' ? 'personal' : 'aluno';
    if (nome.length < 2) return erroNoForm(form, 'Digite seu nome.');
    travar(form, true);
    salvarPerfil(estado.uid, { nome, papel, email: estado.email, criadoEm: new Date().toISOString(), viuBoasVindas: false });
  }
};
