// Contas do app: volume levantado, recordes e sequência de semanas.
import { estado } from './estado.js';
import { dataLocal, segundaDaSemana } from './util.js';

export const norm = (s) => String(s || '').trim().toLowerCase();

// Volume = soma de (carga × repetições) das séries feitas. Exercício sem carga (peso do corpo) conta 0.
export function volumeDasSeries(exercicios) {
  let v = 0;
  (exercicios || []).forEach((e) => (e.series || []).forEach((s) => {
    if (s.feito && s.carga != null && s.reps != null) v += s.carga * s.reps;
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
    (e.series || []).forEach((x) => { if (x.feito && x.carga != null && (max === null || x.carga > max)) max = x.carga; });
  }));
  return max;
}

export const metaVolume = () => {
  const m = estado.perfil && estado.perfil.metaVolume;
  return typeof m === 'number' && m > 0 ? m : null;
};
export const metaAgua = () => {
  const m = estado.perfil && estado.perfil.metaAgua;
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
