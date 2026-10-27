// Aba Hoje: semana, treino do dia, dieta de hoje.
import { estado } from './estado.js';
import { abrirFolha, confirmar } from './folha.js';
import { escaparHtml, dataLocal, formatarDataLonga, segundaDaSemana } from './util.js';
import { salvarDoc } from './dados.js';
import { rascunhoSalvo, retomarTreino, descartarRascunho } from './treinar.js';
import { regrasDoDia } from './dieta.js';
import { nav } from './nav.js';

const LETRAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']; // segunda a domingo

function marcadasHoje() {
  const c = estado.checks.find((x) => x.data === dataLocal());
  return (c && c.feitas) || {};
}

function blocoRascunho() {
  const r = rascunhoSalvo();
  if (!r) return '';
  return `
  <section class="card destaque">
    <h2>Treino em andamento</h2>
    <p class="mudo">${escaparHtml(r.treinoNome)} — você começou e não finalizou.</p>
    <div class="linha-botoes">
      <button class="btn perigo-claro" type="button" data-acao="rascunho-descartar">Descartar</button>
      <button class="btn" type="button" data-acao="rascunho-continuar">Continuar</button>
    </div>
  </section>`;
}

// Faixa com os 7 dias da semana: os dias em que você treinou ficam acesos.
function faixaSemana() {
  const segunda = segundaDaSemana();
  const hojeStr = dataLocal();
  const dias = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(segunda);
    d.setDate(segunda.getDate() + i);
    const str = dataLocal(d);
    const treinou = estado.sessoes.some((s) => s.data === str);
    dias.push(`<div class="dia ${treinou ? 'on' : ''} ${str === hojeStr ? 'hoje' : ''}"><i aria-hidden="true">${treinou ? '✔' : ''}</i><span>${LETRAS[i]}</span></div>`);
  }
  return `<section class="faixa-semana" aria-label="Seus treinos nesta semana">${dias.join('')}</section>`;
}

function blocoHero() {
  const hoje = new Date();
  const dataStr = dataLocal(hoje);
  const doDia = estado.treinos.filter((t) => (t.dias || []).includes(hoje.getDay()));
  const feitos = new Set(estado.sessoes.filter((s) => s.data === dataStr).map((s) => s.treinoId));

  if (!estado.treinos.length) {
    return `
    <article class="hero-treino">
      <span class="rotulo-hero">Treino de hoje</span>
      <h2>Vamos começar?</h2>
      <p>Você ainda não criou nenhum treino.</p>
      <button class="btn escuro cheio" type="button" data-acao="treino-novo">Criar meu primeiro treino</button>
    </article>`;
  }

  const itens = doDia.map((t) => `
    <div class="treino-dia">
      <div>
        <strong>${escaparHtml(t.nome)}</strong>
        <p>${(t.exercicios || []).length} exercícios${feitos.has(t.id) ? ' · <span class="ok-txt">feito hoje ✔</span>' : ''}</p>
      </div>
      <button class="btn pequeno escuro" type="button" data-acao="treino-iniciar" data-id="${escaparHtml(t.id)}">${feitos.has(t.id) ? 'Repetir' : 'Iniciar'}</button>
    </div>`).join('');

  return `
  <article class="hero-treino">
    <span class="rotulo-hero">Treino de hoje</span>
    ${itens || '<h2>Dia livre</h2><p>Nenhum treino marcado para hoje.</p>'}
    <button class="link" type="button" data-acao="treino-outro">${doDia.length ? 'Treinar outro treino' : 'Escolher um treino para fazer agora'}</button>
  </article>`;
}

function blocoTiles() {
  const regras = regrasDoDia();
  const marcadas = marcadasHoje();
  const feitas = regras.filter((r) => marcadas[r.id]).length;
  const pct = regras.length ? feitas / regras.length : 0;
  const CIRC = 2 * Math.PI * 37;
  const semana = dataLocal(segundaDaSemana());
  const treinosSemana = estado.sessoes.filter((s) => s.data >= semana).length;
  return `
  <article class="tile">
    <div class="anel" role="img" aria-label="Dieta de hoje: ${feitas} de ${regras.length} regras">
      <svg viewBox="0 0 92 92"><circle class="fundo" cx="46" cy="46" r="37"/><circle class="valor" cx="46" cy="46" r="37" stroke-dasharray="${(pct * CIRC).toFixed(1)} ${CIRC.toFixed(1)}"/></svg>
      <b>${feitas}/${regras.length}</b>
    </div>
    <span class="rotulo">Dieta de hoje</span>
  </article>
  <article class="tile">
    <span class="numero">${treinosSemana}</span>
    <span class="rotulo">treino${treinosSemana === 1 ? '' : 's'} na semana</span>
  </article>`;
}

function blocoChecklist() {
  const regras = regrasDoDia();
  if (!regras.length) {
    return `
    <section class="card">
      <h2>Dieta de hoje</h2>
      <p class="mudo">Você ainda não cadastrou regras para hoje.</p>
      <button class="btn secundario cheio" type="button" data-acao="regra-nova" data-grupo="sempre">Cadastrar regras</button>
    </section>`;
  }
  const marcadas = marcadasHoje();
  return `
  <section class="card">
    <h2>Regras de hoje</h2>
    <div class="lista">
      ${regras.map((r) => {
        const on = !!marcadas[r.id];
        return `<button type="button" class="regra-item ${on ? 'feita' : ''}" role="checkbox" aria-checked="${on}" data-acao="regra-marcar" data-id="${escaparHtml(r.id)}">
          <span class="caixa">${on ? '✔' : ''}</span>
          <span class="regra-txt">${r.horario ? `<small class="hora">${escaparHtml(r.horario)}</small>` : ''}${escaparHtml(r.texto)}</span>
        </button>`;
      }).join('')}
    </div>
  </section>`;
}

export const hoje = {
  render() {
    const nome = ((estado.perfil && estado.perfil.nome) || '').split(' ')[0];
    return `
    <header class="hoje-topo">
      <p class="mudo">${formatarDataLonga()}</p>
      <h1>Olá${nome ? ', ' + escaparHtml(nome) : ''}</h1>
    </header>
    ${blocoRascunho()}
    ${faixaSemana()}
    <section class="bento">
      ${blocoHero()}
      ${blocoTiles()}
    </section>
    ${blocoChecklist()}`;
  },
  acoes: {
    'regra-marcar': (el) => {
      const id = el.dataset.id;
      const data = dataLocal();
      const atual = !!marcadasHoje()[id];
      salvarDoc(estado.uid, 'checks', data, { data, feitas: { [id]: !atual } }, { merge: true });
    },
    'treino-outro': () => {
      if (!estado.treinos.length) return;
      abrirFolha(`
        <h2>Qual treino?</h2>
        <div class="lista">
          ${estado.treinos.map((t) => `<button type="button" class="regra-linha" data-acao="treino-iniciar" data-id="${escaparHtml(t.id)}"><span>${escaparHtml(t.nome)}</span><span class="seta" aria-hidden="true">›</span></button>`).join('')}
        </div>
        <button class="btn secundario cheio" type="button" data-fechar>Cancelar</button>`);
    },
    'rascunho-continuar': () => retomarTreino(),
    'rascunho-descartar': async () => {
      if (await confirmar('Descartar o treino que ficou em andamento? O que foi marcado vai ser perdido.', { ok: 'Descartar', perigo: true })) {
        descartarRascunho();
        nav.renderizar();
      }
    }
  }
};
