// Tela "Histórico de treinos": todos os treinos feitos, agrupados por mês, com carga levantada em cada dia.
import { estado } from './estado.js';
import { escaparHtml, parseData, formatarNumero, DIAS_CURTOS } from './util.js';
import { volumeSessao } from './metricas.js';
import { nav } from './nav.js';

const kg = (n) => Math.round(n).toLocaleString('pt-BR');
const nomeMes = (chave) => {
  const t = parseData(`${chave}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function resumoSessao(s) {
  const exs = s.exercicios || [];
  const series = exs.reduce((n, e) => n + (e.series || []).filter((x) => x.feito).length, 0);
  const cardio = exs.reduce((n, e) => n + (e.cardio && e.feito && e.minutos ? e.minutos : 0), 0);
  const vol = volumeSessao(s);
  const partes = [];
  if (series || !cardio) partes.push(`${series} ${series === 1 ? 'série' : 'séries'}`);
  if (cardio) partes.push(`cardio ${formatarNumero(cardio)} min`);
  if (s.duracaoMin) partes.push(`${s.duracaoMin} min`);
  if ((s.recordes || []).length) partes.push('🏆');
  return { texto: partes.join(' · '), vol };
}

export function linhaSessao(s) {
  const d = parseData(s.data);
  const { texto, vol } = resumoSessao(s);
  return `<button type="button" class="hist-lin" data-acao="sessao-ver" data-id="${escaparHtml(s.id)}">
    <span class="hist-dia"><small>${DIAS_CURTOS[d.getDay()]}</small><b>${String(d.getDate()).padStart(2, '0')}</b></span>
    <span class="hist-info"><b>${escaparHtml(s.treinoNome)}</b><small>${escaparHtml(texto)}</small></span>
    <span class="hist-kg">${vol > 0 ? `${kg(vol)} <small>kg</small>` : ''}</span>
  </button>`;
}

export const historico = {
  render() {
    const cab = `<header class="topo topo-sub">
      <button type="button" class="voltar" data-acao="voltar" aria-label="Voltar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
      <h1>Histórico de treinos</h1></header>`;
    const lista = [...estado.sessoes].sort((a, b) => String(b.fim || b.data).localeCompare(String(a.fim || a.data)));
    if (!lista.length) return `${cab}<section class="card"><p class="mudo">Seus treinos feitos aparecem aqui.</p></section>`;
    const total = lista.reduce((n, s) => n + volumeSessao(s), 0);
    const meses = new Map();
    lista.forEach((s) => { const k = String(s.data).slice(0, 7); if (!meses.has(k)) meses.set(k, []); meses.get(k).push(s); });
    const blocos = [...meses].map(([k, itens]) => {
      const vol = itens.reduce((n, s) => n + volumeSessao(s), 0);
      return `<section class="card hist-mes">
        <div class="card-topo"><h2>${escaparHtml(nomeMes(k))}</h2><span class="mudo peq">${itens.length} ${itens.length === 1 ? 'treino' : 'treinos'} · ${kg(vol)} kg</span></div>
        <div class="hist-lista">${itens.map(linhaSessao).join('')}</div>
      </section>`;
    }).join('');
    return `${cab}
    <p class="mudo peq hist-resumo">${lista.length} ${lista.length === 1 ? 'treino feito' : 'treinos feitos'} · ${kg(total)} kg levantados no total. Toque em um treino para ver todos os exercícios, cargas e repetições.</p>
    ${blocos}`;
  },
  acoes: {
    'historico-abrir': () => nav.irPara('historico')
  }
};
