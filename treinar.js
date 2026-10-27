// Tela de treino em andamento: marcar séries, cronômetro de descanso e salvar o treino feito.
import { estado } from './estado.js';
import { confirmar } from './folha.js';
import { escaparHtml, dataLocal, novoId, numero, formatarNumero, formatarDataCurta, formatarDuracao, toast } from './util.js';
import { salvarDoc } from './dados.js';
import { abrirFolha } from './folha.js';
import { volumeDasSeries, maiorCargaAntes, formatarVolume } from './metricas.js';
import { nav } from './nav.js';

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
    const ex = (s.exercicios || []).find((e) => norm(e.nome) === k && (e.series || []).some((x) => x.feito));
    if (ex) return { data: s.data, series: ex.series.filter((x) => x.feito).map((x) => ({ carga: x.carga, reps: x.reps })) };
  }
  return null;
}

export function iniciarTreino(treino) {
  if (S) { toast('Você já tem um treino aberto.'); return; }
  S = {
    treinoId: treino.id,
    treinoNome: treino.nome,
    inicio: Date.now(),
    nota: '',
    exercicios: (treino.exercicios || []).map((ex) => {
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
      return { nome: ex.nome, maxAnt: maiorCargaAntes(ex.nome), obs: ex.obs || '', descanso: ex.descanso || 0, planoSeries: n, planoReps: ex.reps || '', planoCarga: ex.carga ?? null, ultima: ult, series };
    })
  };
  guardar();
  abrir();
}

export function retomarTreino() {
  const r = rascunhoSalvo();
  if (!r || S) return;
  S = r;
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
  timerRelogio = setInterval(atualizarRelogio, 1000);
  pedirTelaLigada();
}

function textoUltima(ex) {
  if (!ex.ultima) return '';
  const partes = ex.ultima.series.map((s) => `${s.carga != null ? formatarNumero(s.carga) + ' kg' : '—'} × ${s.reps != null ? formatarNumero(s.reps) : '—'}`);
  return `Última vez (${formatarDataCurta(ex.ultima.data)}): ${partes.join(' · ')}`;
}

function textoPlano(ex) {
  const p = [`${ex.planoSeries} série${ex.planoSeries === 1 ? '' : 's'}`];
  if (ex.planoReps) p.push(`${ex.planoReps} reps`);
  if (ex.planoCarga != null) p.push(`${formatarNumero(ex.planoCarga)} kg`);
  if (ex.descanso) p.push(`descanso ${ex.descanso}s`);
  return p.join(' · ');
}

function cartaoExercicio(ex, i) {
  const linhas = ex.series.map((s, j) => `
    <div class="serie ${s.feito ? 'feita' : ''}">
      <span class="num">${j + 1}</span>
      <input class="in-num" inputmode="decimal" data-t="carga" data-e="${i}" data-s="${j}" value="${escaparHtml(s.carga)}" placeholder="kg" aria-label="Carga da série ${j + 1} em quilos">
      <input class="in-num" inputmode="numeric" data-t="reps" data-e="${i}" data-s="${j}" value="${escaparHtml(s.reps)}" placeholder="reps" aria-label="Repetições da série ${j + 1}">
      <button type="button" class="check ${s.feito ? 'on' : ''}" data-t="check" data-e="${i}" data-s="${j}" aria-pressed="${s.feito}" aria-label="Série ${j + 1} feita">✔</button>
    </div>`).join('');
  const ultima = textoUltima(ex);
  return `
  <section class="ex-card">
    <h3>${escaparHtml(ex.nome)}</h3>
    <p class="mudo peq">${escaparHtml(textoPlano(ex))}</p>
    ${ultima ? `<p class="ultima">${escaparHtml(ultima)}</p>` : ''}
    ${ex.obs ? `<p class="obs">${escaparHtml(ex.obs)}</p>` : ''}
    <div class="series">
      <div class="serie cab"><span>Série</span><span>kg</span><span>Reps</span><span></span></div>
      ${linhas}
    </div>
    <div class="ex-rodape">
      <button type="button" class="link" data-t="mais" data-e="${i}">+ Série</button>
      ${ex.series.length > 1 ? `<button type="button" class="link" data-t="menos" data-e="${i}">− Série</button>` : ''}
    </div>
  </section>`;
}

function desenhar() {
  const cont = raiz.querySelector('#treinar-conteudo');
  const rolagem = cont.querySelector('.treinar-corpo');
  const y = rolagem ? rolagem.scrollTop : 0;
  cont.innerHTML = `
    <div class="treinar-topo">
      <button class="icone-btn" type="button" data-t="cancelar" aria-label="Sair do treino sem salvar">✕</button>
      <div class="treinar-titulo"><strong>${escaparHtml(S.treinoNome)}</strong><span id="t-relogio">${formatarDuracao((Date.now() - S.inicio) / 1000)}</span><small id="t-volume" class="t-volume">${formatarVolume(volumeAtual())}</small></div>
      <button class="btn pequeno" type="button" data-t="finalizar">Finalizar</button>
    </div>
    <div class="treinar-corpo">${S.exercicios.map(cartaoExercicio).join('')}<section class="ex-card"><h3>Anotação do treino</h3><textarea class="in" data-t="nota" rows="3" maxlength="500" placeholder="Como foi? Dor, energia, o que ajustar…">${escaparHtml(S.nota || '')}</textarea></section><div class="espaco-descanso"></div></div>`;
  const novo = cont.querySelector('.treinar-corpo');
  if (novo) novo.scrollTop = y;
}

const volumeAtual = () => volumeDasSeries(S.exercicios.map((e) => ({ series: e.series.map((x) => ({ carga: numero(x.carga), reps: numero(x.reps), feito: x.feito })) })));

function atualizarRelogio() {
  const el = raiz && raiz.querySelector('#t-relogio');
  if (el && S) el.textContent = formatarDuracao((Date.now() - S.inicio) / 1000);
}

function aoDigitar(e) {
  const t = e.target;
  if (!t.dataset) return;
  if (t.dataset.t === 'nota') { S.nota = t.value; guardar(); return; }
  if (t.dataset.t !== 'carga' && t.dataset.t !== 'reps') return;
  S.exercicios[Number(t.dataset.e)].series[Number(t.dataset.s)][t.dataset.t] = t.value;
  guardar();
  const v = raiz.querySelector('#t-volume');
  if (v) v.textContent = formatarVolume(volumeAtual());
}

function aoClicar(e) {
  const b = e.target.closest('[data-t]');
  if (!b) return;
  const acao = b.dataset.t;
  const i = Number(b.dataset.e);
  if (acao === 'check') {
    const s = S.exercicios[i].series[Number(b.dataset.s)];
    s.feito = !s.feito;
    guardar();
    desenhar();
    if (s.feito) {
      const ex0 = S.exercicios[i];
      const c = numero(s.carga);
      if (c != null && ex0.maxAnt != null && c > ex0.maxAnt && !ex0.recorde) { ex0.recorde = true; guardar(); toast(`🏆 Recorde pessoal em ${ex0.nome}: ${formatarNumero(c)} kg!`); }
      const botao = raiz.querySelector(`[data-t="check"][data-e="${i}"][data-s="${b.dataset.s}"]`);
      if (botao) botao.classList.add('pop');
      destravarAudio();
      if (S.exercicios[i].descanso > 0) iniciarDescanso(S.exercicios[i].descanso);
    }
  } else if (acao === 'mais') {
    const ex = S.exercicios[i];
    const ult = ex.series[ex.series.length - 1];
    ex.series.push({ carga: ult.carga, reps: ult.reps, feito: false });
    guardar(); desenhar();
  } else if (acao === 'menos') {
    const ex = S.exercicios[i];
    if (ex.series.length > 1) { ex.series.pop(); guardar(); desenhar(); }
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
  const total = S.exercicios.reduce((n, e) => n + e.series.length, 0);
  const feitas = S.exercicios.reduce((n, e) => n + e.series.filter((s) => s.feito).length, 0);
  if (feitas === 0) {
    if (!(await confirmar('Você não marcou nenhuma série como feita. Salvar mesmo assim?', { ok: 'Salvar' }))) return;
  } else if (feitas < total) {
    if (!(await confirmar(`Faltam ${total - feitas} série(s) sem marcar. Finalizar mesmo assim?`, { ok: 'Finalizar' }))) return;
  }
  const fim = Date.now();
  const exercicios = S.exercicios.map((e) => ({
    nome: e.nome,
    obs: e.obs || null,
    series: e.series.map((x) => ({ carga: numero(x.carga), reps: numero(x.reps), feito: x.feito }))
  }));
  const volume = volumeDasSeries(exercicios);
  // Recorde = carga maior que qualquer uma já feita antes naquele exercício (só vale se já existia histórico).
  const recordes = [];
  S.exercicios.forEach((e, i) => {
    const cargas = exercicios[i].series.filter((x) => x.feito && x.carga != null).map((x) => x.carga);
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
