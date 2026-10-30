// Gráficos de evolução do aluno (para o personal): peso e carga por exercício.
import { escaparHtml, formatarNumero, formatarDataCurta } from './util.js';
import { norm } from './metricas.js';

// Gráfico de linha simples, desenhado direto em SVG.
export function grafico(pontos, unidade) {
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

export function pontosPeso(peso) {
  return [...peso].sort((a, b) => String(a.data).localeCompare(String(b.data)))
    .filter((p) => typeof p.kg === 'number').slice(-30)
    .map((p) => ({ rot: formatarDataCurta(p.data), v: p.kg }));
}

export function exerciciosComCarga(sessoes) {
  const mapa = new Map();
  sessoes.forEach((s) => (s.exercicios || []).forEach((e) => {
    if ((e.series || []).some((x) => x.feito && x.carga != null)) {
      const k = norm(e.nome);
      if (k && !mapa.has(k)) mapa.set(k, e.nome);
    }
  }));
  return [...mapa];
}

export function pontosExercicio(sessoes, chave) {
  return [...sessoes]
    .sort((a, b) => String(a.data).localeCompare(String(b.data)) || String(a.fim || '').localeCompare(String(b.fim || '')))
    .map((s) => {
      const ex = (s.exercicios || []).find((e) => norm(e.nome) === chave);
      const cargas = ex ? (ex.series || []).filter((x) => x.feito && x.tipo !== 'aq' && x.carga != null).map((x) => x.carga) : [];
      return cargas.length ? { rot: formatarDataCurta(s.data), v: Math.max(...cargas) } : null;
    })
    .filter(Boolean)
    .slice(-30);
}

// Cartões "Evolução" da ficha do aluno. escolhido = chave do exercício mostrado no gráfico de carga.
export function cartoesEvolucao(dados, escolhido) {
  const pesos = pontosPeso(dados.peso);
  const lista = exerciciosComCarga(dados.sessoes);
  const chave = lista.some(([k]) => k === escolhido) ? escolhido : (lista[0] ? lista[0][0] : '');
  const pts = chave ? pontosExercicio(dados.sessoes, chave) : [];
  const melhor = pts.length ? Math.max(...pts.map((p) => p.v)) : null;
  return `
  <section class="card">
    <h2>Evolução do peso</h2>
    ${pesos.length >= 2 ? `${grafico(pesos, 'kg')}<p class="mudo peq">De ${formatarNumero(pesos[0].v)} kg para ${formatarNumero(pesos[pesos.length - 1].v)} kg (${pesos[pesos.length - 1].v - pesos[0].v > 0 ? '+' : ''}${formatarNumero(Math.round((pesos[pesos.length - 1].v - pesos[0].v) * 10) / 10)} kg).</p>` : '<p class="mudo vazio-grafico">Quando ele registrar o peso 2 vezes ou mais, o gráfico aparece aqui.</p>'}
  </section>
  <section class="card ex-card">
    <h2>Carga por exercício</h2>
    ${lista.length ? `<label class="campo">Exercício<select class="in" data-mudar="p-ex-grafico">${lista.map(([k, n]) => `<option value="${escaparHtml(k)}" ${k === chave ? 'selected' : ''}>${escaparHtml(n)}</option>`).join('')}</select></label>
      ${pts.length >= 2 ? `${grafico(pts, 'kg')}<p class="mudo peq">Maior carga: <strong>${formatarNumero(melhor)} kg</strong> · ${pts.length} treinos com este exercício.</p>` : '<p class="mudo vazio-grafico">Ainda tem pouco treino com este exercício para desenhar o gráfico.</p>'}`
      : '<p class="mudo vazio-grafico">Quando ele terminar treinos com carga marcada, a evolução de cada exercício aparece aqui.</p>'}
  </section>`;
}
