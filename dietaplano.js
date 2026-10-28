// Dieta como lista fixa: itens por refeição, com a quantidade prevista. Aqui fica só a conta (sem tela).
// plano  = lista de itens da dieta ({id, momento, nome, qtd, unidade, kcal, prot, carb, gord, ordem})
// itens  = o que foi comido no dia (refeicoes/{data}.itens); cada um tem planoId (item da lista) ou fora:true
import { formatarNumero } from './util.js';

export const MOMENTOS = ['Café da manhã', 'Almoço', 'Lanche', 'Jantar', 'Ceia', 'Outro'];

export const UNIDADES = ['g', 'ml', 'unidade', 'fatia', 'colher', 'xícara', 'porção'];
const EPS = 0.0001;

export function ordenarPlano(plano) {
  const pos = (m) => { const i = MOMENTOS.indexOf(m); return i < 0 ? 99 : i; };
  return [...plano].sort((a, b) => pos(a.momento) - pos(b.momento) || (a.ordem || 0) - (b.ordem || 0));
}

export const descreverQtd = (qtd, unidade) => `${formatarNumero(qtd)}${unidade ? ' ' + unidade : ''}`;

export function descreverItem(i) {
  if (i.qtdTexto) return i.qtdTexto;
  if (typeof i.qtd === 'number') return descreverQtd(i.qtd, i.unidade);
  if (typeof i.porcoes === 'number') return `${formatarNumero(i.porcoes)}×`;
  return '';
}

// Calorias e macros de "qtd" de um item da lista (proporcional à quantidade prevista).
export function valoresProporcionais(p, qtd) {
  const f = p.qtd > 0 ? qtd / p.qtd : 0;
  const r1 = (n) => Math.round(n * 10) / 10;
  return {
    kcal: Math.round((p.kcal || 0) * f),
    prot: r1((p.prot || 0) * f),
    carb: r1((p.carb || 0) * f),
    gord: r1((p.gord || 0) * f)
  };
}

export const ehFora = (e) => !!e.fora || !e.planoId;

// Analisa um dia: quantos itens da lista foram marcados e o que passou do previsto.
export function analisarDia(plano, itens) {
  const lista = itens || [];
  const porId = new Map();
  lista.filter((e) => !ehFora(e)).forEach((e) => porId.set(e.planoId, e));
  let feitos = 0;
  const passou = [];
  plano.forEach((p) => {
    const e = porId.get(p.id);
    if (!e) return;
    feitos += 1;
    const extra = (e.qtd || 0) - p.qtd;
    if (extra > EPS) passou.push({ nome: p.nome, extra, unidade: p.unidade, fora: false });
  });
  lista.filter(ehFora).forEach((e) => passou.push({ nome: e.nome, fora: true, texto: descreverItem(e) }));
  return { total: plano.length, feitos, passou, consumo: porId };
}

export function textoPassou(a) {
  return a.passou.map((x) => (x.fora ? `${x.nome} (fora da lista)` : `${x.nome} +${descreverQtd(x.extra, x.unidade)}`)).join(', ');
}

function dia(refeicoes, data) {
  const r = refeicoes.find((x) => x.data === data);
  return (r && r.itens) || [];
}

// Últimos n dias (do mais novo ao mais antigo): [{data, ...analise}]
export function ultimosDias(plano, refeicoes, datas) {
  return datas.map((data) => ({ data, ...analisarDia(plano, dia(refeicoes, data)) }));
}

// % de itens da lista marcados nos dias dados (só conta dias em que o aluno registrou algo).
export function cumprimento(plano, refeicoes, datas) {
  let total = 0;
  let feitos = 0;
  ultimosDias(plano, refeicoes, datas).forEach((d) => {
    if (!dia(refeicoes, d.data).length) return;
    total += d.total;
    feitos += d.feitos;
  });
  return total ? Math.round((feitos / total) * 100) : null;
}

export const diaPerfeito = (plano, itens) => {
  const a = analisarDia(plano, itens);
  return a.total > 0 && a.feitos === a.total && !a.passou.length;
};
