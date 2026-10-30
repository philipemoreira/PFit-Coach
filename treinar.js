// Tela de treino em andamento: marcar séries, cronômetro de descanso e salvar o treino feito.
import { estado } from './estado.js';
import { confirmar } from './folha.js';
import { escaparHtml, dataLocal, novoId, numero, formatarNumero, formatarDataCurta, formatarDuracao, toast } from './util.js';
import { salvarDoc } from './dados.js';
import { abrirFolha } from './folha.js';
import { volumeDasSeries, maiorCargaAntes, formatarVolume } from './metricas.js';
import { abrirAnilhas } from './anilhas.js';
import { nav } from './nav.js';
import { dicaDoExercicio } from './dicas.js';
import { lerVideo, urlEmbed, urlVimeo, urlMiniatura, urlBuscaGoogle } from './video.js';

let S = null; // treino em andamento
let raiz = null;
let timerRelogio = null;
let timerDescanso = null;
let descansoFim = 0;
let descansoTotal = 0;
let audioCtx = null;
let travaTela = null;

const norm = (s) => String(s || '').trim().toLowerCase();
const chave = () => `treino-rascunho-${estado.uid}`;

// O iPhone fecha o app sozinho às vezes: por isso o treino em andamento fica guardado no aparelho.
export function rascunhoSalvo() {
  try {
    const t = localStorage.getItem(chave());
    return t ? JSON.parse(t) : null;
  } catch { return null; }
}
function guardar() { try { localStorage.setItem(chave(), JSON.stringify(S)); } catch { /* sem espaço: segue sem guardar */ } }
export function descartarRascunho() { try { localStorage.removeItem(chave()); } catch { /* ok */ } }
export const treinoAberto = () => S !== null;

function ultimaVez(nome) {
  const k = norm(nome);
  const ordenadas = [...estado.sessoes].sort((a, b) => String(b.fim || b.data).localeCompare(String(a.fim || a.data)));
  for (const s of ordenadas) {
    const ex = (s.exercicios || []).find((e) => norm(e.nome) === k && !e.cardio && (e.series || []).some((x) => x.feito && x.tipo !== 'aq'));
    if (ex) return { data: s.data, series: ex.series.filter((x) => x.feito && x.tipo !== 'aq').map((x) => ({ carga: x.carga, reps: x.reps })) };
  }
  return null;
}

// Aquecimento da última vez (carga e reps da primeira série de aquecimento feita nesse exercício).
function ultimoAquecimento(nome) {
  const k = norm(nome);
  const ordenadas = [...estado.sessoes].sort((a, b) => String(b.fim || b.data).localeCompare(String(a.fim || a.data)));
  for (const s of ordenadas) {
    const ex = (s.exercicios || []).find((e) => norm(e.nome) === k && !e.cardio);
    const aq = ex && (ex.series || []).find((x) => x.feito && x.tipo === 'aq');
    if (aq) return { carga: aq.carga, reps: aq.reps };
  }
  return null;
}

function ultimoCardio(nome) {
  const k = norm(nome);
  const ordenadas = [...estado.sessoes].sort((a, b) => String(b.fim || b.data).localeCompare(String(a.fim || a.data)));
  for (const s of ordenadas) {
    const ex = (s.exercicios || []).find((e) => norm(e.nome) === k && e.cardio && e.feito && e.minutos);
    if (ex) return { data: s.data, minutos: ex.minutos };
  }
  return null;
}

export function iniciarTreino(treino) {
  if (S) { toast('Você já tem um treino aberto.'); return; }
  S = {
    treinoId: treino.id,
    treinoNome: treino.nome,
    inicio: Date.now(),
    atual: 0,
    nota: '',
    exercicios: (treino.exercicios || []).map((ex, idx, todos) => {
      if (ex.cardio) {
        const uc = ultimoCardio(ex.nome);
        return { nome: ex.nome, cardio: true, video: '', obs: ex.obs || '', descanso: 0, planoMin: ex.minutos || null, ultimaMin: uc, minutos: String(ex.minutos || (uc ? uc.minutos : '') || ''), feito: false, series: [] };
      }
      const ult = ultimaVez(ex.nome);
      const n = Math.max(1, ex.series || 1);
      const series = [];
      for (let i = 0; i < n; i++) {
        const ref = ult ? (ult.series[i] || ult.series[ult.series.length - 1]) : null;
        series.push({
          // Número com vírgula, como se escreve no Brasil (42,5).
          carga: ref && ref.carga != null ? String(ref.carga).replace('.', ',') : (ex.carga != null ? String(ex.carga).replace('.', ',') : ''),
          reps: ref && ref.reps != null ? String(ref.reps) : (/^\d+$/.test(String(ex.reps || '')) ? String(ex.reps) : ''),
          feito: false
        });
      }
      // O primeiro exercício de força de todo treino começa com uma série de aquecimento (a mais, não conta no volume nem nos recordes).
      const aquecer = idx === todos.findIndex((e) => !e.cardio);
      const ua = aquecer ? ultimoAquecimento(ex.nome) : null;
      if (aquecer) series.unshift({ tipo: 'aq', carga: ua && ua.carga != null ? String(ua.carga).replace('.', ',') : '', reps: ua && ua.reps != null ? String(ua.reps) : '', feito: false });
      return { nome: ex.nome, aquecer, ultimaAq: ua, maxAnt: maiorCargaAntes(ex.nome), video: ex.video || '', obs: ex.obs || '', descanso: ex.descanso || 0, planoSeries: n, planoReps: ex.reps || '', planoCarga: ex.carga ?? null, ultima: ult, series };
    })
  };
  guardar();
  abrir();
}

export function retomarTreino() {
  const r = rascunhoSalvo();
  if (!r || S) return;
  S = r;
  if (!Number.isInteger(S.atual) || S.atual < 0 || S.atual > S.exercicios.length) S.atual = 0;
  abrir();
}

function abrir() {
  document.body.classList.add('sem-rolagem');
  raiz = document.createElement('div');
  raiz.className = 'treinar';
  raiz.innerHTML = '<div class="treinar-conteudo" id="treinar-conteudo"></div><div class="descanso" id="descanso" hidden></div>';
  document.body.appendChild(raiz);
  desenhar();
  raiz.addEventListener('click', aoClicar);
  raiz.addEventListener('input', aoDigitar);
  // Ao tocar num campo de número, o valor já vem selecionado: é só digitar por cima.
  raiz.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t && t.dataset && (t.dataset.t === 'carga' || t.dataset.t === 'reps')) setTimeout(() => { try { t.select(); } catch { /* ok */ } }, 0);
  });
  // Tecla Enter/Ok: no kg vai para as reps; nas reps fecha o teclado. A série só é marcada ao tocar no check.
  raiz.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key !== 'Enter' || !t || !t.dataset) return;
    if (t.dataset.t === 'carga') { e.preventDefault(); const r = raiz.querySelector(`[data-t="reps"][data-e="${t.dataset.e}"][data-s="${t.dataset.s}"]`); if (r) r.focus(); }
    else if (t.dataset.t === 'reps') { e.preventDefault(); t.blur(); }
  });
  // Deslizar para o lado troca de exercício (fora dos campos de número).
  let x0 = null; let y0 = null;
  raiz.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    x0 = e.target.closest('input, textarea, iframe, .pontos') ? null : t.clientX; y0 = t.clientY;
  }, { passive: true });
  raiz.addEventListener('touchend', (e) => {
    if (x0 === null || !S) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0; const dy = t.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 2) irPara(S.atual + (dx < 0 ? 1 : -1));
  }, { passive: true });
  raiz.addEventListener('keydown', (e) => {
    if (!S || e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') irPara(S.atual + 1); else if (e.key === 'ArrowLeft') irPara(S.atual - 1);
  });
  timerRelogio = setInterval(atualizarRelogio, 1000);
  pedirTelaLigada();
}

function textoPlano(ex) {
  const p = [`${ex.planoSeries} série${ex.planoSeries === 1 ? '' : 's'}`];
  if (ex.planoReps) p.push(`${ex.planoReps} reps`);
  if (ex.planoCarga != null) p.push(`${formatarNumero(ex.planoCarga)} kg`);
  if (ex.descanso) p.push(`descanso ${ex.descanso}s`);
  return p.join(' · ');
}

const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const TIPOS = [
  [undefined, 'Normal', 'Série de trabalho. Conta no volume.'],
  ['aq', 'Aquecimento', 'Preparação. Não conta no volume nem nos recordes.'],
  ['dr', 'Drop set', 'Reduz a carga e continua sem descansar.'],
  ['fa', 'Até a falha', 'Foi até não conseguir mais uma repetição.']
];
const LETRA_TIPO = { aq: 'A', dr: 'D', fa: 'F' };
const NOME_TIPO = { aq: 'aquecimento', dr: 'drop', fa: 'até a falha' };

const seriesFeitas = (ex) => (ex.cardio ? (ex.feito ? 1 : 0) : ex.series.filter((x) => x.feito && x.tipo !== 'aq').length);
const seriesTotal = (ex) => (ex.cardio ? 1 : ex.series.filter((x) => x.tipo !== 'aq').length);
const exercicioCompleto = (ex) => seriesFeitas(ex) === seriesTotal(ex);

function cartaoCardio(ex, i) {
  return `
  <section class="ex-card ${ex.feito ? 'completo' : ''}" data-card="${i}">
    <p class="mudo peq">${ex.planoMin ? `Meta: ${ex.planoMin} min` : 'Por tempo'}</p>
    ${ex.ultimaMin ? `<p class="ultima">Última vez (${formatarDataCurta(ex.ultimaMin.data)}): ${ex.ultimaMin.minutos} min</p>` : ''}
    <div class="serie cardio-linha ${ex.feito ? 'feita' : ''}">
      <input class="in-num" inputmode="numeric" data-t="minutos" data-e="${i}" value="${escaparHtml(ex.minutos)}" placeholder="min" aria-label="Minutos de ${escaparHtml(ex.nome)}">
      <span class="mudo">minutos</span>
      <button type="button" class="check ${ex.feito ? 'on' : ''}" data-t="cardio-check" data-e="${i}" aria-pressed="${ex.feito}" aria-label="Cardio feito">${CHECK}</button>
    </div>
  </section>`;
}

const desl = (ex) => (ex.aquecer ? 1 : 0); // linhas de aquecimento no início
const anteriorDe = (ex, j) => (j < desl(ex) ? (ex.ultimaAq || null) : ((ex.ultima && ex.ultima.series[j - desl(ex)]) || null));

// Séries do exercício atual: uma linha por série (número, kg, reps, concluir).
function htmlSeries(ex, i) {
  if (ex.cardio) return cartaoCardio(ex, i);
  const linhas = ex.series.map((s, j) => `
    <div class="serie2 ${s.feito ? 'feita' : ''}">
      <button type="button" class="num tipo-${s.tipo || 'n'}" data-t="tipo" data-e="${i}" data-s="${j}" aria-label="Série ${j + 1 - desl(ex)}${s.tipo ? ', ' + NOME_TIPO[s.tipo] : ''}. Toque para mudar o tipo">${s.tipo ? LETRA_TIPO[s.tipo] : j + 1 - desl(ex)}</button>
      <input class="in-num grande" inputmode="decimal" enterkeyhint="next" data-t="carga" data-e="${i}" data-s="${j}" value="${escaparHtml(s.carga)}" placeholder="0" aria-label="Carga da série ${j + 1} em quilos">
      <input class="in-num grande" inputmode="numeric" enterkeyhint="done" data-t="reps" data-e="${i}" data-s="${j}" value="${escaparHtml(s.reps)}" placeholder="0" aria-label="Repetições da série ${j + 1}">
      <button type="button" class="check ${s.feito ? 'on' : ''}" data-t="check" data-e="${i}" data-s="${j}" aria-pressed="${s.feito}" aria-label="${s.feito ? 'Desmarcar' : 'Concluir'} série ${j + 1}">${CHECK}</button>
    </div>`).join('');
  return `
    <div class="series">
      <div class="serie2 cab2"><span></span><span>KG</span><span>REPS</span><span></span></div>
      ${linhas}
    </div>
    <div class="ex-rodape">
      <button type="button" class="btn-ex" data-t="mais" data-e="${i}">+ Série</button>
      <button type="button" class="btn-ex" data-t="anilhas" data-e="${i}">Calcular anilhas</button>
      ${ex.series.length > 1 + desl(ex) ? `<button type="button" class="btn-ex" data-t="menos" data-e="${i}">− Série</button>` : ''}
    </div>`;
}

// Exercícios em que a respiração é livre (isométricos): não mostra a regra geral.
const SEM_RESP = new Set(['Prancha', 'Prancha lateral', 'Dead hang (pendurar na barra)', 'Caminhada do fazendeiro', 'Dead bug']);

const videoOculto = () => { try { return localStorage.getItem('treino-video-oculto') === '1'; } catch { return false; } };

// Vídeo e dica de como fazer. Esta parte não é redesenhada a cada série marcada (para o vídeo não reiniciar).
function htmlMidia(ex) {
  if (ex.cardio) return '';
  const v = lerVideo(ex.video);
  const dica = dicaDoExercicio(ex.nome);
  const oculto = videoOculto();
  let corpo = '';
  if (v && v.tipo === 'youtube') {
    corpo = `<button type="button" class="video-box" data-t="video-play" data-id="${escaparHtml(v.id)}" aria-label="Assistir ao vídeo de ${escaparHtml(ex.nome)}"><img src="${urlMiniatura(v.id)}" alt="" loading="lazy"><span class="video-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span></button>`;
  } else if (v && v.tipo === 'vimeo') {
    corpo = `<div class="video-box tocando"><iframe src="${urlVimeo(v.id)}" title="Vídeo do exercício" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  } else if (v && v.tipo === 'arquivo') {
    corpo = `<div class="video-box tocando"><video controls playsinline preload="metadata" src="${escaparHtml(v.url)}" aria-label="Vídeo de ${escaparHtml(ex.nome)}"></video></div>`;
  } else if (v) {
    corpo = `<a class="video-link" href="${escaparHtml(v.url)}" target="_blank" rel="noopener noreferrer">▶ Abrir o vídeo do exercício</a>`;
  }
  return `
    <div class="midia">
      <div class="midia-botoes ${dica ? '' : 'so-um'}">
        ${dica ? '<button type="button" class="busca-ex como-btn" data-t="como-toggle" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><span>Como fazer</span></button>' : ''}
        <a class="busca-ex" href="${escaparHtml(urlBuscaGoogle(ex.nome))}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15 15l5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><span>Pesquisar <small>no Google</small></span></a>
      </div>
      ${dica ? `<div class="como-passos" hidden>
        <p class="como-musc"><b>Músculos:</b> ${escaparHtml(dica.musculos)}</p>
        <h4>Posição inicial</h4><ol>${dica.preparo.map((p) => `<li>${escaparHtml(p)}</li>`).join('')}</ol>
        <h4>Como fazer</h4><ol>${dica.execucao.map((p) => `<li>${escaparHtml(p)}</li>`).join('')}</ol>
        <h4>Erros comuns</h4><ul class="como-erros">${dica.erros.map((p) => `<li>${escaparHtml(p)}</li>`).join('')}</ul>
        <p class="mudo peq">${SEM_RESP.has(ex.nome) ? '' : 'Respiração: em geral, solte o ar ao fazer força e puxe o ar ao voltar. '}Dica geral. Se sentir dor (não é o cansaço normal do músculo), pare e procure um profissional.</p>
      </div>` : ''}
      ${v ? `<div class="midia-cab"><b>Vídeo do exercício</b><button type="button" class="link" data-t="video-toggle">${oculto ? 'Mostrar' : 'Recolher'}</button></div>
      <div class="midia-corpo" ${oculto ? 'hidden' : ''}>${corpo}</div>` : ''}
    </div>`;
}

const totalFeitas = () => S.exercicios.reduce((n, e) => n + seriesFeitas(e), 0);
const totalSeries = () => S.exercicios.reduce((n, e) => n + seriesTotal(e), 0);
const progressoPct = () => (totalSeries() ? Math.round((totalFeitas() / totalSeries()) * 100) : 0);
const noResumo = () => S.atual >= S.exercicios.length;

function abrirTipo(i, j) {
  const sr = S.exercicios[i].series[j];
  const f = abrirFolha(`
    <h2>Tipo da série ${j + 1}</h2>
    <div class="lista">${TIPOS.map(([v, nome, desc]) => `<button type="button" class="regra-linha ${sr.tipo === v ? 'sel' : ''}" data-tipo="${v || 'n'}"><span><strong>${nome}</strong><br><small class="mudo">${desc}</small></span>${sr.tipo === v ? '<span class="seta" aria-hidden="true">✔</span>' : ''}</button>`).join('')}</div>
    <button class="btn secundario cheio" type="button" data-fechar>Cancelar</button>`);
  f.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tipo]');
    if (!b) return;
    if (b.dataset.tipo === 'n') delete sr.tipo; else sr.tipo = b.dataset.tipo;
    guardar(); f.fechar(); atualizar();
  });
}

function htmlPontos() {
  const pontos = S.exercicios.map((ex, i) => {
    const cls = i === S.atual ? 'atual' : exercicioCompleto(ex) ? 'ok' : seriesFeitas(ex) > 0 ? 'parcial' : '';
    return `<button type="button" class="ponto ${cls}" data-t="ir" data-e="${i}" aria-label="Exercício ${i + 1}: ${escaparHtml(ex.nome)}" ${i === S.atual ? 'aria-current="step"' : ''}>${i + 1}</button>`;
  }).join('');
  return `${pontos}<button type="button" class="ponto fim ${noResumo() ? 'atual' : ''}" data-t="ir" data-e="${S.exercicios.length}" aria-label="Resumo e finalizar">✓</button>`;
}

function htmlNavegacao() {
  const n = S.exercicios.length;
  const ant = `<button type="button" class="btn secundario t-ant" data-t="ant" ${S.atual === 0 ? 'disabled' : ''} aria-label="Exercício anterior">‹ Anterior</button>`;
  if (noResumo()) return `${ant}<button type="button" class="btn t-prox" data-t="finalizar">Finalizar treino ✓</button>`;
  const ex = S.exercicios[S.atual];
  const ultimo = S.atual === n - 1;
  const rotulo = seriesFeitas(ex) === 0 ? (ultimo ? 'Pular e ver resumo ›' : 'Pular exercício ›') : (ultimo ? 'Ver resumo ›' : 'Próximo ›');
  return `${ant}<button type="button" class="btn t-prox ${exercicioCompleto(ex) ? 'sugerido' : seriesFeitas(ex) === 0 ? 'secundario' : ''}" data-t="prox">${rotulo}</button>`;
}

function htmlResumo() {
  const linhas = S.exercicios.map((ex, i) => {
    const f = seriesFeitas(ex); const t = seriesTotal(ex);
    const estadoTxt = f === t ? 'completo' : f > 0 ? `${f} de ${t} séries` : 'pulado';
    return `<button type="button" class="resumo-linha ${f === t ? 'ok' : f === 0 ? 'pulado' : ''}" data-t="ir" data-e="${i}"><span class="r-nome">${i + 1}. ${escaparHtml(ex.nome)}</span><span class="r-estado">${estadoTxt}</span></button>`;
  }).join('');
  return `
    <section class="ex-solo">
      <p class="ex-pos">Fim do treino</p>
      <h2 class="ex-nome">Tudo certo por aqui?</h2>
      <p class="ex-plano">${totalFeitas()} de ${totalSeries()} séries feitas · toque num exercício para voltar a ele.</p>
      <div class="resumo-lista">${linhas}</div>
      <section class="ex-card"><h3>Anotação do treino</h3><textarea class="in" data-t="nota" rows="3" maxlength="500" placeholder="Como foi? Dor, energia, o que ajustar…">${escaparHtml(S.nota || '')}</textarea></section>
    </section>`;
}

function htmlExercicio(ex, i) {
  const completo = exercicioCompleto(ex);
  return `
    <section class="ex-solo">
      <p class="ex-pos" id="ex-pos-txt">Exercício ${i + 1} de ${S.exercicios.length} · ${totalFeitas()}/${totalSeries()} séries</p>
      <div class="ex-linha-nome"><h2 class="ex-nome">${escaparHtml(ex.nome)}${ex.cardio ? ' <span class="selo">cardio</span>' : ''}</h2><span class="selo ${completo ? 'ok' : ''}" id="selo-ex">${seriesFeitas(ex)}/${seriesTotal(ex)}</span></div>
      ${ex.cardio ? '' : `<p class="ex-plano">${escaparHtml(textoPlano(ex))}</p>`}
      ${ex.obs ? `<p class="obs">${escaparHtml(ex.obs)}</p>` : ''}
      ${ex.ultima ? `<p class="ex-ultima">Última vez: ${escaparHtml(ex.ultima.series.map((x) => `${x.carga != null ? formatarNumero(x.carga) : '—'}×${x.reps != null ? formatarNumero(x.reps) : '—'}`).join(' · '))}</p>` : ''}
      <div id="zona-series" data-card="${i}">${htmlSeries(ex, i)}</div>
      ${htmlMidia(ex)}
    </section>`;
}

// Desenha a tela inteira (ao trocar de exercício).
function desenhar() {
  const cont = raiz.querySelector('#treinar-conteudo');
  cont.innerHTML = `
    <div class="treinar-topo">
      <button class="icone-btn" type="button" data-t="cancelar" aria-label="Sair do treino sem salvar">✕</button>
      <div class="treinar-titulo"><strong>${escaparHtml(S.treinoNome)}</strong><span class="t-linha"><span id="t-relogio">${formatarDuracao((Date.now() - S.inicio) / 1000)}</span><small id="t-volume" class="t-volume">${formatarVolume(volumeAtual())}</small></span></div>
      ${noResumo() ? '<span class="topo-vazio"></span>' : '<button class="btn pequeno" type="button" data-t="finalizar">Finalizar</button>'}
    </div>
    <div class="t-progresso" aria-label="Progresso do treino"><div class="t-prog-barra"><i style="width:${progressoPct()}%"></i></div></div>
    <div class="pontos" id="pontos" role="group" aria-label="Exercícios">${htmlPontos()}</div>
    <div class="treinar-corpo" id="treinar-corpo">${noResumo() ? htmlResumo() : htmlExercicio(S.exercicios[S.atual], S.atual)}<div class="espaco-descanso"></div></div>
    <div class="t-nav" id="t-nav">${htmlNavegacao()}</div>`;
  const at = cont.querySelector('.ponto.atual');
  if (at && at.scrollIntoView) at.scrollIntoView({ inline: 'center', block: 'nearest' });
}

// Atualiza só o que muda ao marcar série (não mexe no vídeo nem tira o teclado do campo).
function atualizar() {
  if (!raiz || noResumo()) { if (raiz) desenhar(); return; }
  const ex = S.exercicios[S.atual];
  const zona = raiz.querySelector('#zona-series');
  if (zona) zona.innerHTML = htmlSeries(ex, S.atual);
  const selo = raiz.querySelector('#selo-ex');
  if (selo) { selo.textContent = `${seriesFeitas(ex)}/${seriesTotal(ex)}`; selo.classList.toggle('ok', exercicioCompleto(ex)); }
  const barra = raiz.querySelector('.t-prog-barra i');
  if (barra) barra.style.width = `${progressoPct()}%`;
  const pos = raiz.querySelector('#ex-pos-txt');
  if (pos) pos.textContent = `Exercício ${S.atual + 1} de ${S.exercicios.length} · ${totalFeitas()}/${totalSeries()} séries`;
  const pontos = raiz.querySelector('#pontos');
  if (pontos) pontos.innerHTML = htmlPontos();
  const nv = raiz.querySelector('#t-nav');
  if (nv) nv.innerHTML = htmlNavegacao();
  const v = raiz.querySelector('#t-volume');
  if (v) v.textContent = formatarVolume(volumeAtual());
}

function irPara(n) {
  const max = S.exercicios.length; // o último passo é o resumo
  const novo = Math.max(0, Math.min(max, n));
  if (novo === S.atual) return;
  S.atual = novo;
  guardar();
  desenhar();
  const corpo = raiz.querySelector('#treinar-corpo');
  if (corpo) corpo.scrollTop = 0;
}

const volumeAtual = () => volumeDasSeries(S.exercicios.map((e) => ({ series: e.series.map((x) => ({ carga: numero(x.carga), reps: numero(x.reps), feito: x.feito, tipo: x.tipo })) })));

function atualizarRelogio() {
  const el = raiz && raiz.querySelector('#t-relogio');
  if (el && S) el.textContent = formatarDuracao((Date.now() - S.inicio) / 1000);
}

function aoDigitar(e) {
  const t = e.target;
  if (!t.dataset) return;
  if (t.dataset.t === 'nota') { S.nota = t.value; guardar(); return; }
  if (t.dataset.t === 'minutos') { S.exercicios[Number(t.dataset.e)].minutos = t.value; guardar(); return; }
  if (t.dataset.t !== 'carga' && t.dataset.t !== 'reps') return;
  S.exercicios[Number(t.dataset.e)].series[Number(t.dataset.s)][t.dataset.t] = t.value;
  guardar();
  const v = raiz.querySelector('#t-volume');
  if (v) v.textContent = formatarVolume(volumeAtual());
}

// Marca ou desmarca uma série (só quando a pessoa toca no check).
function alternarSerie(i, j) {
  const s = S.exercicios[i].series[j];
  s.feito = !s.feito;
  if (s.feito) {
    // Se a pessoa não digitou nada, usa o que veio da última vez ou da série de cima.
    const ant = anteriorDe(S.exercicios[i], j);
    const cima = j > desl(S.exercicios[i]) ? S.exercicios[i].series[j - 1] : null;
    if (!String(s.carga || '').trim()) s.carga = ant && ant.carga != null ? String(ant.carga).replace('.', ',') : (cima ? cima.carga : s.carga);
    if (!String(s.reps || '').trim()) s.reps = ant && ant.reps != null ? String(ant.reps) : (cima ? cima.reps : s.reps);
  }
  guardar();
  atualizar();
  if (s.feito) {
    const ex0 = S.exercicios[i];
    const c = numero(s.carga);
    if (s.tipo !== 'aq' && c != null && ex0.maxAnt != null && c > ex0.maxAnt && !ex0.recorde) { ex0.recorde = true; guardar(); toast(`🏆 Recorde pessoal em ${ex0.nome}: ${formatarNumero(c)} kg!`); }
    const botao = raiz.querySelector(`[data-t="check"][data-e="${i}"][data-s="${j}"]`);
    if (botao) botao.classList.add('pop');
    destravarAudio();
    if (S.exercicios[i].descanso > 0) iniciarDescanso(S.exercicios[i].descanso);
  }
}

function aoClicar(e) {
  const b = e.target.closest('[data-t]');
  if (!b) return;
  const acao = b.dataset.t;
  const i = Number(b.dataset.e);
  if (acao === 'tipo') {
    abrirTipo(i, Number(b.dataset.s));
  } else if (acao === 'copiar') {
    const j = Number(b.dataset.s);
    const ant = anteriorDe(S.exercicios[i], j);
    if (ant) {
      const sr = S.exercicios[i].series[j];
      if (ant.carga != null) sr.carga = String(ant.carga).replace('.', ',');
      if (ant.reps != null) sr.reps = String(ant.reps);
      guardar(); atualizar();
    }
  } else if (acao === 'cardio-check') {
    S.exercicios[i].feito = !S.exercicios[i].feito;
    guardar(); atualizar();
  } else if (acao === 'prox') {
    irPara(S.atual + 1);
  } else if (acao === 'ant') {
    irPara(S.atual - 1);
  } else if (acao === 'ir') {
    irPara(i);
  } else if (acao === 'video-play') {
    const id = b.dataset.id;
    b.outerHTML = `<div class="video-box tocando"><iframe src="${urlEmbed(id)}" title="Vídeo do exercício" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  } else if (acao === 'como-toggle') {
    const painel = raiz.querySelector('.como-passos');
    if (painel) {
      painel.hidden = !painel.hidden;
      b.setAttribute('aria-expanded', String(!painel.hidden));
      if (!painel.hidden) painel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  } else if (acao === 'video-toggle') {
    const corpo = raiz.querySelector('.midia-corpo');
    const esconder = !corpo.hidden;
    corpo.hidden = esconder;
    if (esconder) corpo.querySelectorAll('video').forEach((vd) => vd.pause());
    b.textContent = esconder ? 'Mostrar' : 'Recolher';
    try { localStorage.setItem('treino-video-oculto', esconder ? '1' : '0'); } catch { /* ok */ }
  } else if (acao === 'anilhas') {
    const ex = S.exercicios[i];
    const ref = ex.series.map((x) => numero(x.carga)).find((c) => c != null);
    abrirAnilhas(ref ?? null);
  } else if (acao === 'check') {
    alternarSerie(i, Number(b.dataset.s));
  } else if (acao === 'mais') {
    const ex = S.exercicios[i];
    const ult = ex.series[ex.series.length - 1];
    ex.series.push({ carga: ult.carga, reps: ult.reps, feito: false });
    guardar(); atualizar();
  } else if (acao === 'menos') {
    const ex = S.exercicios[i];
    if (ex.series.length > 1 + desl(ex)) { ex.series.pop(); guardar(); atualizar(); }
  } else if (acao === 'cancelar') {
    cancelar();
  } else if (acao === 'finalizar') {
    finalizar();
  } else if (acao === 'mais15') {
    descansoFim += 15000; descansoTotal += 15000; pintarDescanso();
  } else if (acao === 'pular' || acao === 'okdescanso') {
    pararDescanso();
  }
}

// ---------- Descanso ----------
function iniciarDescanso(segundos) {
  descansoFim = Date.now() + segundos * 1000;
  descansoTotal = segundos * 1000;
  clearInterval(timerDescanso);
  timerDescanso = setInterval(pintarDescanso, 250);
  pintarDescanso();
}

function pintarDescanso() {
  const el = raiz && raiz.querySelector('#descanso');
  if (!el) return;
  const resta = Math.ceil((descansoFim - Date.now()) / 1000);
  el.hidden = false;
  if (resta > 0) {
    // Os botões são criados uma vez só: atualizar a cada instante só o tempo e a barra
    // (se os botões fossem refeitos toda hora, um toque podia se perder).
    if (el.dataset.modo !== 'contando') {
      el.dataset.modo = 'contando';
      el.classList.remove('acabou');
      el.innerHTML = `<div class="d-prog"></div><span class="d-rotulo">Descanso</span><strong class="d-tempo"></strong>
        <button type="button" class="btn pequeno secundario" data-t="mais15">+15s</button>
        <button type="button" class="btn pequeno" data-t="pular">Pular</button>`;
    }
    el.querySelector('.d-tempo').textContent = formatarDuracao(resta);
    const pct = Math.max(0, Math.min(100, ((descansoFim - Date.now()) / descansoTotal) * 100));
    el.querySelector('.d-prog').style.width = `${pct.toFixed(1)}%`;
  } else {
    clearInterval(timerDescanso);
    timerDescanso = null;
    if (el.dataset.modo !== 'acabou') {
      el.dataset.modo = 'acabou';
      el.classList.add('acabou');
      el.innerHTML = `<strong class="d-tempo">Acabou o descanso!</strong><button type="button" class="btn pequeno" data-t="okdescanso">Ok</button>`;
      avisar();
    }
  }
}

function pararDescanso() {
  clearInterval(timerDescanso);
  timerDescanso = null;
  const el = raiz && raiz.querySelector('#descanso');
  if (el) { el.hidden = true; el.classList.remove('acabou'); el.dataset.modo = ''; el.innerHTML = ''; }
}

function destravarAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* sem som: segue só com o aviso na tela */ }
}

function avisar() {
  try {
    if (audioCtx) {
      [0, 0.35].forEach((t) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.frequency.value = 880;
        g.gain.value = 0.2;
        o.connect(g); g.connect(audioCtx.destination);
        o.start(audioCtx.currentTime + t);
        o.stop(audioCtx.currentTime + t + 0.2);
      });
    }
  } catch { /* ok */ }
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch { /* iPhone não vibra */ }
}

// Mantém a tela acesa durante o treino (quando o aparelho permite).
async function pedirTelaLigada() {
  try { if (navigator.wakeLock) travaTela = await navigator.wakeLock.request('screen'); } catch { /* ok */ }
}
document.addEventListener('visibilitychange', () => {
  if (S && document.visibilityState === 'visible') pedirTelaLigada();
});

// ---------- Terminar ----------
function fechar() {
  clearInterval(timerRelogio);
  clearInterval(timerDescanso);
  timerRelogio = null; timerDescanso = null;
  try { if (travaTela) travaTela.release(); } catch { /* ok */ }
  travaTela = null;
  if (raiz) raiz.remove();
  raiz = null;
  S = null;
  descartarRascunho();
  if (!document.querySelector('.folha-fundo')) document.body.classList.remove('sem-rolagem');
  nav.renderizar();
}

async function cancelar() {
  if (await confirmar('Sair sem salvar? O que você marcou nesse treino vai ser perdido.', { ok: 'Sair sem salvar', perigo: true })) fechar();
}

async function finalizar() {
  const total = S.exercicios.reduce((n, e) => n + (e.cardio ? 1 : e.series.filter((s) => s.tipo !== 'aq').length), 0);
  const feitas = S.exercicios.reduce((n, e) => n + (e.cardio ? (e.feito ? 1 : 0) : e.series.filter((s) => s.feito && s.tipo !== 'aq').length), 0);
  if (feitas === 0) {
    if (!(await confirmar('Você não marcou nenhuma série como feita. Salvar mesmo assim?', { ok: 'Salvar' }))) return;
  } else if (feitas < total) {
    if (!(await confirmar(`Faltam ${total - feitas} série(s) sem marcar. Finalizar mesmo assim?`, { ok: 'Finalizar' }))) return;
  }
  const fim = Date.now();
  const exercicios = S.exercicios.map((e) => (e.cardio
    ? { nome: e.nome, cardio: true, minutos: numero(e.minutos), feito: e.feito, obs: e.obs || null, series: [] }
    : {
      nome: e.nome,
      obs: e.obs || null,
      series: e.series.map((x) => ({ carga: numero(x.carga), reps: numero(x.reps), feito: x.feito, ...(x.tipo ? { tipo: x.tipo } : {}) }))
    }));
  const volume = volumeDasSeries(exercicios);
  // Recorde = carga maior que qualquer uma já feita antes naquele exercício (só vale se já existia histórico).
  const recordes = [];
  S.exercicios.forEach((e, i) => {
    const cargas = exercicios[i].series.filter((x) => x.feito && x.tipo !== 'aq' && x.carga != null).map((x) => x.carga);
    const max = cargas.length ? Math.max(...cargas) : null;
    if (max != null && e.maxAnt != null && max > e.maxAnt) recordes.push({ nome: e.nome, carga: max });
  });
  const duracaoMin = Math.max(1, Math.round((fim - S.inicio) / 60000));
  const sessao = {
    data: dataLocal(new Date(S.inicio)),
    treinoId: S.treinoId,
    treinoNome: S.treinoNome,
    inicio: new Date(S.inicio).toISOString(),
    fim: new Date(fim).toISOString(),
    duracaoMin,
    volume,
    nota: (S.nota || '').trim() || null,
    recordes,
    exercicios,
    criadoEm: new Date().toISOString()
  };
  salvarDoc(estado.uid, 'sessoes', novoId(), sessao);
  fechar();
  const avisoAntigo = document.getElementById('toast');
  if (avisoAntigo) avisoAntigo.classList.remove('ver');
  const f = abrirFolha(`
    <h2>Treino salvo 💪</h2>
    <div class="resumo resumo2">
      <div class="num-card"><strong>${escaparHtml(Math.round(volume).toLocaleString('pt-BR'))}</strong><span>kg levantados</span></div>
      <div class="num-card"><strong>${feitas}</strong><span>série${feitas === 1 ? '' : 's'} feita${feitas === 1 ? '' : 's'}</span></div>
      <div class="num-card"><strong>${duracaoMin}</strong><span>minutos</span></div>
    </div>
    ${recordes.length ? `<div class="card destaque"><h3>🏆 Novo${recordes.length === 1 ? '' : 's'} recorde${recordes.length === 1 ? '' : 's'}</h3>${recordes.map((r) => `<p>${escaparHtml(r.nome)}: <strong>${formatarNumero(r.carga)} kg</strong></p>`).join('')}</div>` : ''}
    <button class="btn cheio" type="button" data-fechar>Fechar</button>`);
  return f;
}
