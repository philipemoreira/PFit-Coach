// Telas de entrada: login, criar conta, completar cadastro e avisos iniciais.
import {
  auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail
} from './firebase.js';
import { escaparHtml } from './util.js';
import { estado } from './estado.js';
import { salvarPerfil } from './dados.js';

let modo = 'entrar'; // 'entrar' ou 'criar'

const LOGO = `<svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="110" fill="#181b22"/><g fill="#c6f432"><rect x="196" y="236" width="120" height="40" rx="8"/><rect x="150" y="176" width="46" height="160" rx="14"/><rect x="316" y="176" width="46" height="160" rx="14"/><rect x="108" y="206" width="34" height="100" rx="12"/><rect x="370" y="206" width="34" height="100" rx="12"/></g></svg>`;

const MENSAGENS = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'Esse e-mail não parece válido.',
  'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Toque em "Entrar".',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Espere um pouco e tente de novo.',
  'auth/network-request-failed': 'Sem internet. Confira a conexão e tente de novo.'
};
const traduzir = (e) => MENSAGENS[e && e.code] || 'Não deu certo. Tente de novo em instantes.';

const escolhaPapel = (marcado = 'aluno') => `
  <fieldset class="campo escolha-papel">
    <legend class="rotulo">Como você vai usar o app?</legend>
    <label class="opcao-papel"><input type="radio" name="papel" value="aluno" ${marcado === 'aluno' ? 'checked' : ''}>
      <span><strong>Aluno</strong><small>Quero treinar e acompanhar minha dieta.</small></span></label>
    <label class="opcao-papel"><input type="radio" name="papel" value="personal" ${marcado === 'personal' ? 'checked' : ''}>
      <span><strong>Personal</strong><small>Vou montar treinos para alunos. A área do personal ainda está chegando.</small></span></label>
  </fieldset>`;

export function htmlEntrada() {
  const criar = modo === 'criar';
  return `
  <main class="entrada">
    <div class="entrada-caixa">
      <div class="logo-grande">${LOGO}</div>
      <h1>Treino</h1>
      <p class="sub">Seu treino e sua dieta, num lugar só.</p>
      <div class="seg" role="tablist">
        <button type="button" role="tab" aria-selected="${!criar}" class="${!criar ? 'ativo' : ''}" data-acao="modo-entrada" data-modo="entrar">Entrar</button>
        <button type="button" role="tab" aria-selected="${criar}" class="${criar ? 'ativo' : ''}" data-acao="modo-entrada" data-modo="criar">Criar conta</button>
      </div>
      <form data-form="${criar ? 'criar' : 'entrar'}" id="form-entrada" novalidate>
        ${criar ? `<label class="campo">Seu nome<input class="in" name="nome" autocomplete="name" maxlength="60"></label>` : ''}
        <label class="campo">E-mail<input class="in" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off"></label>
        <label class="campo">Senha<input class="in" name="senha" type="password" autocomplete="${criar ? 'new-password' : 'current-password'}"></label>
        ${criar ? escolhaPapel() : ''}
        <p class="erro" role="alert" data-erro></p>
        <p class="aviso-ok" data-ok></p>
        <button class="btn cheio" type="submit">${criar ? 'Criar minha conta' : 'Entrar'}</button>
        ${criar ? '' : '<button class="link centro" type="button" data-acao="esqueci-senha">Esqueci minha senha</button>'}
      </form>
    </div>
  </main>`;
}

export function htmlCompletar() {
  return `
  <main class="entrada">
    <div class="entrada-caixa">
      <h1>Falta pouco</h1>
      <p class="sub">Complete seu cadastro para começar.</p>
      <form data-form="completar" novalidate>
        <label class="campo">Seu nome<input class="in" name="nome" autocomplete="name" maxlength="60"></label>
        ${escolhaPapel()}
        <p class="erro" role="alert" data-erro></p>
        <button class="btn cheio" type="submit">Continuar</button>
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
    modo = el.dataset.modo === 'criar' ? 'criar' : 'entrar';
    document.getElementById('app').innerHTML = htmlEntrada();
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
      salvarPerfil(cred.user.uid, { nome, papel, email, criadoEm: new Date().toISOString() });
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
    salvarPerfil(estado.uid, { nome, papel, email: estado.email, criadoEm: new Date().toISOString() });
  }
};

export { escaparHtml };
