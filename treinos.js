// Aba Treinos: lista, criar, editar e excluir treinos.
import { estado } from './estado.js';
import { contar } from './conquistas-personal.js';
import { abrirFolha, confirmar, fecharTodasFolhas } from './folha.js';
import { escaparHtml, novoId, numero, DIAS_CURTOS, ORDEM_DIAS, toast } from './util.js';
import { salvarDoc, removerDoc } from './dados.js';
import { iniciarTreino } from './treinar.js';
import { abrirAnilhas } from './anilhas.js';
import { nav } from './nav.js';
import { lerVideo } from './video.js';
import { BASE, todosOsNomes, norm } from './exercicios-base.js';

function chipsDias(dias = []) {
  if (!dias.length) return '';
  const ord = ORDEM_DIAS.filter((d) => dias.includes(d));
  const hoje = new Date().getDay();
  return `<div class="chips dias-treino">${ord.map((d) => `<span class="chip dia-tag ${d === hoje ? 'hoje' : ''}">${DIAS_CURTOS[d]}</span>`).join('')}</div>`;
}

const comPersonal = () => !!estado.vinculo;

function cardTreino(t) {
  const exs = t.exercicios || [];
  const previa = exs.slice(0, 3).map((e) => escaparHtml(e.nome)).join(' · ');
  const eHoje = (t.dias || []).includes(new Date().getDay());
  return `
  <section class="card treino-card ${eHoje ? 'e-hoje' : ''}">
    <div class="card-topo">
      <div>
        <h2>${escaparHtml(t.nome)}</h2>
        <p class="mudo peq">${exs.length} exercício${exs.length === 1 ? '' : 's'}</p>
      </div>
      ${eHoje ? '<span class="selo">É hoje</span>' : ''}
    </div>
    ${chipsDias(t.dias) || '<p class="mudo peq">Sem dia marcado</p>'}
    ${previa ? `<p class="previa">${previa}${exs.length > 3 ? ' …' : ''}</p>` : ''}
 <div class="linha-botoes">
      ${comPersonal() ? '' : `<button class="btn secundario" type="button" data-acao="treino-editar" data-id="${escaparHtml(t.id)}">Editar</button>`}
      <button class="btn" type="button" data-acao="treino-iniciar" data-id="${escaparHtml(t.id)}">Iniciar</button>
    </div>
  </section>`;
}

const ICONE_LISTA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const ICONE_SETA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function blocoExercicio(ex = {}) {
  const v = (x) => (x === null || x === undefined ? '' : escaparHtml(x));
  return `
  <div class="ex-bloco ${ex.cardio ? 'cardio' : ''}" data-ex data-id="${escaparHtml(ex.id || novoId())}">
    <div class="ex-topo">
      <button type="button" class="alca" data-drag aria-label="Segure e arraste para mudar a ordem" title="Segure e arraste para mudar a ordem"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button>
      <div class="ex-nome">
        <input class="in" data-f="nome" placeholder="Nome do exercício" value="${v(ex.nome)}" maxlength="80" autocomplete="off">
        <button type="button" class="ex-pick" data-pick aria-label="Escolher da lista de exercícios" title="Escolher da lista">${ICONE_LISTA}</button>
      </div>
      <div class="ex-mover">
        <button type="button" data-mv="del" aria-label="Remover exercício" title="Remover">✕</button>
      </div>
    </div>
    <label class="cardio-opcao"><input type="checkbox" data-f="cardio" ${ex.cardio ? 'checked' : ''}> Cardio (por tempo, sem séries)</label>
    <div class="so-cardio"><label>Minutos<input class="in" data-f="minutos" inputmode="numeric" value="${v(ex.minutos)}"></label></div>
    <div class="grade4">
      <label>Séries<input class="in" data-f="series" inputmode="numeric" placeholder="3" value="${v(ex.series)}"></label>
      <label>Repetições<input class="in" data-f="reps" placeholder="8-12" value="${v(ex.reps)}" maxlength="12"></label>
      <label>Carga (kg)<input class="in" data-f="carga" inputmode="decimal" value="${v(ex.carga)}"></label>
      <label>Descanso (s)<input class="in" data-f="descanso" inputmode="numeric" placeholder="60" value="${v(ex.descanso)}"></label>
    </div>
    <details class="ex-mais" ${ex.obs || ex.video ? 'open' : ''}>
      <summary>Observação e vídeo (opcional)</summary>
      <input class="in" data-f="obs" placeholder="Observação (ex.: pegada fechada)" value="${v(ex.obs)}" maxlength="200">
      <input class="in so-forca" data-f="video" inputmode="url" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="Vídeo: link do YouTube ou videos/nome.mp4" value="${v(ex.video)}" maxlength="300">
    </details>
  </div>`;
}

// Janela para escolher o exercício: grupos que abrem um de cada vez (acordeão) + busca.
function abrirEscolha(aoEscolher, textoAtual = '', aoCancelar = null) {
  let escolheu = false;
  const meus = nomesJaUsados().filter((n) => !todosOsNomes().includes(n)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const grupos = Object.entries(BASE).map(([g, lista]) => [g, lista]);
  if (meus.length) grupos.push(['Meus exercícios', meus]);
  const item = (n) => `<button type="button" class="lib-item" data-nome="${escaparHtml(n)}">${escaparHtml(n)}</button>`;
  const f = abrirFolha(`
    <h2>Escolher exercício</h2>
    <input class="in lib-busca" type="search" data-busca placeholder="Buscar pelo nome…" autocomplete="off" value="">
    <div class="lib-grupos" data-grupos>
      ${grupos.map(([g, lista]) => `
      <section class="lib-grupo">
        <button type="button" class="lib-cab" data-grupo aria-expanded="false"><span class="lib-nome">${escaparHtml(g)}</span><span class="lib-n">${lista.length}</span>${ICONE_SETA}</button>
        <div class="lib-itens" hidden>${lista.map(item).join('')}</div>
      </section>`).join('')}
    </div>
    <div class="lib-res" data-res hidden></div>
    <p class="mudo peq lib-dica">Não achou o seu? Busque e toque em <b>Usar</b>, ou feche e digite o nome.</p>
    <div class="linha-botoes"><button class="btn secundario" type="button" data-fechar>Fechar</button></div>`, { classe: 'folha-alta folha-lib', aoFechar: () => { if (!escolheu && aoCancelar) aoCancelar(); } });
  const el = f.el;
  const busca = el.querySelector('[data-busca]');
  const gruposEl = el.querySelector('[data-grupos]');
  const res = el.querySelector('[data-res]');
  const todos = grupos.flatMap(([g, l]) => l.map((n) => ({ n, g })));

  busca.addEventListener('input', () => {
    const q = norm(busca.value);
    gruposEl.hidden = !!q;
    res.hidden = !q;
    if (!q) return;
    const achou = todos.filter((x) => norm(x.n).includes(q));
    res.innerHTML = (achou.length ? achou.map((x) => `<button type="button" class="lib-item" data-nome="${escaparHtml(x.n)}">${escaparHtml(x.n)}<small>${escaparHtml(x.g)}</small></button>`).join('') : '<p class="mudo peq">Nenhum exercício com esse nome.</p>')
      + `<button type="button" class="lib-item lib-usar" data-nome="${escaparHtml(busca.value.trim())}">Usar “${escaparHtml(busca.value.trim())}”</button>`;
  });
  el.addEventListener('click', (e) => {
    const cab = e.target.closest('[data-grupo]');
    if (cab) {
      const abrir = cab.getAttribute('aria-expanded') !== 'true';
      el.querySelectorAll('[data-grupo]').forEach((c) => { c.setAttribute('aria-expanded', 'false'); c.nextElementSibling.hidden = true; });
      if (abrir) {
        cab.setAttribute('aria-expanded', 'true');
        cab.nextElementSibling.hidden = false;
        cab.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
      return;
    }
    const it = e.target.closest('.lib-item');
    if (it && it.dataset.nome) { escolheu = true; aoEscolher(it.dataset.nome); f.fechar(); }
  });
  if (textoAtual) { busca.value = textoAtual; busca.dispatchEvent(new Event('input')); }
  return f;
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
  const exs = treino && (treino.exercicios || []).length ? treino.exercicios : [];
  const folha = abrirFolha(`
    <h2>${treino ? `Editar ${rotulo}` : `Novo ${rotulo}`}</h2>
    <section class="ed-card">
      <label class="ed-rot" for="ed-nome-treino">Nome do treino</label>
      <input class="in" id="ed-nome-treino" data-f="nome-treino" maxlength="60" placeholder="Ex.: Treino A" value="${treino ? escaparHtml(treino.nome) : ''}">
      <span class="ed-rot ed-rot2">Dias da semana <small>(opcional)</small></span>
      <div class="dias">
        ${ORDEM_DIAS.map((d) => `<button type="button" class="dia-chip" data-dia="${d}" aria-pressed="${treino && (treino.dias || []).includes(d) ? 'true' : 'false'}">${DIAS_CURTOS[d]}</button>`).join('')}
      </div>
      <p class="mudo peq">O treino marcado para o dia aparece na aba Hoje.</p>
    </section>
    <div class="ed-cab"><h3>Exercícios</h3><span class="mudo peq" data-cont></span></div>
    <p class="mudo peq ed-dica">Toque em <b>☰</b> para escolher da lista. Segure o <b>⠿</b> e arraste para mudar a ordem.</p>
    <div id="ex-lista">${exs.map(blocoExercicio).join('')}</div>
    <p class="mudo ed-vazio" data-vazio hidden>Nenhum exercício ainda. Toque em <b>+ Adicionar exercício</b> para escolher o primeiro da lista.</p>
    <div class="ed-add-linha">
      <button class="btn secundario" type="button" data-ed="add">+ Adicionar exercício</button>
      <button class="btn secundario" type="button" data-ed="continuar">Salvar e continuar</button>
    </div>
    <p class="erro" data-erro role="alert"></p>
    <div class="linha-botoes ed-rodape">
      ${treino ? '<button class="btn perigo-claro" type="button" data-ed="excluir">Excluir</button>' : '<button class="btn secundario" type="button" data-fechar>Cancelar</button>'}
      <button class="btn" type="button" data-ed="salvar">Salvar</button>
    </div>`, { classe: 'folha-alta' });

  const el = folha.el;
  // O id é criado uma vez só: assim "Salvar e continuar" não cria treinos repetidos.
  const idSalvo = treino ? treino.id : novoId();
  let jaContado = !!treino; // conquista do personal: conta só treino novo, uma vez
  const ordemInicial = treino ? treino.ordem : Date.now();
  const criadoInicial = treino ? treino.criadoEm : new Date().toISOString();
  const atualizarCont = () => { const n = el.querySelectorAll('[data-ex]').length; el.querySelector('[data-cont]').textContent = n ? `${n} ${n === 1 ? 'exercício' : 'exercícios'}` : ''; el.querySelector('[data-vazio]').hidden = n > 0; };
  atualizarCont();
  const escolher = (bloco, aoCancelar = null) => {
    const campo = bloco.querySelector('[data-f="nome"]');
    abrirEscolha((nome) => {
      campo.value = nome;
      // Escolheu do grupo Cardio: marca "Cardio" e vai direto para os minutos.
      if (BASE.Cardio.includes(nome)) {
        const chk = bloco.querySelector('[data-f="cardio"]');
        chk.checked = true;
        bloco.classList.add('cardio');
        const min = bloco.querySelector('[data-f="minutos"]');
        if (min && !min.value) min.focus();
        return;
      }
      const ser = bloco.querySelector('[data-f="series"]');
      if (ser && !ser.value && !bloco.classList.contains('cardio')) ser.focus();
    }, '', aoCancelar);
  };
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
    const pick = e.target.closest('[data-pick]');
    if (pick) { escolher(pick.closest('[data-ex]')); return; }
    const mv = e.target.closest('[data-mv]');
    if (mv) {
      const bloco = mv.closest('[data-ex]');
      if (mv.dataset.mv === 'del') { bloco.remove(); atualizarCont(); }
      return;
    }

    const b = e.target.closest('[data-ed]');
    if (!b) return;
    if (b.dataset.ed === 'add') {
      el.querySelector('#ex-lista').insertAdjacentHTML('beforeend', blocoExercicio());
      const blocos = el.querySelectorAll('[data-ex]');
      const novo = blocos[blocos.length - 1];
      atualizarCont();
      novo.scrollIntoView({ block: 'center', behavior: 'smooth' });
      // Fechou a lista sem escolher: não deixa um exercício sem nome sobrando.
      escolher(novo, () => { if (!novo.querySelector('[data-f="nome"]').value.trim()) { novo.remove(); atualizarCont(); } });
    } else if (b.dataset.ed === 'salvar' || b.dataset.ed === 'continuar') {
      const d = coletar(el);
      if (!d.nome) return erro('Dê um nome para o treino.');
      if (!d.exercicios.length) return erro('Adicione pelo menos um exercício.');
      const semMin = d.exercicios.find((x) => x.cardio && !(x.minutos >= 1));
      if (semMin) return erro(`Informe os minutos do cardio "${semMin.nome}".`);
      const videoRuim = d.exercicios.find((x) => x.video && !lerVideo(x.video));
      if (videoRuim) return erro(`Não reconheci o vídeo de "${videoRuim.nome}". Use um link https:// do YouTube ou de um arquivo .mp4, ou o caminho videos/nome.mp4.`);
      const semSeries = d.exercicios.find((x) => !x.cardio && !(x.series >= 1));
      if (semSeries) return erro(`Informe quantas séries tem em "${semSeries.nome}".`);
      salvarDoc(uidAlvo, colecao, idSalvo, {
        ...d,
        ordem: ordemInicial,
        criadoEm: criadoInicial,
        atualizadoEm: new Date().toISOString()
      });
      if (!jaContado) { jaContado = true; contar('treinos'); }
      toast(colecao === 'modelos' ? 'Modelo salvo.' : 'Treino salvo.');
      if (b.dataset.ed === 'salvar') { folha.fechar(); return; }
      // "Salvar e continuar": grava e deixa a janela aberta; os próximos salvamentos atualizam o mesmo treino.
      erro('');
      const cancelar = el.querySelector('.ed-rodape [data-fechar]');
      if (cancelar) cancelar.textContent = 'Fechar';
      b.textContent = 'Salvo ✓';
      setTimeout(() => { b.textContent = 'Salvar e continuar'; }, 1500);
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
    const hojeN = new Date().getDay();
    const lista = [...estado.treinos].sort((a, b) => Number((b.dias || []).includes(hojeN)) - Number((a.dias || []).includes(hojeN))).map(cardTreino).join('');
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
