// Várias contas no mesmo aparelho. Cada conta fica num "espaço" (slot) com a sua própria sessão do Firebase,
// então dá para trocar sem sair e sem digitar a senha de novo. O app só guarda e-mail e nome (nunca a senha).
import { slotAtual } from './firebase.js';
import { abrirFolha } from './folha.js';
import { escaparHtml, toast } from './util.js';

const CHAVE_SLOT = 'pfit_slot';
const CHAVE_LISTA = 'pfit_contas';
const CHAVE_VOLTAR = 'pfit_slot_voltar';
const SLOTS = ['principal', 's2', 's3', 's4'];
export const MAX_CONTAS = SLOTS.length;

const ler = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const gravar = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* sem armazenamento: só não lembra */ } };

export function lerContas() {
  try {
    const l = JSON.parse(ler(CHAVE_LISTA) || '[]');
    return Array.isArray(l) ? l.filter((c) => c && SLOTS.includes(c.slot)) : [];
  } catch (e) { return []; }
}
const salvarLista = (l) => gravar(CHAVE_LISTA, JSON.stringify(l));

// Chamado quando uma conta está logada: lembra e-mail e nome dela neste aparelho.
export function registrarConta({ email, nome }) {
  if (!email) return;
  const l = lerContas();
  const i = l.findIndex((c) => c.slot === slotAtual);
  const nova = { slot: slotAtual, email, nome: nome || (i >= 0 ? l[i].nome : '') || '' };
  if (i >= 0) { if (l[i].email === nova.email && l[i].nome === nova.nome) return; l[i] = nova; } else l.push(nova);
  salvarLista(l);
  gravar(CHAVE_VOLTAR, null); // login concluído: não precisa mais do "cancelar"
}

const recarregar = () => location.reload();

export function trocarPara(slot) {
  if (slot === slotAtual) return;
  gravar(CHAVE_SLOT, slot);
  recarregar();
}

// Abre a tela de login num espaço vazio para entrar com outra conta.
export function adicionarConta() {
  const usados = new Set(lerContas().map((c) => c.slot));
  usados.add(slotAtual);
  const livre = SLOTS.find((s) => !usados.has(s));
  if (!livre) { toast(`Você já tem ${MAX_CONTAS} contas neste aparelho.`); return; }
  gravar(CHAVE_VOLTAR, slotAtual);
  gravar(CHAVE_SLOT, livre);
  recarregar();
}

// Na tela de login de uma conta nova: desistir e voltar para a conta anterior.
export function cancelarAdicionar() {
  const volta = ler(CHAVE_VOLTAR) || lerContas()[0]?.slot || 'principal';
  gravar(CHAVE_VOLTAR, null);
  gravar(CHAVE_SLOT, volta);
  recarregar();
}
export const adicionandoConta = () => !lerContas().some((c) => c.slot === slotAtual) && !!ler(CHAVE_VOLTAR);

// Depois de sair de uma conta: esquece ela e abre outra que ainda esteja logada (se houver).
export function aposSair() {
  const resto = lerContas().filter((c) => c.slot !== slotAtual);
  salvarLista(resto);
  gravar(CHAVE_VOLTAR, null);
  const proximo = resto[0] ? resto[0].slot : 'principal';
  if (proximo !== slotAtual) { gravar(CHAVE_SLOT, proximo); recarregar(); }
}

// Este espaço não tem sessão (conta apagada ou sessão expirada): tira da lista. Devolve true se estava na lista.
export function esquecerSeSemSessao() {
  const l = lerContas();
  if (!l.some((c) => c.slot === slotAtual)) return false;
  salvarLista(l.filter((c) => c.slot !== slotAtual));
  return true;
}

export function abrirContas() {
  const lista = lerContas();
  if (!lista.some((c) => c.slot === slotAtual)) lista.unshift({ slot: slotAtual, email: '', nome: '' });
  const linha = (c) => {
    const atual = c.slot === slotAtual;
    const nome = c.nome || c.email || 'Conta';
    return `<button type="button" class="conta-troca ${atual ? 'atual' : ''}" data-slot="${escaparHtml(c.slot)}" ${atual ? 'aria-current="true"' : ''}>
      <span class="avatar peq" aria-hidden="true">${escaparHtml(nome.trim().charAt(0).toUpperCase())}</span>
      <span class="conta-troca-txt"><b>${escaparHtml(nome)}</b><small class="mudo">${escaparHtml(c.email)}</small></span>
      ${atual ? '<span class="selo">Atual</span>' : '<svg class="linha-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>'}
    </button>`;
  };
  const f = abrirFolha(`
    <h2>Trocar de conta</h2>
    <p class="mudo peq">As contas ficam salvas neste aparelho. Toque em uma para entrar nela, sem digitar a senha de novo.</p>
    <div class="linhas">${lista.map(linha).join('')}</div>
    ${lista.length < MAX_CONTAS ? '<button class="btn cheio" type="button" data-ed="adicionar">+ Adicionar outra conta</button>' : `<p class="mudo peq">Limite de ${MAX_CONTAS} contas neste aparelho.</p>`}
    <button class="btn secundario cheio" type="button" data-fechar>Fechar</button>`);
  f.el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-slot]');
    if (c) { trocarPara(c.dataset.slot); return; }
    if (e.target.closest('[data-ed="adicionar"]')) adicionarConta();
  });
}
