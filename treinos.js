// Aba Treinos: lista, criar, editar e excluir treinos.
import { estado } from './estado.js';
import { abrirFolha, confirmar, fecharTodasFolhas } from './folha.js';
import { escaparHtml, novoId, numero, DIAS_CURTOS, ORDEM_DIAS, toast } from './util.js';
import { salvarDoc, removerDoc } from './dados.js';
import { iniciarTreino } from './treinar.js';
import { nav } from './nav.js';

function chipsDias(dias = []) {
  if (!dias.length) return '';
  const ord = ORDEM_DIAS.filter((d) => dias.includes(d));
  return `<div class="chips">${ord.map((d) => `<span class="chip">${DIAS_CURTOS[d]}</span>`).join('')}</div>`;
}

function cardTreino(t) {
  const exs = t.exercicios || [];
  const previa = exs.slice(0, 3).map((e) => escaparHtml(e.nome)).join(' · ');
  return `
  <section class="card">
    <div class="card-topo">
      <div>
        <h2>${escaparHtml(t.nome)}</h2>
        <p class="mudo peq">${exs.length} exercício${exs.length === 1 ? '' : 's'}</p>
      </div>
    </div>
    ${chipsDias(t.dias)}
    ${previa ? `<p class="previa">${previa}${exs.length > 3 ? ' …' : ''}</p>` : ''}
    <div class="linha-botoes">
      <button class="btn secundario" type="button" data-acao="treino-editar" data-id="${escaparHtml(t.id)}">Editar</button>
      <button class="btn" type="button" data-acao="treino-iniciar" data-id="${escaparHtml(t.id)}">Iniciar</button>
    </div>
  </section>`;
}

function blocoExercicio(ex = {}) {
  const v = (x) => (x === null || x === undefined ? '' : escaparHtml(x));
  return `
  <div class="ex-bloco" data-ex data-id="${escaparHtml(ex.id || novoId())}">
    <div class="ex-topo">
      <input class="in" data-f="nome" placeholder="Nome do exercício" list="lista-exercicios" value="${v(ex.nome)}" maxlength="80">
      <div class="ex-mover">
        <button type="button" data-mv="up" aria-label="Subir exercício">↑</button>
        <button type="button" data-mv="down" aria-label="Descer exercício">↓</button>
        <button type="button" data-mv="del" aria-label="Remover exercício">✕</button>
      </div>
    </div>
    <div class="grade4">
      <label>Séries<input class="in" data-f="series" inputmode="numeric" value="${v(ex.series)}"></label>
      <label>Repetições<input class="in" data-f="reps" placeholder="10 ou 8-12" value="${v(ex.reps)}" maxlength="12"></label>
      <label>Carga (kg)<input class="in" data-f="carga" inputmode="decimal" value="${v(ex.carga)}"></label>
      <label>Descanso (s)<input class="in" data-f="descanso" inputmode="numeric" value="${v(ex.descanso)}"></label>
    </div>
    <input class="in" data-f="obs" placeholder="Observação (opcional)" value="${v(ex.obs)}" maxlength="200">
  </div>`;
}

function nomesJaUsados() {
  const nomes = new Set();
  estado.treinos.forEach((t) => (t.exercicios || []).forEach((e) => e.nome && nomes.add(e.nome)));
  estado.sessoes.forEach((s) => (s.exercicios || []).forEach((e) => e.nome && nomes.add(e.nome)));
  return [...nomes];
}

function coletar(el) {
  const ler = (bloco, n) => bloco.querySelector(`[data-f="${n}"]`).value.trim();
  const nome = el.querySelector('[data-f="nome-treino"]').value.trim();
  const dias = [...el.querySelectorAll('.dia-chip[aria-pressed="true"]')].map((b) => Number(b.dataset.dia));
  const exercicios = [...el.querySelectorAll('[data-ex]')].map((b) => ({
    id: b.dataset.id,
    nome: ler(b, 'nome'),
    series: parseInt(ler(b, 'series'), 10),
    reps: ler(b, 'reps') || null,
    carga: numero(ler(b, 'carga')),
    descanso: parseInt(ler(b, 'descanso'), 10) || null,
    obs: ler(b, 'obs') || null
  })).filter((e) => e.nome);
  return { nome, dias, exercicios };
}

export function abrirEditorTreino(treino) {
  const exs = treino && (treino.exercicios || []).length ? treino.exercicios : [{}];
  const folha = abrirFolha(`
    <h2>${treino ? 'Editar treino' : 'Novo treino'}</h2>
    <label class="campo">Nome do treino
      <input class="in" data-f="nome-treino" maxlength="60" placeholder="Ex.: Treino A" value="${treino ? escaparHtml(treino.nome) : ''}">
    </label>
    <div class="campo">
      <span class="rotulo">Dias da semana (opcional)</span>
      <div class="dias">
        ${ORDEM_DIAS.map((d) => `<button type="button" class="dia-chip" data-dia="${d}" aria-pressed="${treino && (treino.dias || []).includes(d) ? 'true' : 'false'}">${DIAS_CURTOS[d]}</button>`).join('')}
      </div>
      <p class="mudo peq">Os treinos marcados para o dia aparecem na aba Hoje.</p>
    </div>
    <datalist id="lista-exercicios">${nomesJaUsados().map((n) => `<option value="${escaparHtml(n)}"></option>`).join('')}</datalist>
    <div id="ex-lista">${exs.map(blocoExercicio).join('')}</div>
    <button class="btn secundario cheio" type="button" data-ed="add">+ Adicionar exercício</button>
    <p class="erro" data-erro role="alert"></p>
    <div class="linha-botoes">
      ${treino ? '<button class="btn perigo-claro" type="button" data-ed="excluir">Excluir</button>' : '<button class="btn secundario" type="button" data-fechar>Cancelar</button>'}
      <button class="btn" type="button" data-ed="salvar">Salvar</button>
    </div>`, { classe: 'folha-alta' });

  const el = folha.el;
  const erro = (t) => { const e = el.querySelector('[data-erro]'); e.textContent = t; if (t) e.scrollIntoView({ block: 'center' }); };

  el.addEventListener('click', async (e) => {
    const dia = e.target.closest('.dia-chip');
    if (dia) { dia.setAttribute('aria-pressed', dia.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); return; }

    const mv = e.target.closest('[data-mv]');
    if (mv) {
      const bloco = mv.closest('[data-ex]');
      if (mv.dataset.mv === 'up' && bloco.previousElementSibling) bloco.parentNode.insertBefore(bloco, bloco.previousElementSibling);
      else if (mv.dataset.mv === 'down' && bloco.nextElementSibling) bloco.parentNode.insertBefore(bloco.nextElementSibling, bloco);
      else if (mv.dataset.mv === 'del') bloco.remove();
      return;
    }

    const b = e.target.closest('[data-ed]');
    if (!b) return;
    if (b.dataset.ed === 'add') {
      el.querySelector('#ex-lista').insertAdjacentHTML('beforeend', blocoExercicio());
      const blocos = el.querySelectorAll('[data-ex]');
      blocos[blocos.length - 1].querySelector('[data-f="nome"]').focus();
    } else if (b.dataset.ed === 'salvar') {
      const d = coletar(el);
      if (!d.nome) return erro('Dê um nome para o treino.');
      if (!d.exercicios.length) return erro('Adicione pelo menos um exercício.');
      const semSeries = d.exercicios.find((x) => !(x.series >= 1));
      if (semSeries) return erro(`Informe quantas séries tem em "${semSeries.nome}".`);
      salvarDoc(estado.uid, 'treinos', treino ? treino.id : novoId(), {
        ...d,
        ordem: treino ? treino.ordem : Date.now(),
        criadoEm: treino ? treino.criadoEm : new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      });
      folha.fechar();
      toast('Treino salvo.');
    } else if (b.dataset.ed === 'excluir') {
      if (await confirmar(`Excluir o treino "${treino.nome}"? Seu histórico de treinos feitos não é apagado.`, { ok: 'Excluir', perigo: true })) {
        removerDoc(estado.uid, 'treinos', treino.id);
        folha.fechar();
      }
    }
  });
}

export const treinos = {
  render() {
    const lista = estado.treinos.map(cardTreino).join('');
    return `
    <header class="topo"><h1>Treinos</h1><button class="btn pequeno" type="button" data-acao="treino-novo">+ Novo</button></header>
    ${lista ? `<div class="grade-cards">${lista}</div>` : `<div class="vazio">
      <p><strong>Você ainda não tem treinos.</strong></p>
      <p class="mudo">Crie o primeiro, por exemplo o Treino A, com os exercícios, séries e repetições.</p>
      <button class="btn" type="button" data-acao="treino-novo">Criar meu primeiro treino</button>
    </div>`}`;
  },
  acoes: {
    'treino-novo': () => {
      nav.irPara('treinos');
      abrirEditorTreino();
    },
    'treino-editar': (el) => {
      const t = estado.treinos.find((x) => x.id === el.dataset.id);
      if (t) abrirEditorTreino(t);
    },
    'treino-iniciar': (el) => {
      const t = estado.treinos.find((x) => x.id === el.dataset.id);
      if (!t) return;
      if (!(t.exercicios || []).length) return toast('Esse treino não tem exercícios.');
      fecharTodasFolhas();
      iniciarTreino(t);
    }
  }
};
