// Aba Treinos: lista, criar, editar e excluir treinos.
import { estado } from './estado.js';
import { abrirFolha, confirmar, fecharTodasFolhas } from './folha.js';
import { escaparHtml, novoId, numero, DIAS_CURTOS, ORDEM_DIAS, toast } from './util.js';
import { salvarDoc, removerDoc } from './dados.js';
import { iniciarTreino } from './treinar.js';
import { abrirAnilhas } from './anilhas.js';
import { nav } from './nav.js';
import { lerVideo } from './video.js';
import { todosOsNomes } from './exercicios-base.js';

function chipsDias(dias = []) {
  if (!dias.length) return '';
  const ord = ORDEM_DIAS.filter((d) => dias.includes(d));
  return `<div class="chips">${ord.map((d) => `<span class="chip">${DIAS_CURTOS[d]}</span>`).join('')}</div>`;
}

const comPersonal = () => !!estado.vinculo;

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
      ${comPersonal() ? '' : `<button class="btn secundario" type="button" data-acao="treino-editar" data-id="${escaparHtml(t.id)}">Editar</button>`}
      <button class="btn" type="button" data-acao="treino-iniciar" data-id="${escaparHtml(t.id)}">Iniciar</button>
    </div>
  </section>`;
}

function blocoExercicio(ex = {}) {
  const v = (x) => (x === null || x === undefined ? '' : escaparHtml(x));
  return `
  <div class="ex-bloco ${ex.cardio ? 'cardio' : ''}" data-ex data-id="${escaparHtml(ex.id || novoId())}">
    <div class="ex-topo">
      <button type="button" class="alca" data-drag aria-label="Segure e arraste para mudar a ordem" title="Segure e arraste para mudar a ordem"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button>
      <input class="in" data-f="nome" placeholder="Nome do exercício" list="lista-exercicios" value="${v(ex.nome)}" maxlength="80">
      <div class="ex-mover">
        <button type="button" data-mv="del" aria-label="Remover exercício" title="Remover">✕</button>
      </div>
    </div>
    <label class="cardio-opcao"><input type="checkbox" data-f="cardio" ${ex.cardio ? 'checked' : ''}> Cardio (por tempo, sem séries)</label>
    <div class="so-cardio"><label>Minutos<input class="in" data-f="minutos" inputmode="numeric" value="${v(ex.minutos)}"></label></div>
    <div class="grade4">
      <label>Séries<input class="in" data-f="series" inputmode="numeric" value="${v(ex.series)}"></label>
      <label>Repetições<input class="in" data-f="reps" placeholder="10 ou 8-12" value="${v(ex.reps)}" maxlength="12"></label>
      <label>Carga (kg)<input class="in" data-f="carga" inputmode="decimal" value="${v(ex.carga)}"></label>
      <label>Descanso (s)<input class="in" data-f="descanso" inputmode="numeric" value="${v(ex.descanso)}"></label>
    </div>
    <input class="in" data-f="obs" placeholder="Observação (opcional)" value="${v(ex.obs)}" maxlength="200">
    <input class="in so-forca" data-f="video" type="url" inputmode="url" placeholder="Link do vídeo do exercício (opcional, começa com https://)" value="${v(ex.video)}" maxlength="300">
  </div>`;
}

function nomesJaUsados() {
  const nomes = new Set();
  estado.treinos.forEach((t) => (t.exercicios || []).forEach((e) => e.nome && nomes.add(e.nome)));
  estado.sessoes.forEach((s) => (s.exercicios || []).forEach((e) => e.nome && nomes.add(e.nome)));
  todosOsNomes().forEach((n) => nomes.add(n));
  return [...nomes];
}

function coletar(el) {
  const ler = (bloco, n) => bloco.querySelector(`[data-f="${n}"]`).value.trim();
  const nome = el.querySelector('[data-f="nome-treino"]').value.trim();
  const dias = [...el.querySelectorAll('.dia-chip[aria-pressed="true"]')].map((b) => Number(b.dataset.dia));
  const exercicios = [...el.querySelectorAll('[data-ex]')].map((b) => {
    if (b.querySelector('[data-f="cardio"]').checked) {
      return { id: b.dataset.id, nome: ler(b, 'nome'), cardio: true, minutos: parseInt(ler(b, 'minutos'), 10) || null, series: 1, obs: ler(b, 'obs') || null };
    }
    return {
      id: b.dataset.id,
      nome: ler(b, 'nome'),
      series: parseInt(ler(b, 'series'), 10),
      reps: ler(b, 'reps') || null,
      carga: numero(ler(b, 'carga')),
      descanso: parseInt(ler(b, 'descanso'), 10) || null,
      obs: ler(b, 'obs') || null,
      video: ler(b, 'video') || null
    };
  }).filter((e) => e.nome);
  return { nome, dias, exercicios };
}

// opcoes.uid: de quem é o treino (o personal edita o treino do aluno); opcoes.colecao: 'treinos' ou 'modelos'.
export function abrirEditorTreino(treino, opcoes = {}) {
  const uidAlvo = opcoes.uid || estado.uid;
  const colecao = opcoes.colecao || 'treinos';
  const rotulo = colecao === 'modelos' ? 'modelo' : 'treino';
  const exs = treino && (treino.exercicios || []).length ? treino.exercicios : [{}];
  const folha = abrirFolha(`
    <h2>${treino ? `Editar ${rotulo}` : `Novo ${rotulo}`}</h2>
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
    <p class="mudo peq">Para mudar a ordem, <b>segure o ⠿</b> de um exercício e arraste. O <b>✕</b> remove.</p>
    <div id="ex-lista">${exs.map(blocoExercicio).join('')}</div>
    <button class="btn secundario cheio" type="button" data-ed="add">+ Adicionar exercício</button>
    <p class="erro" data-erro role="alert"></p>
    <div class="linha-botoes">
      ${treino ? '<button class="btn perigo-claro" type="button" data-ed="excluir">Excluir</button>' : '<button class="btn secundario" type="button" data-fechar>Cancelar</button>'}
      <button class="btn" type="button" data-ed="salvar">Salvar</button>
    </div>`, { classe: 'folha-alta' });

  const el = folha.el;
  const erro = (t) => { const e = el.querySelector('[data-erro]'); e.textContent = t; if (t) e.scrollIntoView({ block: 'center' }); };

  // Segurar a alça (⠿) e arrastar muda a ordem dos exercícios.
  el.addEventListener('pointerdown', (e) => {
    const alca = e.target.closest('[data-drag]');
    if (!alca || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const bloco = alca.closest('[data-ex]');
    const lista = bloco.parentNode;
    const rolagem = el.closest('.folha') || el;
    let y = e.clientY;
    bloco.classList.add('arrastando');
    lista.classList.add('ordenando'); // os blocos encolhem para caber vários na tela
    const mover = (ev) => {
      y = ev.clientY;
      const outros = [...lista.querySelectorAll('[data-ex]')].filter((b) => b !== bloco);
      const antes = outros.find((b) => { const r = b.getBoundingClientRect(); return y < r.top + r.height / 2; });
      if (antes) { if (bloco.nextElementSibling !== antes) lista.insertBefore(bloco, antes); } else if (lista.lastElementChild !== bloco) lista.appendChild(bloco);
    };
    // Perto da borda de cima ou de baixo, a janela rola sozinha.
    const rolar = setInterval(() => {
      const r = rolagem.getBoundingClientRect();
      if (y < r.top + 70) rolagem.scrollTop -= 12; else if (y > r.bottom - 70) rolagem.scrollTop += 12;
    }, 16);
    const soltar = () => {
      clearInterval(rolar);
      bloco.classList.remove('arrastando');
      lista.classList.remove('ordenando');
      document.removeEventListener('pointermove', mover);
      document.removeEventListener('pointerup', soltar);
      document.removeEventListener('pointercancel', soltar);
    };
    document.addEventListener('pointermove', mover);
    document.addEventListener('pointerup', soltar);
    document.addEventListener('pointercancel', soltar);
  });

  el.addEventListener('click', async (e) => {
    const dia = e.target.closest('.dia-chip');
    if (dia) { dia.setAttribute('aria-pressed', dia.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); return; }

    if (e.target.matches('[data-f="cardio"]')) { e.target.closest('[data-ex]').classList.toggle('cardio', e.target.checked); return; }
    const mv = e.target.closest('[data-mv]');
    if (mv) {
      const bloco = mv.closest('[data-ex]');
      if (mv.dataset.mv === 'del') bloco.remove();
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
      const semMin = d.exercicios.find((x) => x.cardio && !(x.minutos >= 1));
      if (semMin) return erro(`Informe os minutos do cardio "${semMin.nome}".`);
      const videoRuim = d.exercicios.find((x) => x.video && !lerVideo(x.video));
      if (videoRuim) return erro(`O link do vídeo de "${videoRuim.nome}" precisa começar com https://`);
      const semSeries = d.exercicios.find((x) => !x.cardio && !(x.series >= 1));
      if (semSeries) return erro(`Informe quantas séries tem em "${semSeries.nome}".`);
      salvarDoc(uidAlvo, colecao, treino ? treino.id : novoId(), {
        ...d,
        ordem: treino ? treino.ordem : Date.now(),
        criadoEm: treino ? treino.criadoEm : new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      });
      folha.fechar();
      toast(colecao === 'modelos' ? 'Modelo salvo.' : 'Treino salvo.');
    } else if (b.dataset.ed === 'excluir') {
      if (await confirmar(`Excluir o treino "${treino.nome}"? Seu histórico de treinos feitos não é apagado.`, { ok: 'Excluir', perigo: true })) {
        removerDoc(uidAlvo, colecao, treino.id);
        folha.fechar();
      }
    }
  });
}

export const treinos = {
  render() {
    const lista = estado.treinos.map(cardTreino).join('');
    const nomePersonal = estado.vinculo ? escaparHtml(estado.vinculo.personalNome || 'seu personal') : '';
    return `
    <header class="topo"><h1>Treinos</h1><div class="topo-acoes"><button class="btn pequeno secundario" type="button" data-acao="anilhas-abrir">Anilhas</button>${comPersonal() ? '' : '<button class="btn pequeno" type="button" data-acao="treino-novo">+ Novo</button>'}</div></header>
    ${comPersonal() ? `<p class="faixa-personal">Seus treinos são montados por <strong>${nomePersonal}</strong>. Aqui você só treina e anota.</p>` : ''}
    ${lista ? `<div class="grade-cards">${lista}</div>` : comPersonal() ? `<div class="vazio"><p><strong>Seu personal ainda não montou seu treino.</strong></p><p class="mudo">Assim que ele montar, aparece aqui.</p></div>` : `<div class="vazio">
      <p><strong>Você ainda não tem treinos.</strong></p>
      <p class="mudo">Crie o primeiro, por exemplo o Treino A, com os exercícios, séries e repetições.</p>
      <button class="btn" type="button" data-acao="treino-novo">Criar meu primeiro treino</button>
    </div>`}`;
  },
  acoes: {
    'anilhas-abrir': () => abrirAnilhas(null),
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
