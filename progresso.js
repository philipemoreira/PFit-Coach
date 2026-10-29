// Aba Progresso: resumo, peso corporal, evolução de carga por exercício e histórico.
import { estado } from './estado.js';
import { abrirFolha, confirmar } from './folha.js';
import {
  escaparHtml, dataLocal, parseData, formatarDataCurta, formatarNumero, numero, toast, segundaDaSemana
} from './util.js';
import { salvarDoc, removerDoc } from './dados.js';
import { nav } from './nav.js';
import { grupoDoExercicio } from './exercicios-base.js';
import { totaisDoDia } from './alimentos.js';
import { abrirFotos } from './fotos.js';
import { cumprimento as cumprimentoPlano } from './dietaplano.js';
import { listaRecolhivel } from './recolhivel.js';
import { linhaSessao } from './historico.js';
import { volumeSessao, volumeDoDia, metaVolume, metaPeso, sequenciaSemanas, formatarVolume, conquistas, metaMacros, textoProgresso, percentualConquista } from './metricas.js';

let exercicioEscolhido = '';
let conquistasTodas = false; // mostra todas as conquistas em andamento
let mesVisto = null; // primeiro dia do mês mostrado no calendário
const norm = (s) => String(s || '').trim().toLowerCase();

function treinosNoPeriodo() {
  const semana = dataLocal(segundaDaSemana());
  const mes = dataLocal().slice(0, 7);
  return {
    semana: estado.sessoes.filter((s) => s.data >= semana).length,
    mes: estado.sessoes.filter((s) => String(s.data).startsWith(mes)).length
  };
}

// Porcentagem dos itens da dieta marcados nos últimos 7 dias (só conta os dias em que anotou algo).
function cumprimentoDieta() {
  const datas = [];
  for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); datas.push(dataLocal(d)); }
  return cumprimentoPlano(estado.dietaItens, estado.refeicoes, datas);
}

function exerciciosComCarga() {
  const mapa = new Map();
  estado.sessoes.forEach((s) => (s.exercicios || []).forEach((e) => {
    if ((e.series || []).some((x) => x.feito && x.carga != null)) {
      const k = norm(e.nome);
      if (k && !mapa.has(k)) mapa.set(k, e.nome);
    }
  }));
  return [...mapa];
}

function pontosExercicio(chave) {
  return [...estado.sessoes]
    .sort((a, b) => String(a.data).localeCompare(String(b.data)) || String(a.fim || '').localeCompare(String(b.fim || '')))
    .map((s) => {
      const ex = (s.exercicios || []).find((e) => norm(e.nome) === chave);
      const cargas = ex ? (ex.series || []).filter((x) => x.feito && x.tipo !== 'aq' && x.carga != null).map((x) => x.carga) : [];
      return cargas.length ? { rot: formatarDataCurta(s.data), v: Math.max(...cargas) } : null;
    })
    .filter(Boolean)
    .slice(-30);
}

// Gráfico de linha simples, desenhado direto em SVG.
function grafico(pontos, unidade) {
  if (pontos.length < 2) return '';
  const W = 320; const H = 160; const px = 30; const py = 26;
  const vs = pontos.map((p) => p.v);
  let min = Math.min(...vs);
  let max = Math.max(...vs);
  if (min === max) { min -= 1; max += 1; }
  const folga = (max - min) * 0.15;
  min -= folga; max += folga;
  const x = (i) => px + ((W - 2 * px) * i) / (pontos.length - 1);
  const y = (v) => H - py - ((H - 2 * py) * (v - min)) / (max - min);
  const linha = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const iMax = vs.indexOf(Math.max(...vs));
  const rotulos = new Set([0, pontos.length - 1, iMax]);
  const textos = [...rotulos].map((i) => {
    const ancora = i === 0 ? 'start' : i === pontos.length - 1 ? 'end' : 'middle';
    return `<text x="${x(i).toFixed(1)}" y="${(y(pontos[i].v) - 8).toFixed(1)}" text-anchor="${ancora}" class="g-valor">${formatarNumero(pontos[i].v)}</text>`;
  }).join('');
  const bolas = pontos.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.5" class="g-ponto"/>`).join('');
  const resumo = `Gráfico de ${pontos.length} pontos, de ${formatarNumero(pontos[0].v)} a ${formatarNumero(pontos[pontos.length - 1].v)} ${unidade}`;
  return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escaparHtml(resumo)}">
    <line x1="${px}" y1="${H - py}" x2="${W - px}" y2="${H - py}" class="g-eixo"/>
    <path d="${linha}" class="g-linha" fill="none"/>${bolas}${textos}
    <text x="${px}" y="${H - 6}" text-anchor="start" class="g-rot">${pontos[0].rot}</text>
    <text x="${W - px}" y="${H - 6}" text-anchor="end" class="g-rot">${pontos[pontos.length - 1].rot}</text>
  </svg>`;
}

function blocoResumo() {
  const t = treinosNoPeriodo();
  const dieta = cumprimentoDieta();
  return `
  <section class="resumo">
    <div class="num-card"><strong>${t.semana}</strong><span>treinos na semana</span></div>
    <div class="num-card"><strong>${t.mes}</strong><span>treinos no mês</span></div>
    <div class="num-card"><strong>${dieta === null ? '—' : dieta + '%'}</strong><span>dieta em 7 dias</span></div>
  </section>`;
}

function blocoVolume() {
  const dias = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const str = dataLocal(d);
    dias.push({ str, v: volumeDoDia(str) });
  }
  const meta = metaVolume();
  const max = Math.max(1, meta || 0, ...dias.map((d) => d.v));
  const semana = dataLocal(segundaDaSemana());
  const totalSemana = estado.sessoes.filter((x) => x.data >= semana).reduce((n, x) => n + volumeSessao(x), 0);
  const W = 320; const H = 150; const base = H - 18;
  const larg = (W - 10) / 14;
  const barras = dias.map((d, i) => {
    const h = Math.round(((base - 6) * d.v) / max);
    const x = 5 + i * larg;
    const bateu = meta && d.v >= meta;
    return `<rect x="${(x + 2).toFixed(1)}" y="${base - h}" width="${(larg - 4).toFixed(1)}" height="${Math.max(h, d.v ? 2 : 0)}" rx="3" class="${bateu ? 'g-barra g-meta-ok' : 'g-barra'}"/>`
      + (i % 3 === 0 ? `<text x="${(x + larg / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle" class="g-rot">${formatarDataCurta(d.str)}</text>` : '');
  }).join('');
  const linhaMeta = meta ? `<line x1="0" x2="${W}" y1="${base - Math.round(((base - 6) * meta) / max)}" y2="${base - Math.round(((base - 6) * meta) / max)}" class="g-tracejado"/>` : '';
  return `
  <section class="card">
    <h2>Volume levantado</h2>
    <p class="grande">${Math.round(totalSemana).toLocaleString('pt-BR')} <small>kg nesta semana</small></p>
    ${dias.some((x) => x.v > 0)
    ? `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Volume dos últimos 14 dias">${linhaMeta}${barras}</svg>`
    : '<p class="mudo vazio-grafico">Quando você terminar um treino com carga e repetições, as barras aparecem aqui.</p>'}
    <button class="btn secundario cheio" type="button" data-acao="stats-abrir">Estatísticas completas ›</button>
    <p class="mudo peq">Últimos 14 dias.${meta ? ` Linha tracejada = meta de ${formatarVolume(meta)} por dia; barras acesas bateram a meta.` : ' Defina uma meta em Configurações para ver a linha.'}</p>
  </section>`;
}

function blocoCalorias() {
  const meta = metaMacros().kcal;
  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const str = dataLocal(d);
    dias.push({ str, v: Math.round(totaisDoDia(str).kcal) });
  }
  const max = Math.max(1, meta || 0, ...dias.map((d) => d.v));
  const W = 320; const H = 150; const base = H - 18;
  const larg = (W - 10) / 7;
  const barras = dias.map((d, i) => {
    const h = Math.round(((base - 6) * d.v) / max);
    const x = 5 + i * larg;
    return `<rect x="${(x + 4).toFixed(1)}" y="${base - h}" width="${(larg - 8).toFixed(1)}" height="${Math.max(h, d.v ? 2 : 0)}" rx="3" class="g-barra"/>`
      + `<text x="${(x + larg / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle" class="g-rot">${formatarDataCurta(d.str)}</text>`;
  }).join('');
  const yMeta = base - Math.round(((base - 6) * (meta || 0)) / max);
  const comDado = dias.filter((d) => d.v > 0);
  const media = comDado.length ? Math.round(comDado.reduce((n, d) => n + d.v, 0) / comDado.length) : 0;
  return `
  <section class="card larga cal-card">
    <div class="cal-info">
      <h2>Calorias</h2>
      <p class="grande">${media.toLocaleString('pt-BR')} <small>kcal por dia (média)</small></p>
      <p class="mudo peq">Últimos 7 dias.${meta ? ` Linha tracejada = meta de ${meta.toLocaleString('pt-BR')} kcal.` : ' Defina uma meta em Configurações para ver a linha.'}</p>
    </div>
    <div class="cal-graf">${comDado.length
    ? `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calorias dos últimos 7 dias">${meta ? `<line x1="0" x2="${W}" y1="${yMeta}" y2="${yMeta}" class="g-tracejado"/>` : ''}${barras}</svg>`
    : '<p class="mudo vazio-grafico">Anote o que você comeu na aba Dieta e o gráfico aparece aqui.</p>'}</div>
  </section>`;
}

function blocoGrupos() {
  const semana = dataLocal(segundaDaSemana());
  const cont = {};
  estado.sessoes.filter((x) => x.data >= semana).forEach((s) => (s.exercicios || []).forEach((e) => {
    if (e.cardio) return;
    const n = (e.series || []).filter((x) => x.feito && x.tipo !== 'aq').length;
    if (n) { const g = grupoDoExercicio(e.nome); cont[g] = (cont[g] || 0) + n; }
  }));
  const lista = Object.entries(cont).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...lista.map((x) => x[1]));
  return `
  <section class="card larga">
    <h2>Séries por músculo na semana</h2>
    ${lista.length
    ? lista.map(([g, n]) => `<div class="linha-barra"><span>${escaparHtml(g)}</span><div class="barra peq"><i style="width:${Math.round((n / max) * 100)}%"></i></div><strong>${n}</strong></div>`).join('')
    : '<p class="mudo vazio-grafico">Termine um treino nesta semana e as séries por músculo aparecem aqui (aquecimento não conta).</p>'}
  </section>`;
}

function blocoFotos() {
  return `
  <section class="card">
    <div class="card-topo"><h2>Fotos do corpo</h2><button class="btn pequeno" type="button" data-acao="fotos-abrir">Abrir</button></div>
    <p class="mudo peq">Guarde fotos para comparar antes e depois. Só você vê, a não ser que escolha compartilhar com seu personal.</p>
  </section>`;
}

function blocoCalendario() {
  const hoje = new Date();
  if (!mesVisto) mesVisto = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ano = mesVisto.getFullYear();
  const mes = mesVisto.getMonth();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const deslocamento = (new Date(ano, mes, 1).getDay() + 6) % 7; // semana começa na segunda
  const hojeStr = dataLocal();
  const celulas = [];
  for (let i = 0; i < deslocamento; i++) celulas.push('<span class="cal-vazio"></span>');
  for (let d = 1; d <= diasNoMes; d++) {
    const str = dataLocal(new Date(ano, mes, d));
    const dosDia = estado.sessoes.filter((x) => x.data === str);
    const classe = `cal-dia ${dosDia.length ? 'on' : ''} ${str === hojeStr ? 'hoje' : ''}`;
    celulas.push(dosDia.length
      ? `<button type="button" class="${classe}" data-acao="cal-dia" data-data="${str}" aria-label="Dia ${d}: ${dosDia.length} treino${dosDia.length === 1 ? '' : 's'}">${d}</button>`
      : `<span class="${classe}">${d}</span>`);
  }
  const treinosMes = estado.sessoes.filter((x) => String(x.data).startsWith(`${ano}-${String(mes + 1).padStart(2, '0')}`));
  const diasTreinados = new Set(treinosMes.map((x) => x.data)).size;
  const nomeMes = mesVisto.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const seq = sequenciaSemanas();
  return `
  <section class="card">
    <div class="card-topo">
      <button class="icone-peq" type="button" data-acao="cal-mes" data-passo="-1" aria-label="Mês anterior">‹</button>
      <h2 class="cal-titulo">${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}</h2>
      <button class="icone-peq" type="button" data-acao="cal-mes" data-passo="1" aria-label="Próximo mês">›</button>
    </div>
    <div class="cal-grade">${['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((l) => `<b>${l}</b>`).join('')}${celulas.join('')}</div>
    <p class="mudo peq">${diasTreinados} dia${diasTreinados === 1 ? '' : 's'} treinado${diasTreinados === 1 ? '' : 's'} neste mês.
    ${seq.semanas > 0 ? `🔥 Sequência: ${seq.semanas} semana${seq.semanas === 1 ? '' : 's'} seguida${seq.semanas === 1 ? '' : 's'} treinando ${seq.alvo} dia${seq.alvo === 1 ? '' : 's'}.` : `Meta da semana: treinar ${seq.alvo} dia${seq.alvo === 1 ? '' : 's'} (os dias que você marcou nos treinos).`}</p>
  </section>`;
}

function blocoPeso() {
  const asc = [...estado.peso].sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const ultimo = asc[asc.length - 1];
  const primeiro = asc[0];
  const dif = ultimo && primeiro && asc.length > 1 ? ultimo.kg - primeiro.kg : null;
  const lista = [...asc].reverse().slice(0, 12).map((p) => `
    <div class="linha-peso"><span>${formatarDataCurta(p.data)}</span><strong>${formatarNumero(p.kg)} kg</strong>
    <button type="button" class="icone-peq" data-acao="peso-excluir" data-id="${escaparHtml(p.id)}" aria-label="Apagar peso de ${formatarDataCurta(p.data)}">✕</button></div>`);
  return `
  <section class="card peso-card">
    <div class="card-topo"><h2>Peso corporal</h2><button class="btn pequeno" type="button" data-acao="peso-novo">+ Registrar</button></div>
    ${ultimo ? `<p class="grande">${formatarNumero(ultimo.kg)} <small>kg</small></p>
      ${dif !== null ? `<p class="mudo peq">${dif > 0 ? '+' : ''}${formatarNumero(dif)} kg desde o primeiro registro</p>` : ''}
      ${metaPeso() ? `<p class="mudo peq">Meta: <strong>${formatarNumero(metaPeso())} kg</strong> · ${Math.abs(ultimo.kg - metaPeso()) < 0.05 ? 'meta atingida 🎉' : `faltam ${formatarNumero(Math.abs(ultimo.kg - metaPeso()))} kg`}</p>` : ''}`
      : '<p class="mudo vazio-grafico">Nenhum peso registrado ainda.<br>Toque em “+ Registrar” para começar.</p>'}
    ${grafico(asc.slice(-30).map((p) => ({ rot: formatarDataCurta(p.data), v: p.kg })), 'kg') || (asc.length === 1 ? '<p class="mudo peq">Registre de novo outro dia para ver o gráfico.</p>' : '')}
    ${lista.length ? listaRecolhivel('peso', lista, { visiveis: 3, classe: 'lista-peso' }) : ''}
  </section>`;
}

const CAMPOS_MEDIDAS = [['peito', 'Peito'], ['cintura', 'Cintura'], ['quadril', 'Quadril'], ['braco', 'Braço'], ['coxa', 'Coxa'], ['panturrilha', 'Panturrilha']];

function blocoMedidas() {
  const asc = [...estado.medidas].sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const ultimaData = asc.length ? asc[asc.length - 1].data : null;
  const linhas = CAMPOS_MEDIDAS.map(([k, nome]) => {
    const com = asc.filter((m) => typeof m[k] === 'number');
    if (!com.length) return '';
    const atual = com[com.length - 1];
    const ant = com.length > 1 ? com[com.length - 2] : null;
    const dif = ant ? atual[k] - ant[k] : null;
    return `<div class="linha-medida"><span>${nome}</span><strong>${formatarNumero(atual[k])} cm</strong><small class="mudo">${dif === null ? '' : `${dif > 0 ? '+' : ''}${formatarNumero(dif)}`}</small></div>`;
  }).filter(Boolean);
  return `
  <section class="card">
    <div class="card-topo"><h2>Medidas do corpo</h2><button class="btn pequeno" type="button" data-acao="medidas-novo">+ Registrar</button></div>
    ${linhas.length ? `${listaRecolhivel('medidas', linhas, { visiveis: 4, classe: 'lista-medidas' })}
      <p class="mudo peq">Último registro: ${formatarDataCurta(ultimaData)}. O número pequeno é a diferença para o registro anterior.</p>
      <div class="acoes-card"><button class="link" type="button" data-acao="medidas-historico">Ver registros</button></div>`
      : '<p class="mudo vazio-grafico">Peito, cintura, quadril, braço, coxa e panturrilha.<br>Toque em “+ Registrar” para começar.</p>'}
  </section>`;
}

function barraConquista(c, grande = false) {
  const real = percentualConquista(c);
  const pct = Math.floor(real) < 1 ? 0 : real; // sem progresso (0%) = barra totalmente vazia
  return `<span class="conq-trilho ${grande ? 'grande' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(pct)}" aria-label="Progresso: ${escaparHtml(c.nome)}"><i style="width:${pct.toFixed(1)}%"></i></span>`;
}

function linhaConquista(c) {
  const pct = Math.floor(percentualConquista(c));
  if (c.ok) {
    return `<button type="button" class="conq-lin feita" data-acao="conquista-ver" data-n="${escaparHtml(c.nome)}">
      <span class="conq-topo">
        <span class="conq-ico" aria-hidden="true">${c.icone}</span>
        <span class="conq-nome"><b>${escaparHtml(c.nome)}</b><small>Conquistada</small></span>
        <span class="conq-check" aria-label="Conquistada">✓</span>
      </span>
    </button>`;
  }
  return `<button type="button" class="conq-lin" data-acao="conquista-ver" data-n="${escaparHtml(c.nome)}">
    <span class="conq-topo">
      <span class="conq-ico" aria-hidden="true">${c.icone}</span>
      <span class="conq-nome"><b>${escaparHtml(c.nome)}</b><small>${c.atual === null ? escaparHtml(c.desc) : escaparHtml(textoProgresso(c))}</small></span>
      ${c.atual === null ? '' : `<em class="conq-pct">${pct}%</em>`}
    </span>
    ${c.atual === null ? '' : barraConquista(c)}
  </button>`;
}

const textoContagemConquistas = () => { const l = conquistas(); return `${l.filter((c) => c.ok).length} de ${l.length}`; };

function blocoConquistas() {
  const lista = conquistas();
  const faltam = lista.filter((c) => !c.ok).sort((a, b) => percentualConquista(b) - percentualConquista(a));
  const feitas = lista.filter((c) => c.ok);
  const todas = [...faltam, ...feitas]; // as conquistadas (verdes) vêm depois das que estão em andamento
  const visiveis = conquistasTodas ? todas : todas.slice(0, 3);
  return `
  <section class="card conq-card">
    <div class="card-topo"><h2>Conquistas</h2><span class="selo">${textoContagemConquistas()}</span></div>
    <div class="conq-lista">${visiveis.map(linhaConquista).join('')}</div>
    ${todas.length > 3 ? `<button class="btn secundario cheio" type="button" data-acao="conquistas-todas">${conquistasTodas ? 'Mostrar menos' : `Ver mais (${todas.length - 3})`}</button>` : ''}
  </section>`;
}

function blocoExercicio() {
  const lista = exerciciosComCarga();
  if (!lista.length) {
    return `<section class="card"><h2>Carga por exercício</h2><p class="mudo vazio-grafico">Quando você terminar treinos com carga marcada, a evolução de cada exercício aparece aqui.</p></section>`;
  }
  if (!lista.some(([k]) => k === exercicioEscolhido)) exercicioEscolhido = lista[0][0];
  const pontos = pontosExercicio(exercicioEscolhido);
  const melhor = pontos.length ? Math.max(...pontos.map((p) => p.v)) : null;
  const ultimo = pontos.length ? pontos[pontos.length - 1].v : null;
  return `
  <section class="card ex-card">
    <div class="cal-info">
      <h2>Carga por exercício</h2>
      <label class="campo sem-margem">
        <select class="in" data-mudar="prog-exercicio" aria-label="Escolha o exercício">
          ${lista.map(([k, nome]) => `<option value="${escaparHtml(k)}" ${k === exercicioEscolhido ? 'selected' : ''}>${escaparHtml(nome)}</option>`).join('')}
        </select>
      </label>
      <p class="mudo peq">Maior carga de cada treino. Melhor: <strong>${formatarNumero(melhor)} kg</strong> · Último: <strong>${formatarNumero(ultimo)} kg</strong></p>
    </div>
    <div class="cal-graf">${grafico(pontos, 'kg') || '<p class="mudo peq">Faça esse exercício em mais um treino para ver o gráfico.</p>'}</div>
  </section>`;
}

function blocoHistorico() {
  const todas = [...estado.sessoes].sort((a, b) => String(b.fim || b.data).localeCompare(String(a.fim || a.data)));
  if (!todas.length) return `<section class="card"><p class="mudo">Seus treinos feitos aparecem aqui.</p></section>`;
  return `
  <section class="card hist-card">
    <div class="hist-lista">${todas.slice(0, 4).map(linhaSessao).join('')}</div>
    <button class="btn secundario cheio" type="button" data-acao="historico-abrir">Ver todos os treinos${todas.length > 4 ? ` (${todas.length})` : ''} ›</button>
  </section>`;
}

const secao = (titulo, sub = '') => `<div class="prog-sec"><h2>${titulo}</h2>${sub ? `<span>${sub}</span>` : ''}</div>`;

export const progresso = {
  render() {
    return `<div class="prog-compacto">
    <header class="topo topo-prog"><h1>Progresso</h1><button class="btn pequeno secundario" type="button" data-acao="stats-abrir">Estatísticas ›</button></header>
    ${blocoResumo()}
    ${secao('Treinos')}
    <div class="grade-cards">${blocoCalendario()}${blocoVolume()}</div>
    <div class="grade-cards">${blocoGrupos()}</div>
    <div class="grade-cards">${blocoExercicio()}${blocoConquistas()}</div>
    ${secao('Corpo')}
    <div class="grade-cards corpo">${blocoPeso()}${blocoMedidas()}${blocoFotos()}</div>
    ${secao('Alimentação')}
    <div class="grade-cards">${blocoCalorias()}</div>
    ${secao('Últimos treinos')}
    ${blocoHistorico()}</div>`;
  },
  mudancas: {
    'prog-exercicio': (el) => {
      exercicioEscolhido = el.value;
      nav.renderizar();
    }
  },
  acoes: {
    'fotos-abrir': () => abrirFotos({ uid: estado.uid, dono: true }),
    'conquistas-todas': () => { conquistasTodas = !conquistasTodas; nav.renderizar(); },
    'conquista-ver': (el) => {
      const c = conquistas().find((x) => x.nome === el.dataset.n);
      if (!c) return;
      const prog = c.ok ? '' : (c.atual === null ? '' : `${barraConquista(c, true)}<p class="conq-cont grande-cont"><span>${escaparHtml(textoProgresso(c))}</span><em>${Math.floor(percentualConquista(c))}%</em></p>`);
      abrirFolha(`<div class="conq-folha"><span class="conq-folha-ico ${c.ok ? 'ok' : ''}" aria-hidden="true">${c.icone}</span><h2>${escaparHtml(c.nome)}</h2><p>${c.ok ? '✅ Conquistada!' : '🔒 Ainda não.'}</p><p class="mudo">${escaparHtml(c.desc)}</p>${prog}</div><button class="btn cheio" type="button" data-fechar>Fechar</button>`);
    },
    'medidas-novo': () => {
      const ultimo = [...estado.medidas].sort((a, b) => String(b.data).localeCompare(String(a.data)))[0] || {};
      const f = abrirFolha(`
        <h2>Registrar medidas</h2>
        <label class="campo">Data<input class="in" type="date" data-f="data" value="${dataLocal()}" max="${dataLocal()}"></label>
        <p class="mudo peq">Em centímetros. Preencha só as que você mediu.</p>
        <div class="grade-medidas">
          ${CAMPOS_MEDIDAS.map(([k, nome]) => `<label class="campo">${nome} (cm)<input class="in" inputmode="decimal" data-m="${k}" placeholder="${typeof ultimo[k] === 'number' ? formatarNumero(ultimo[k]) : ''}"></label>`).join('')}
        </div>
        <p class="erro" data-erro role="alert"></p>
        <div class="linha-botoes"><button class="btn secundario" type="button" data-fechar>Cancelar</button><button class="btn" type="button" data-ed="salvar">Salvar</button></div>`, { classe: 'folha-alta' });
      f.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-ed="salvar"]')) return;
        const data = f.el.querySelector('[data-f="data"]').value;
        const erro = f.el.querySelector('[data-erro]');
        if (!data) { erro.textContent = 'Escolha a data.'; return; }
        const dados = { data, criadoEm: new Date().toISOString() };
        let algum = false;
        for (const [k, nome] of CAMPOS_MEDIDAS) {
          const t = f.el.querySelector(`[data-m="${k}"]`).value.trim();
          if (!t) continue;
          const n = numero(t);
          if (n === null || n < 5 || n > 300) { erro.textContent = `Valor inválido em ${nome}.`; return; }
          dados[k] = n; algum = true;
        }
        if (!algum) { erro.textContent = 'Preencha pelo menos uma medida.'; return; }
        // Um registro por dia; se já existe, junta com o que já estava salvo naquele dia.
        salvarDoc(estado.uid, 'medidas', data, dados, { merge: true });
        f.fechar();
        toast('Medidas registradas.');
      });
    },
    'medidas-historico': () => {
      const lista = [...estado.medidas].sort((a, b) => String(b.data).localeCompare(String(a.data)));
      abrirFolha(`<h2>Registros de medidas</h2>
        <div class="lista">${lista.map((m) => `<div class="linha-peso"><span>${formatarDataCurta(m.data)}</span><small class="mudo">${CAMPOS_MEDIDAS.filter(([k]) => typeof m[k] === 'number').map(([k, n]) => `${n} ${formatarNumero(m[k])}`).join(' · ')}</small>
          <button type="button" class="icone-peq" data-acao="medidas-excluir" data-id="${escaparHtml(m.id)}" aria-label="Apagar registro de ${formatarDataCurta(m.data)}">✕</button></div>`).join('')}</div>
        <button class="btn secundario cheio" type="button" data-fechar>Fechar</button>`);
    },
    'medidas-excluir': async (el) => {
      if (await confirmar('Apagar esse registro de medidas?', { ok: 'Apagar', perigo: true })) {
        removerDoc(estado.uid, 'medidas', el.dataset.id);
        document.querySelectorAll('.folha-fundo').forEach((x) => x.remove());
        document.body.classList.remove('sem-rolagem');
      }
    },
    'cal-mes': (el) => {
      mesVisto = new Date(mesVisto.getFullYear(), mesVisto.getMonth() + Number(el.dataset.passo), 1);
      nav.renderizar();
    },
    'cal-dia': (el) => {
      const lista = estado.sessoes.filter((x) => x.data === el.dataset.data);
      if (lista.length === 1) { progresso.acoes['sessao-ver']({ dataset: { id: lista[0].id } }); return; }
      abrirFolha(`<h2>${formatarDataCurta(el.dataset.data)}</h2><div class="lista">${lista.map((x) => `<button type="button" class="regra-linha" data-acao="sessao-ver" data-id="${escaparHtml(x.id)}"><span>${escaparHtml(x.treinoNome)}</span><span class="seta" aria-hidden="true">›</span></button>`).join('')}</div><button class="btn secundario cheio" type="button" data-fechar>Fechar</button>`);
    },
    'peso-novo': () => {
      const f = abrirFolha(`
        <h2>Registrar peso</h2>
        <label class="campo">Data<input class="in" type="date" data-f="data" value="${dataLocal()}" max="${dataLocal()}"></label>
        <label class="campo">Peso (kg)<input class="in" inputmode="decimal" data-f="kg" placeholder="Digite seu peso"></label>
        <p class="erro" data-erro role="alert"></p>
        <div class="linha-botoes"><button class="btn secundario" type="button" data-fechar>Cancelar</button><button class="btn" type="button" data-ed="salvar">Salvar</button></div>`);
      f.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-ed="salvar"]')) return;
        const data = f.el.querySelector('[data-f="data"]').value;
        const kg = numero(f.el.querySelector('[data-f="kg"]').value);
        const erro = f.el.querySelector('[data-erro]');
        if (!data) { erro.textContent = 'Escolha a data.'; return; }
        if (kg === null || kg < 20 || kg > 400) { erro.textContent = 'Digite um peso válido, em quilos.'; return; }
        // Um registro por dia: salvar de novo no mesmo dia troca o valor.
        salvarDoc(estado.uid, 'peso', data, { data, kg, criadoEm: new Date().toISOString() });
        f.fechar();
        toast('Peso registrado.');
      });
    },
    'peso-excluir': async (el) => {
      if (await confirmar('Apagar esse registro de peso?', { ok: 'Apagar', perigo: true })) removerDoc(estado.uid, 'peso', el.dataset.id);
    },
    'sessao-ver': (el) => {
      const s = estado.sessoes.find((x) => x.id === el.dataset.id);
      if (!s) return;
      const blocos = (s.exercicios || []).map((e) => {
        if (e.cardio) return `<div class="det-ex"><strong>${escaparHtml(e.nome)}</strong> <span class="selo">cardio</span><p class="mudo peq">${e.feito ? `${formatarNumero(e.minutos)} min` : 'Não marcado como feito'}</p></div>`;
        const feitas = (e.series || []).filter((x) => x.feito);
        const rot = { aq: ' (aquecimento)', dr: ' (drop)', fa: ' (falha)' };
        return `<div class="det-ex"><strong>${escaparHtml(e.nome)}</strong>
          <p class="mudo peq">${feitas.length ? feitas.map((x) => `${x.carga != null ? formatarNumero(x.carga) + ' kg' : '—'} × ${x.reps != null ? formatarNumero(x.reps) : '—'}${rot[x.tipo] || ''}`).join(' · ') : 'Nenhuma série marcada'}</p></div>`;
      }).join('');
      const f = abrirFolha(`
        <h2>${escaparHtml(s.treinoNome)}</h2>
        <p class="mudo peq">${parseData(s.data).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}${s.duracaoMin ? ` · ${s.duracaoMin} min` : ''}</p>
        <p><strong>${Math.round(volumeSessao(s)).toLocaleString('pt-BR')} kg</strong> <span class="mudo">levantados no treino</span></p>
        ${(s.recordes || []).length ? `<p class="ultima">🏆 Recordes: ${s.recordes.map((r) => `${escaparHtml(r.nome)} (${formatarNumero(r.carga)} kg)`).join(', ')}</p>` : ''}
        ${s.nota ? `<p class="obs">${escaparHtml(s.nota)}</p>` : ''}
        ${blocos}
        <div class="linha-botoes"><button class="btn perigo-claro" type="button" data-ed="excluir">Excluir treino feito</button><button class="btn secundario" type="button" data-fechar>Fechar</button></div>`);
      f.el.addEventListener('click', async (e) => {
        if (!e.target.closest('[data-ed="excluir"]')) return;
        if (await confirmar('Excluir esse treino do histórico?', { ok: 'Excluir', perigo: true })) {
          removerDoc(estado.uid, 'sessoes', s.id);
          f.fechar();
        }
      });
    }
  }
};
