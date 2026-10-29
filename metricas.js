// Contas do app: volume levantado, recordes e sequência de semanas.
import { estado } from './estado.js';
import { dataLocal, segundaDaSemana, parseData } from './util.js';
import { diaPerfeito as dietaPerfeita, analisarDia } from './dietaplano.js';

export const norm = (s) => String(s || '').trim().toLowerCase();

// Volume = soma de (carga × repetições) das séries feitas. Exercício sem carga (peso do corpo) conta 0.
export function volumeDasSeries(exercicios) {
  let v = 0;
  (exercicios || []).forEach((e) => (e.series || []).forEach((s) => {
    if (s.feito && s.tipo !== 'aq' && s.carga != null && s.reps != null) v += s.carga * s.reps;
  }));
  return Math.round(v * 10) / 10;
}

export const volumeSessao = (s) => (typeof s.volume === 'number' ? s.volume : volumeDasSeries(s.exercicios));

export function volumeDoDia(data) {
  return estado.sessoes.filter((s) => s.data === data).reduce((n, s) => n + volumeSessao(s), 0);
}

// Maior carga já feita num exercício (antes de agora). null = nunca fez com carga.
export function maiorCargaAntes(nome) {
  const k = norm(nome);
  let max = null;
  estado.sessoes.forEach((s) => (s.exercicios || []).forEach((e) => {
    if (norm(e.nome) !== k) return;
    (e.series || []).forEach((x) => { if (x.feito && x.tipo !== 'aq' && x.carga != null && (max === null || x.carga > max)) max = x.carga; });
  }));
  return max;
}

// Se eu tenho personal, as metas vêm dele; senão, são as minhas (Perfil).
const fonteMetas = () => (estado.vinculo ? estado.metasConfig : estado.perfil) || {};

// Metas de calorias e macros (kcal e gramas por dia). Cada uma é opcional.
export const metaMacros = () => {
  const f = fonteMetas();
  const g = (k) => (typeof f[k] === 'number' && f[k] > 0 ? f[k] : null);
  return { kcal: g('metaKcal'), prot: g('metaProt'), carb: g('metaCarb'), gord: g('metaGord') };
};

export const metaVolume = () => {
  const m = fonteMetas().metaVolume;
  return typeof m === 'number' && m > 0 ? m : null;
};
export const metaAgua = () => {
  const m = fonteMetas().metaAgua;
  return typeof m === 'number' && m > 0 ? m : null;
};

export const aguaDoDia = (data = dataLocal()) => {
  const a = estado.agua.find((x) => x.data === data);
  return a && typeof a.ml === 'number' ? a.ml : 0;
};

// Sequência: semanas seguidas em que você treinou em tantos dias quanto os dias que marcou nos seus treinos
// (mínimo 1). A semana atual só quebra a sequência quando acabar.
export function sequenciaSemanas() {
  const diasPlano = new Set();
  estado.treinos.forEach((t) => (t.dias || []).forEach((d) => diasPlano.add(d)));
  const alvo = Math.max(1, diasPlano.size);
  const diasPorSemana = new Map();
  estado.sessoes.forEach((s) => {
    const [a, m, d] = String(s.data).split('-').map(Number);
    const seg = dataLocal(segundaDaSemana(new Date(a, m - 1, d)));
    if (!diasPorSemana.has(seg)) diasPorSemana.set(seg, new Set());
    diasPorSemana.get(seg).add(s.data);
  });
  const bateu = (seg) => (diasPorSemana.get(seg) || new Set()).size >= alvo;
  let seg = segundaDaSemana();
  let n = bateu(dataLocal(seg)) ? 1 : 0;
  seg.setDate(seg.getDate() - 7);
  while (bateu(dataLocal(seg))) { n++; seg.setDate(seg.getDate() - 7); }
  return { semanas: n, alvo };
}

export const formatarVolume = (kg) => `${Math.round(kg).toLocaleString('pt-BR')} kg`;

export const metaPeso = () => {
  const m = fonteMetas().metaPeso;
  return typeof m === 'number' && m > 0 ? m : null;
};


// ---------- Estatísticas de carga acumulada (soma de kg levantados) ----------
export const MARCOS_VOLUME = [10000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000];

const somaMapa = (mapa, pred) => { let n = 0; mapa.forEach((v, k) => { if (pred(k)) n += v; }); return n; };

// Tudo calculado na hora a partir dos treinos feitos (nada é guardado à parte).
export function estatisticasVolume(agora = new Date()) {
  const sess = estado.sessoes;
  const porDia = new Map();
  sess.forEach((s) => porDia.set(s.data, (porDia.get(s.data) || 0) + volumeSessao(s)));

  const hojeStr = dataLocal(agora);
  const segunda = segundaDaSemana(agora);
  const segStr = dataLocal(segunda);
  const antes = new Date(segunda); antes.setDate(antes.getDate() - 7);
  const spStr = dataLocal(antes);
  const mes = hojeStr.slice(0, 7);
  const mesPassado = dataLocal(new Date(agora.getFullYear(), agora.getMonth() - 1, 1)).slice(0, 7);

  // Totais por semana (chave = segunda-feira) e por mês (chave = AAAA-MM).
  const porSemana = new Map();
  const porMes = new Map();
  porDia.forEach((v, d) => {
    const k = dataLocal(segundaDaSemana(parseData(d)));
    porSemana.set(k, (porSemana.get(k) || 0) + v);
    porMes.set(d.slice(0, 7), (porMes.get(d.slice(0, 7)) || 0) + v);
  });

  const semanas = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(segunda); d.setDate(d.getDate() - 7 * i);
    const k = dataLocal(d);
    semanas.push({ chave: k, v: porSemana.get(k) || 0, atual: i === 0 });
  }
  const meses = [];
  for (let i = 11; i >= 0; i--) {
    const k = dataLocal(new Date(agora.getFullYear(), agora.getMonth() - i, 1)).slice(0, 7);
    meses.push({ chave: k, v: porMes.get(k) || 0, atual: i === 0 });
  }

  const melhor = (mapa) => { let b = null; mapa.forEach((v, k) => { if (v > 0 && (!b || v > b.v)) b = { chave: k, v }; }); return b; };
  const total = somaMapa(porDia, () => true);
  const comCarga = sess.filter((s) => volumeSessao(s) > 0).length;
  const datas = sess.map((s) => s.data).filter(Boolean).sort();
  const marco = MARCOS_VOLUME.find((m) => m > total) || null;
  const marcoAnterior = [...MARCOS_VOLUME].reverse().find((m) => m <= total) || 0;

  return {
    hoje: porDia.get(hojeStr) || 0,
    semana: somaMapa(porDia, (d) => d >= segStr && d <= hojeStr),
    semanaPassada: somaMapa(porDia, (d) => d >= spStr && d < segStr),
    mes: porMes.get(mes) || 0,
    mesPassado: porMes.get(mesPassado) || 0,
    total,
    treinos: sess.length,
    treinosSemana: sess.filter((s) => s.data >= segStr && s.data <= hojeStr).length,
    treinosMes: sess.filter((s) => String(s.data).startsWith(mes)).length,
    mediaPorTreino: comCarga ? total / comCarga : 0,
    primeiroTreino: datas[0] || null,
    melhorDia: melhor(porDia),
    melhorSemana: melhor(porSemana),
    melhorMes: melhor(porMes),
    semanas,
    meses,
    marco,
    marcoAnterior
  };
}

export const formatarToneladas = (kg) => `${(kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t`;

// Conquistas: calculadas na hora a partir dos seus dados (nada é guardado à parte).
export function conquistas() {
  const sess = estado.sessoes;
  const nTreinos = sess.length;
  const nRecordes = sess.reduce((n, s) => n + (s.recordes || []).length, 0);
  const volTotal = sess.reduce((n, s) => n + volumeSessao(s), 0);
  const diasVol = new Map();
  sess.forEach((s) => diasVol.set(s.data, (diasVol.get(s.data) || 0) + volumeSessao(s)));
  const maxDia = Math.max(0, ...diasVol.values());
  const mv = metaVolume();
  const ma = metaAgua();
  const maxAgua = Math.max(0, ...estado.agua.map((a) => a.ml || 0));
  const seq = sequenciaSemanas().semanas;
  const maxSessao = Math.max(0, ...sess.map(volumeSessao));
  const maxDuracao = Math.max(0, ...sess.map((s) => s.duracaoMin || 0));
  const diasPorSemana = new Map();
  sess.forEach((s) => {
    if (!s.data) return;
    const k = dataLocal(segundaDaSemana(parseData(s.data)));
    if (!diasPorSemana.has(k)) diasPorSemana.set(k, new Set());
    diasPorSemana.get(k).add(s.data);
  });
  const maxDiasSemana = Math.max(0, ...[...diasPorSemana.values()].map((d) => d.size));
  const diasAguaOk = ma ? estado.agua.filter((a) => a.ml >= ma).length : 0;
  const nPlano = estado.dietaItens.length;
  const diaPerfeito = estado.refeicoes.some((r) => dietaPerfeita(estado.dietaItens, r.itens));
  const melhorDiaDieta = nPlano ? Math.max(0, ...estado.refeicoes.map((r) => analisarDia(estado.dietaItens, r.itens || []).feitos)) : null;

  // c(ícone, nome, descrição, atual, alvo, formato). atual = null quando não dá para medir (ex.: falta definir a meta).
  const c = (icone, nome, desc, atual, alvo, fmt = 'n', unidade = '') => {
    const ok = atual !== null && atual >= alvo;
    return { icone, nome, desc, ok, atual: atual === null ? null : Math.min(atual, alvo), alvo, fmt, unidade };
  };
  const L = [
    c('🏁', 'Primeiro treino', 'Termine 1 treino', nTreinos, 1, 'n', 'treino'),
    c('💪', '10 treinos', 'Termine 10 treinos', nTreinos, 10, 'n', 'treinos'),
    c('🥇', '25 treinos', 'Termine 25 treinos', nTreinos, 25, 'n', 'treinos'),
    c('🔥', '50 treinos', 'Termine 50 treinos', nTreinos, 50, 'n', 'treinos'),
    c('👑', '100 treinos', 'Termine 100 treinos', nTreinos, 100, 'n', 'treinos'),
    c('🏆', 'Primeiro recorde', 'Bata um recorde de carga', nRecordes, 1, 'n', 'recorde'),
    c('🚀', '10 recordes', 'Bata 10 recordes de carga', nRecordes, 10, 'n', 'recordes'),
    c('⚖️', '10 mil kg num dia', 'Levante 10.000 kg em um dia', maxDia, 10000, 'kg'),
    c('🎯', 'Meta de volume', 'Bata sua meta de volume do dia (defina em Configurações)', mv ? maxDia : null, mv || 1, 'kg'),
    c('🧱', '5 mil kg num treino', 'Levante 5.000 kg em um único treino', maxSessao, 5000, 'kg'),
    c('🏋️', '100 mil kg no total', 'Some 100.000 kg levantados', volTotal, 100000, 'kg'),
    c('🏔️', '500 mil kg no total', 'Some 500.000 kg levantados', volTotal, 500000, 'kg'),
    c('🌋', '1 milhão de kg', 'Some 1.000.000 kg levantados (1.000 toneladas)', volTotal, 1000000, 'kg'),
    c('⏱️', 'Treino de 1 hora', 'Faça um treino com 60 minutos ou mais', maxDuracao, 60, 'n', 'min'),
    c('🔆', 'Semana cheia', 'Treine em 5 dias diferentes na mesma semana', maxDiasSemana, 5, 'n', 'dias'),
    c('📅', '2 semanas seguidas', 'Cumpra seus dias de treino 2 semanas seguidas', seq, 2, 'n', 'semanas'),
    c('🗓️', '4 semanas seguidas', 'Cumpra seus dias de treino 4 semanas seguidas', seq, 4, 'n', 'semanas'),
    c('💧', 'Meta de água', 'Bata sua meta de água em um dia (defina em Configurações)', ma ? maxAgua : null, ma || 1, 'litros'),
    c('🌊', '7 dias de água', 'Bata sua meta de água em 7 dias (defina a meta em Configurações)', ma ? diasAguaOk : null, 7, 'n', 'dias'),
    c('🥗', 'Dia perfeito', 'Marque todos os itens da dieta num dia, sem passar do previsto', diaPerfeito ? nPlano : melhorDiaDieta, nPlano || 1, 'n', 'itens'),
    c('📏', 'Medidas em dia', 'Registre suas medidas do corpo', Math.min(estado.medidas.length, 1), 1, 'n', 'registro'),
    // Desafios de longo prazo (difíceis de propósito)
    c('🦾', '500 treinos', 'Termine 500 treinos. Anos de dedicação.', nTreinos, 500, 'n', 'treinos'),
    c('🏛️', '1.000 treinos', 'Termine 1.000 treinos. Lenda da academia.', nTreinos, 1000, 'n', 'treinos'),
    c('💎', '100 recordes', 'Bata 100 recordes de carga. Você nunca para de evoluir.', nRecordes, 100, 'n', 'recordes'),
    c('🏗️', '15 mil kg num treino', 'Levante 15.000 kg em um único treino. Um treino de monstro.', maxSessao, 15000, 'kg'),
    c('🌍', '5 milhões de kg', 'Some 5.000.000 kg levantados (5.000 toneladas).', volTotal, 5000000, 'kg'),
    c('🪐', '10 milhões de kg', 'Some 10.000.000 kg levantados (10.000 toneladas). O topo.', volTotal, 10000000, 'kg'),
    c('⛓️', '24 semanas seguidas', 'Cumpra seus dias de treino por 24 semanas seguidas (6 meses sem falhar).', seq, 24, 'n', 'semanas')
  ];
  return L;
}

// Texto do contador de progresso: "45.000 / 100.000 kg".
export function textoProgresso(c) {
  if (c.atual === null) return '';
  const n = (v) => (c.fmt === 'litros' ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : Math.round(v).toLocaleString('pt-BR'));
  const un = c.fmt === 'kg' ? 'kg' : c.fmt === 'litros' ? 'L' : c.unidade;
  return `${n(c.atual)} / ${n(c.alvo)} ${un}`.trim();
}
export const percentualConquista = (c) => (c.atual === null ? 0 : Math.max(0, Math.min(100, (c.atual / c.alvo) * 100)));
