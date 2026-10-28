// Contas do app: volume levantado, recordes e sequência de semanas.
import { estado } from './estado.js';
import { dataLocal, segundaDaSemana } from './util.js';
import { diaPerfeito as dietaPerfeita } from './dietaplano.js';

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
  const aguaOk = !!ma && estado.agua.some((a) => a.ml >= ma);
  const volOk = !!mv && [...diasVol.values()].some((v) => v >= mv);
  const seq = sequenciaSemanas().semanas;
  const diaPerfeito = estado.refeicoes.some((r) => dietaPerfeita(estado.dietaItens, r.itens));
  const L = [
    ['🏁', 'Primeiro treino', 'Termine 1 treino', nTreinos >= 1],
    ['💪', '10 treinos', 'Termine 10 treinos', nTreinos >= 10],
    ['🔥', '50 treinos', 'Termine 50 treinos', nTreinos >= 50],
    ['👑', '100 treinos', 'Termine 100 treinos', nTreinos >= 100],
    ['🏆', 'Primeiro recorde', 'Bata um recorde de carga', nRecordes >= 1],
    ['🚀', '10 recordes', 'Bata 10 recordes de carga', nRecordes >= 10],
    ['⚖️', '10 mil kg num dia', 'Levante 10.000 kg em um dia', maxDia >= 10000],
    ['🎯', 'Meta de volume', 'Bata sua meta de volume (defina no Perfil)', volOk],
    ['🏋️', '100 mil kg no total', 'Some 100.000 kg levantados', volTotal >= 100000],
    ['📅', '2 semanas seguidas', 'Cumpra seus dias de treino 2 semanas seguidas', seq >= 2],
    ['🗓️', '4 semanas seguidas', 'Cumpra seus dias de treino 4 semanas seguidas', seq >= 4],
    ['💧', 'Meta de água', 'Bata sua meta de água (defina no Perfil)', aguaOk],
    ['🥗', 'Dia perfeito', 'Marque todos os itens da dieta num dia, sem passar do previsto', diaPerfeito],
    ['📏', 'Medidas em dia', 'Registre suas medidas do corpo', estado.medidas.length >= 1]
  ];
  return L.map(([icone, nome, desc, ok]) => ({ icone, nome, desc, ok }));
}
