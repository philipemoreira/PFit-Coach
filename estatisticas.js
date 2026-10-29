// Tela "Estatísticas": soma de carga (kg levantados) por dia, semana, mês e no total, com comparações e gráficos.
import { escaparHtml, formatarDataCurta } from './util.js';
import { nav } from './nav.js';
import { estatisticasVolume, formatarVolume, formatarToneladas, metaVolume } from './metricas.js';

let visao = 'semanas'; // 'semanas' | 'meses'

const kg = (n) => Math.round(n).toLocaleString('pt-BR');
const compacto = (n) => (n >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : String(Math.round(n)));
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (chave) => `${MESES[Number(chave.slice(5, 7)) - 1]}`;
const nomeMesLongo = (chave) => {
  const d = new Date(Number(chave.slice(0, 4)), Number(chave.slice(5, 7)) - 1, 1);
  const t = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// "Faltam X kg para igualar…" ou "Você já passou…": comparação honesta com o período anterior inteiro.
function comparar(atual, anterior, nome) {
  if (!anterior) return atual > 0 ? `<span class="mudo">Sem ${nome} para comparar.</span>` : '';
  if (atual >= anterior) {
    const pct = Math.round(((atual - anterior) / anterior) * 100);
    return `<span class="stat-ok">▲ ${kg(atual - anterior)} kg a mais que ${nome}${pct > 0 ? ` (+${pct}%)` : ''}</span>`;
  }
  return `<span class="mudo">Faltam <strong>${kg(anterior - atual)} kg</strong> para igualar ${nome} (${kg(anterior)} kg).</span>`;
}

function cartao(rotulo, valor, sub, destaque = false) {
  return `<article class="stat-card ${destaque ? 'destaque' : ''}">
    <span class="stat-rot">${rotulo}</span>
    <strong class="stat-num">${kg(valor)} <small>kg</small></strong>
    <p class="stat-sub">${sub}</p>
  </article>`;
}

function grafico(lista, rotulo, meta) {
  const W = 340; const H = 128; const base = H - 20; const topo = 18;
  const max = Math.max(1, meta || 0, ...lista.map((x) => x.v));
  const larg = (W - 8) / lista.length;
  const passo = visao === 'semanas' ? 3 : 1; // semanas: um rótulo a cada 3 barras (11 é a última; a atual sempre aparece)
  const barras = lista.map((x, i) => {
    const h = Math.round(((base - topo) * x.v) / max);
    const cx = 4 + i * larg + larg / 2;
    return `<rect x="${(cx - larg / 2 + 3).toFixed(1)}" y="${base - h}" width="${(larg - 6).toFixed(1)}" height="${Math.max(h, x.v ? 2 : 0)}" rx="4" class="g-barra ${x.atual ? 'g-meta-ok' : ''}"/>`
      + (x.v ? `<text x="${cx.toFixed(1)}" y="${base - h - 4}" text-anchor="middle" class="g-valor">${compacto(x.v)}</text>` : '')
      + (i % passo === 0 || x.atual ? `<text x="${cx.toFixed(1)}" y="${H - 5}" text-anchor="middle" class="g-rot">${rotulo(x)}</text>` : '');
  }).join('');
  return `<svg class="grafico g-evol" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kg levantados por ${visao === 'semanas' ? 'semana, nas últimas 12 semanas' : 'mês, nos últimos 12 meses'}">${barras}</svg>`;
}

function linhaRecorde(icone, rotulo, valor, detalhe) {
  return `<div class="stat-rec"><span class="stat-rec-ico" aria-hidden="true">${icone}</span><span class="stat-rec-txt">${rotulo}<small class="mudo">${detalhe}</small></span><strong>${valor}</strong></div>`;
}

export const estatisticas = {
  render() {
    const e = estatisticasVolume();
    const cab = `
    <header class="topo topo-sub">
      <button type="button" class="voltar" data-acao="voltar" aria-label="Voltar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
      <h1>Estatísticas</h1>
    </header>`;
    if (!e.treinos || !e.total) {
      return `${cab}
      <section class="card stat-vazio">
        <h2>Sua carga acumulada começa no primeiro treino</h2>
        <p class="mudo">Quando você terminar um treino com carga e repetições, aqui aparece quanto você levantou por dia, semana e mês, e o total de todos os treinos.</p>
        <p class="mudo peq">Volume = carga × repetições de cada série feita. Aquecimento e exercícios sem carga não entram.</p>
      </section>`;
    }
    const meta = metaVolume();
    const marcoPct = e.marco ? Math.max(0, Math.min(100, ((e.total - e.marcoAnterior) / (e.marco - e.marcoAnterior)) * 100)) : 100;
    const lista = visao === 'semanas' ? e.semanas : e.meses;
    const rot = visao === 'semanas' ? (x) => formatarDataCurta(x.chave) : (x) => rotuloMes(x.chave);
    const tn = (n) => `${n} treino${n === 1 ? '' : 's'}`;
    return `${cab}
    <section class="stat-hero" aria-label="Total acumulado">
      <span class="stat-rot">Total acumulado</span>
      <strong class="stat-grande">${kg(e.total)} <small>kg</small></strong>
      <p class="stat-sub">${formatarToneladas(e.total)} levantadas em ${tn(e.treinos)}${e.primeiroTreino ? ` · desde ${formatarDataCurta(e.primeiroTreino)}` : ''}</p>
      <div class="stat-marco">
        <div class="stat-marco-topo"><span>Próximo marco</span><strong>${e.marco ? formatarVolume(e.marco) : 'você passou todos 🏆'}</strong></div>
        <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(marcoPct)}"><i style="width:${marcoPct.toFixed(1)}%"></i></div>
        ${e.marco ? `<small class="mudo">Faltam ${kg(e.marco - e.total)} kg</small>` : ''}
      </div>
    </section>

    <section class="stat-grade">
      ${cartao('Hoje', e.hoje, meta ? (e.hoje >= meta ? '<span class="stat-ok">🎯 meta do dia batida</span>' : `<span class="mudo">Meta do dia: ${kg(meta)} kg</span>`) : '<span class="mudo">Soma de hoje</span>', true)}
      ${cartao('Esta semana', e.semana, `${comparar(e.semana, e.semanaPassada, 'a semana passada')}<br><span class="mudo">${tn(e.treinosSemana)}</span>`)}
      ${cartao('Este mês', e.mes, `${comparar(e.mes, e.mesPassado, 'o mês passado')}<br><span class="mudo">${tn(e.treinosMes)}</span>`)}
    </section>

    <section class="card">
      <div class="card-topo"><h2>Evolução</h2></div>
      <div class="seg" role="group" aria-label="Período do gráfico">
        <button type="button" aria-pressed="${visao === 'semanas'}" data-acao="stats-visao" data-v="semanas">12 semanas</button>
        <button type="button" aria-pressed="${visao === 'meses'}" data-acao="stats-visao" data-v="meses">12 meses</button>
      </div>
      ${grafico(lista, rot, null)}
      <p class="mudo peq">Kg levantados por ${visao === 'semanas' ? 'semana (a barra acesa é a semana atual; o rótulo é a segunda-feira)' : 'mês (a barra acesa é o mês atual)'}.</p>
    </section>

    <section class="card">
      <h2>Seus recordes</h2>
      ${e.melhorDia ? linhaRecorde('📅', 'Melhor dia', `${kg(e.melhorDia.v)} kg`, formatarDataCurta(e.melhorDia.chave)) : ''}
      ${e.melhorSemana ? linhaRecorde('🗓️', 'Melhor semana', `${kg(e.melhorSemana.v)} kg`, `semana de ${formatarDataCurta(e.melhorSemana.chave)}`) : ''}
      ${e.melhorMes ? linhaRecorde('🏆', 'Melhor mês', `${kg(e.melhorMes.v)} kg`, escaparHtml(nomeMesLongo(e.melhorMes.chave))) : ''}
      ${linhaRecorde('⚖️', 'Média por treino', `${kg(e.mediaPorTreino)} kg`, 'considerando treinos com carga')}
    </section>
    <p class="aviso-rodape">Volume = carga × repetições de cada série feita. Aquecimento e exercícios sem carga não entram. Depois de 1.500 treinos registrados, os mais antigos deixam de entrar na soma.</p>`;
  },
  acoes: {
    'stats-abrir': () => nav.irPara('stats'),
    'stats-visao': (el) => { visao = el.dataset.v === 'meses' ? 'meses' : 'semanas'; nav.renderizar(); }
  }
};
