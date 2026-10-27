// Aba Progresso: resumo, peso corporal, evolução de carga por exercício e histórico.
import { estado } from './estado.js';
import { abrirFolha, confirmar } from './folha.js';
import {
  escaparHtml, dataLocal, parseData, formatarDataCurta, formatarNumero, numero, toast, segundaDaSemana
} from './util.js';
import { salvarDoc, removerDoc } from './dados.js';
import { nav } from './nav.js';

let exercicioEscolhido = '';
const norm = (s) => String(s || '').trim().toLowerCase();

function treinosNoPeriodo() {
  const semana = dataLocal(segundaDaSemana());
  const mes = dataLocal().slice(0, 7);
  return {
    semana: estado.sessoes.filter((s) => s.data >= semana).length,
    mes: estado.sessoes.filter((s) => String(s.data).startsWith(mes)).length
  };
}

// Porcentagem das regras da dieta marcadas nos últimos 7 dias.
function cumprimentoDieta() {
  let total = 0;
  let feitas = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dia = dataLocal(d);
    const fds = d.getDay() === 0 || d.getDay() === 6;
    const regras = estado.regras.filter((r) => {
      if (r.criadoEm && dataLocal(new Date(r.criadoEm)) > dia) return false;
      return r.grupo === 'sempre' || r.grupo === (fds ? 'fds' : 'semana');
    });
    const c = estado.checks.find((x) => x.data === dia);
    total += regras.length;
    feitas += regras.filter((r) => c && c.feitas && c.feitas[r.id]).length;
  }
  return total ? Math.round((feitas / total) * 100) : null;
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
      const cargas = ex ? (ex.series || []).filter((x) => x.feito && x.carga != null).map((x) => x.carga) : [];
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

function blocoPeso() {
  const asc = [...estado.peso].sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const ultimo = asc[asc.length - 1];
  const primeiro = asc[0];
  const dif = ultimo && primeiro && asc.length > 1 ? ultimo.kg - primeiro.kg : null;
  const lista = [...asc].reverse().slice(0, 6).map((p) => `
    <div class="linha-peso"><span>${formatarDataCurta(p.data)}</span><strong>${formatarNumero(p.kg)} kg</strong>
    <button type="button" class="icone-peq" data-acao="peso-excluir" data-id="${escaparHtml(p.id)}" aria-label="Apagar peso de ${formatarDataCurta(p.data)}">✕</button></div>`).join('');
  return `
  <section class="card">
    <div class="card-topo"><h2>Peso corporal</h2><button class="btn pequeno" type="button" data-acao="peso-novo">+ Registrar</button></div>
    ${ultimo ? `<p class="grande">${formatarNumero(ultimo.kg)} <small>kg</small></p>
      ${dif !== null ? `<p class="mudo peq">${dif > 0 ? '+' : ''}${formatarNumero(dif)} kg desde o primeiro registro</p>` : ''}`
      : '<p class="mudo">Nenhum peso registrado ainda.</p>'}
    ${grafico(asc.slice(-30).map((p) => ({ rot: formatarDataCurta(p.data), v: p.kg })), 'kg') || (asc.length === 1 ? '<p class="mudo peq">Registre de novo outro dia para ver o gráfico.</p>' : '')}
    ${lista ? `<div class="lista-peso">${lista}</div>` : ''}
  </section>`;
}

function blocoExercicio() {
  const lista = exerciciosComCarga();
  if (!lista.length) {
    return `<section class="card"><h2>Carga por exercício</h2><p class="mudo">Quando você terminar treinos com carga marcada, a evolução de cada exercício aparece aqui.</p></section>`;
  }
  if (!lista.some(([k]) => k === exercicioEscolhido)) exercicioEscolhido = lista[0][0];
  const pontos = pontosExercicio(exercicioEscolhido);
  const melhor = pontos.length ? Math.max(...pontos.map((p) => p.v)) : null;
  const ultimo = pontos.length ? pontos[pontos.length - 1].v : null;
  return `
  <section class="card">
    <h2>Carga por exercício</h2>
    <label class="campo sem-margem">
      <select class="in" data-mudar="prog-exercicio" aria-label="Escolha o exercício">
        ${lista.map(([k, nome]) => `<option value="${escaparHtml(k)}" ${k === exercicioEscolhido ? 'selected' : ''}>${escaparHtml(nome)}</option>`).join('')}
      </select>
    </label>
    <p class="mudo peq">Maior carga de cada treino. Melhor: <strong>${formatarNumero(melhor)} kg</strong> · Último: <strong>${formatarNumero(ultimo)} kg</strong></p>
    ${grafico(pontos, 'kg') || '<p class="mudo peq">Faça esse exercício em mais um treino para ver o gráfico.</p>'}
  </section>`;
}

function blocoHistorico() {
  const lista = [...estado.sessoes]
    .sort((a, b) => String(b.fim || b.data).localeCompare(String(a.fim || a.data)))
    .slice(0, 10);
  if (!lista.length) return `<section class="card"><h2>Histórico</h2><p class="mudo">Seus treinos feitos aparecem aqui.</p></section>`;
  return `
  <section class="card">
    <h2>Últimos treinos</h2>
    <div class="lista">
      ${lista.map((s) => {
        const feitas = (s.exercicios || []).reduce((n, e) => n + (e.series || []).filter((x) => x.feito).length, 0);
        return `<button type="button" class="regra-linha" data-acao="sessao-ver" data-id="${escaparHtml(s.id)}">
          <small class="hora">${formatarDataCurta(s.data)}</small>
          <span>${escaparHtml(s.treinoNome)}<br><small class="mudo">${feitas} séries${s.duracaoMin ? ` · ${s.duracaoMin} min` : ''}</small></span>
          <span class="seta" aria-hidden="true">›</span></button>`;
      }).join('')}
    </div>
  </section>`;
}

export const progresso = {
  render() {
    return `
    <header class="topo"><h1>Progresso</h1></header>
    ${blocoResumo()}${blocoPeso()}${blocoExercicio()}${blocoHistorico()}`;
  },
  mudancas: {
    'prog-exercicio': (el) => {
      exercicioEscolhido = el.value;
      nav.renderizar();
    }
  },
  acoes: {
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
        const feitas = (e.series || []).filter((x) => x.feito);
        return `<div class="det-ex"><strong>${escaparHtml(e.nome)}</strong>
          <p class="mudo peq">${feitas.length ? feitas.map((x) => `${x.carga != null ? formatarNumero(x.carga) + ' kg' : '—'} × ${x.reps != null ? formatarNumero(x.reps) : '—'}`).join(' · ') : 'Nenhuma série marcada'}</p></div>`;
      }).join('');
      const f = abrirFolha(`
        <h2>${escaparHtml(s.treinoNome)}</h2>
        <p class="mudo peq">${parseData(s.data).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}${s.duracaoMin ? ` · ${s.duracaoMin} min` : ''}</p>
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
