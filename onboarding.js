// Primeiros passos logo após criar a conta: objetivo, dados do corpo, saúde e metas sugeridas.
// Tudo é opcional ("Pular"). As respostas ficam no perfil (anamnese) e podem ser refeitas em Minha conta.
import { estado } from './estado.js';
import { escaparHtml, dataLocal, numero, formatarNumero, toast } from './util.js';
import { salvarPerfil, salvarDoc } from './dados.js';

const OBJETIVOS = ['Emagrecer', 'Ganhar massa muscular', 'Definir o corpo', 'Saúde e bem-estar', 'Melhorar o desempenho'];
const NIVEIS = ['Iniciante', 'Intermediário', 'Avançado'];
const SEXOS = ['Masculino', 'Feminino', 'Prefiro não informar'];
const CONDICOES = ['Pressão alta', 'Diabetes', 'Problema cardíaco', 'Asma ou problema respiratório', 'Lesão ou dor nas articulações', 'Problema na coluna', 'Gravidez ou pós-parto'];

export function idadeDe(nasc) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nasc || '')) return null;
  const n = new Date(nasc + 'T12:00:00');
  const h = new Date();
  let i = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) i -= 1;
  return i >= 0 && i < 120 ? i : null;
}

// Estimativa (fórmula de Mifflin-St Jeor). É só uma sugestão para começar, não substitui nutricionista.
// Aceita 183 (cm) ou 1,83 (metros).
const alturaEmCm = (v) => { const n = numero(v); return n !== null && n >= 1 && n < 3 ? Math.round(n * 100) : n; };

export function sugerirMetas({ sexo, nascimento, alturaCm, pesoKg, objetivo, diasSemana }) {
  const idade = idadeDe(nascimento);
  if (!pesoKg) return null;
  const r = {};
  r.aguaMl = Math.round((pesoKg * 35) / 50) * 50;
  if (!alturaCm || idade === null) return r;
  const base = 10 * pesoKg + 6.25 * alturaCm - 5 * idade + (sexo === 'Masculino' ? 5 : sexo === 'Feminino' ? -161 : -78);
  const d = diasSemana || 0;
  const fator = d <= 1 ? 1.2 : d <= 3 ? 1.375 : d <= 5 ? 1.55 : 1.725;
  let kcal = base * fator;
  if (objetivo === 'Emagrecer') kcal *= 0.85;
  else if (objetivo === 'Ganhar massa muscular') kcal *= 1.1;
  kcal = Math.max(1200, Math.round(kcal / 50) * 50);
  const prot = Math.round(pesoKg * (objetivo === 'Emagrecer' || objetivo === 'Ganhar massa muscular' ? 2 : 1.6));
  const gord = Math.round(pesoKg * 0.8);
  const carb = Math.max(0, Math.round((kcal - prot * 4 - gord * 9) / 4));
  return { ...r, kcal, prot, carb, gord };
}

let raiz = null;
let ob = null;

const chips = (lista, atual, campo) => `<div class="chips">${lista.map((v) => `<button type="button" class="chip-ob ${atual === v ? 'on' : ''}" data-ob="escolher" data-campo="${campo}" data-v="${escaparHtml(v)}" aria-pressed="${atual === v}">${escaparHtml(v)}</button>`).join('')}</div>`;
const chipsDias = (atual) => `<div class="chips">${[2, 3, 4, 5, 6].map((n) => `<button type="button" class="chip-ob ${atual === n ? 'on' : ''}" data-ob="escolher" data-campo="diasSemana" data-v="${n}" aria-pressed="${atual === n}">${n}x</button>`).join('')}</div>`;

function passosDisponiveis() { return ob.temPersonal ? ['objetivo', 'corpo', 'saude'] : ['objetivo', 'corpo', 'saude', 'metas']; }

function htmlPasso(id) {
  const d = ob.dados;
  if (id === 'objetivo') return `
    <h1>Vamos conhecer você</h1>
    <p class="sub">Com isso o app já começa ajustado ao seu objetivo. Leva 1 minuto e você pode pular.</p>
    <h3 class="sub-ob">Qual é o seu objetivo?</h3>${chips(OBJETIVOS, d.objetivo, 'objetivo')}
    <h3 class="sub-ob">Seu nível de treino</h3>${chips(NIVEIS, d.nivel, 'nivel')}
    <h3 class="sub-ob">Quantos dias por semana quer treinar?</h3>${chipsDias(d.diasSemana)}`;
  if (id === 'corpo') return `
    <h1>Sobre você</h1>
    <p class="sub">Usamos para calcular suas metas. Só você${ob.temPersonal ? ' e seu personal veem' : ' vê'}.</p>
    <label class="campo">Data de nascimento<input class="in" type="date" data-ob-campo="nascimento" max="${dataLocal()}" value="${escaparHtml(d.nascimento || '')}"></label>
    <h3 class="sub-ob">Sexo</h3>${chips(SEXOS, d.sexo, 'sexo')}
    <div class="grade2">
      <label class="campo">Altura (cm)<input class="in" inputmode="numeric" data-ob-campo="alturaCm" placeholder="Ex.: 170 (ou 1,70)" value="${escaparHtml(d.alturaCm || '')}"></label>
      <label class="campo">Peso (kg)<input class="in" inputmode="decimal" data-ob-campo="pesoKg" placeholder="Ex.: 72,5" value="${escaparHtml(d.pesoKg || '')}"></label>
    </div>`;
  if (id === 'saude') return `
    <h1>Sua saúde</h1>
    <p class="sub">Ajuda você e ${ob.temPersonal ? 'seu personal' : 'a escolher treinos com segurança'}. Marque o que se aplica. Se não tiver nada, é só continuar.</p>
    <div class="lista-check">${CONDICOES.map((c) => `<label class="linha-check"><input type="checkbox" data-ob-cond="${escaparHtml(c)}" ${(d.condicoes || []).includes(c) ? 'checked' : ''}><span>${escaparHtml(c)}</span></label>`).join('')}</div>
    <label class="campo">Outras condições, lesões ou medicamentos (opcional)<textarea class="in" rows="2" maxlength="300" data-ob-campo="saudeObs">${escaparHtml(d.saudeObs || '')}</textarea></label>
    <label class="campo">Alergias ou restrições alimentares (opcional)<textarea class="in" rows="2" maxlength="300" data-ob-campo="restricoes">${escaparHtml(d.restricoes || '')}</textarea></label>
    <div class="aviso-sensivel"><p><b>Dados sensíveis.</b> Informações de saúde ficam guardadas na sua conta${ob.temPersonal ? ' e o seu personal consegue ver' : ''}. Não são usadas para anúncios nem vendidas. Você pode apagar tudo em Configurações.</p>
      <label class="linha-check"><input type="checkbox" data-ob-consent ${d.consentimento ? 'checked' : ''}><span>Concordo em informar esses dados de saúde.</span></label></div>
    <p class="mudo peq">O app não é aconselhamento médico. Se marcou alguma condição, converse com seu médico antes de começar a treinar.</p>`;
  if (id === 'metas') {
    const m = ob.metas;
    if (!m) return `<h1>Suas metas</h1><p class="sub">Preencha peso, altura e data de nascimento para o app sugerir metas automáticas. Você também pode defini-las depois em Configurações.</p>`;
    return `
    <h1>Metas sugeridas</h1>
    <p class="sub">Calculamos com base nos seus dados. Ajuste se quiser. É uma estimativa para começar, não substitui nutricionista.</p>
    ${m.kcal ? `
    <label class="campo">Calorias por dia (kcal)<input class="in" inputmode="numeric" data-ob-meta="kcal" value="${m.kcal}"></label>
    <div class="grade3">
      <label class="campo">Proteína (g)<input class="in" inputmode="numeric" data-ob-meta="prot" value="${m.prot}"></label>
      <label class="campo">Carbo (g)<input class="in" inputmode="numeric" data-ob-meta="carb" value="${m.carb}"></label>
      <label class="campo">Gordura (g)<input class="in" inputmode="numeric" data-ob-meta="gord" value="${m.gord}"></label>
    </div>` : '<p class="mudo peq">Para sugerir calorias faltam altura e data de nascimento. Mostrando só a água.</p>'}
    <label class="campo">Água por dia (litros)<input class="in" inputmode="decimal" data-ob-meta="agua" value="${String(m.aguaMl / 1000).replace('.', ',')}"></label>`;
  }
  return '';
}

function coletar() {
  const el = raiz;
  el.querySelectorAll('[data-ob-campo]').forEach((i) => { ob.dados[i.dataset.obCampo] = i.value.trim(); });
  const conds = el.querySelectorAll('[data-ob-cond]');
  if (conds.length) ob.dados.condicoes = [...conds].filter((c) => c.checked).map((c) => c.dataset.obCond);
  const cons = el.querySelector('[data-ob-consent]');
  if (cons) ob.dados.consentimento = cons.checked;
  const metas = el.querySelectorAll('[data-ob-meta]');
  if (metas.length && ob.metas) metas.forEach((i) => { ob.editMetas[i.dataset.obMeta] = i.value.trim(); });
}

function calcularMetas() {
  const d = ob.dados;
  ob.metas = sugerirMetas({ sexo: d.sexo, nascimento: d.nascimento, alturaCm: alturaEmCm(d.alturaCm), pesoKg: numero(d.pesoKg), objetivo: d.objetivo, diasSemana: d.diasSemana });
  ob.editMetas = {};
}

function desenhar() {
  ob.temPersonal = !!estado.vinculo;
  const passos = passosDisponiveis();
  const id = passos[ob.passo];
  const ultimo = ob.passo === passos.length - 1;
  raiz.innerHTML = `
    <div class="onb-topo">
      <div class="onb-barra"><i style="width:${((ob.passo + 1) / passos.length) * 100}%"></i></div>
      <button type="button" class="link" data-ob="pular">${ob.refazer ? 'Fechar' : 'Pular por agora'}</button>
    </div>
    <div class="onb-corpo">${htmlPasso(id)}<p class="erro" data-erro role="alert"></p></div>
    <div class="onb-rodape">
      ${ob.passo > 0 ? '<button type="button" class="btn secundario" data-ob="voltar">Voltar</button>' : ''}
      <button type="button" class="btn" data-ob="${ultimo ? 'fim' : 'prox'}">${ultimo ? 'Concluir' : 'Continuar'}</button>
    </div>`;
  const c = raiz.querySelector('.onb-corpo');
  if (c) c.scrollTop = 0;
}

function fechar() {
  if (raiz) { raiz.remove(); raiz = null; }
  document.body.classList.remove('sem-rolagem');
  ob = null;
}

function validarPasso(id) {
  const d = ob.dados;
  if (id === 'corpo') {
    const al = d.alturaCm ? alturaEmCm(d.alturaCm) : null;
    const pe = d.pesoKg ? numero(d.pesoKg) : null;
    if ((d.alturaCm && (al === null || al < 100 || al > 250)) || (d.pesoKg && (pe === null || pe < 20 || pe > 400))) return 'Confira altura (em cm) e peso (em kg).';
    if (d.nascimento && idadeDe(d.nascimento) === null) return 'Confira a data de nascimento.';
    if (d.nascimento && idadeDe(d.nascimento) < 14) return 'Este app é para maiores de 14 anos.';
  }
  if (id === 'saude') {
    const temSaude = (d.condicoes || []).length || d.saudeObs || d.restricoes;
    if (temSaude && !d.consentimento) return 'Para guardar esses dados, marque que você concorda.';
  }
  if (id === 'metas' && ob.metas) {
    for (const [k, max] of [['kcal', 20000], ['prot', 1000], ['carb', 2000], ['gord', 1000]]) {
      const t = ob.editMetas[k];
      if (t !== undefined && t !== '' && (numero(t) === null || numero(t) <= 0 || numero(t) > max)) return 'Confira os números das metas.';
    }
    const a = ob.editMetas.agua;
    if (a !== undefined && a !== '' && (numero(a) === null || numero(a) <= 0 || numero(a) > 20)) return 'Confira a água (em litros).';
  }
  return '';
}

function gravar() {
  const d = ob.dados;
  const uid = estado.uid;
  const ana = { atualizadoEm: new Date().toISOString() };
  ['objetivo', 'nivel', 'sexo', 'nascimento', 'saudeObs', 'restricoes'].forEach((k) => { if (d[k]) ana[k] = d[k]; });
  if (d.diasSemana) ana.diasSemana = d.diasSemana;
  if (alturaEmCm(d.alturaCm)) ana.alturaCm = alturaEmCm(d.alturaCm);
  const temSaude = (d.condicoes || []).length || d.saudeObs || d.restricoes;
  ana.condicoes = d.consentimento ? (d.condicoes || []) : [];
  if (!d.consentimento) { delete ana.saudeObs; delete ana.restricoes; } else if (temSaude) ana.consentimentoSaude = true;
  const campos = { anamnese: ana, viuBoasVindas: true };
  const kg = numero(d.pesoKg);
  if (kg) ana.pesoInicialKg = kg;
  if (ob.metas && !ob.temPersonal) {
    const e = ob.editMetas;
    const val = (k, base) => (e[k] !== undefined ? (e[k] === '' ? null : numero(e[k])) : base);
    if (ob.metas.kcal) {
      campos.metaKcal = val('kcal', ob.metas.kcal); campos.metaProt = val('prot', ob.metas.prot);
      campos.metaCarb = val('carb', ob.metas.carb); campos.metaGord = val('gord', ob.metas.gord);
    }
    const a = e.agua !== undefined ? (e.agua === '' ? null : numero(e.agua)) : ob.metas.aguaMl / 1000;
    campos.metaAgua = a === null ? null : Math.round(a * 1000);
  }
  salvarPerfil(uid, campos, { merge: true });
  if (kg) salvarDoc(uid, 'peso', dataLocal(), { data: dataLocal(), kg, criadoEm: new Date().toISOString() });
}

function aoClicar(e) {
  const b = e.target.closest('[data-ob]');
  if (!b || !ob) return;
  const acao = b.dataset.ob;
  coletar();
  ob.temPersonal = !!estado.vinculo;
  const passos = passosDisponiveis();
  if (acao === 'escolher') {
    const v = b.dataset.v;
    const campo = b.dataset.campo;
    const novo = campo === 'diasSemana' ? Number(v) : v;
    ob.dados[campo] = ob.dados[campo] === novo ? '' : novo;
    desenhar();
  } else if (acao === 'voltar') {
    ob.passo = Math.max(0, ob.passo - 1);
    desenhar();
  } else if (acao === 'prox' || acao === 'fim') {
    const id = passos[ob.passo];
    const erro = validarPasso(id);
    if (erro) { raiz.querySelector('[data-erro]').textContent = erro; return; }
    if (acao === 'prox') {
      ob.passo += 1;
      if (passos[ob.passo] === 'metas') calcularMetas();
      desenhar();
    } else {
      const teveMetas = !!(ob.metas && !ob.temPersonal);
      gravar();
      fechar();
      toast(teveMetas ? 'Tudo pronto! Suas metas já estão em Configurações.' : 'Tudo pronto!');
    }
  } else if (acao === 'pular') {
    const refazendo = ob.refazer;
    salvarPerfil(estado.uid, { viuBoasVindas: true }, { merge: true });
    fechar();
    if (!refazendo) toast('Você pode completar isso depois em Minha conta.');
  }
}

export function abrirOnboarding({ refazer = false } = {}) {
  if (raiz) return;
  const a = (estado.perfil && estado.perfil.anamnese) || {};
  ob = {
    passo: 0,
    temPersonal: !!estado.vinculo,
    refazer,
    metas: null,
    editMetas: {},
    dados: {
      objetivo: a.objetivo || '', nivel: a.nivel || '', diasSemana: a.diasSemana || '', sexo: a.sexo || '', nascimento: a.nascimento || '',
      alturaCm: a.alturaCm ? String(a.alturaCm) : '', pesoKg: a.pesoInicialKg ? String(a.pesoInicialKg).replace('.', ',') : '',
      condicoes: a.condicoes || [], saudeObs: a.saudeObs || '', restricoes: a.restricoes || '', consentimento: !!a.consentimentoSaude
    }
  };
  document.body.classList.add('sem-rolagem');
  raiz = document.createElement('div');
  raiz.className = 'onb';
  raiz.setAttribute('role', 'dialog');
  raiz.setAttribute('aria-modal', 'true');
  document.body.appendChild(raiz);
  raiz.addEventListener('click', aoClicar);
  desenhar();
}

// Resumo para mostrar em Minha conta e para o personal.
export function resumoAnamnese(a) {
  if (!a) return [];
  const linhas = [];
  if (a.objetivo) linhas.push(['Objetivo', a.objetivo]);
  if (a.nivel) linhas.push(['Nível', a.nivel + (a.diasSemana ? ` · ${a.diasSemana}x por semana` : '')]);
  const idade = idadeDe(a.nascimento);
  const corpo = [idade !== null ? `${idade} anos` : '', a.sexo || '', a.alturaCm ? `${formatarNumero(a.alturaCm)} cm` : '', a.pesoInicialKg ? `${formatarNumero(a.pesoInicialKg)} kg ao começar` : ''].filter(Boolean).join(' · ');
  if (corpo) linhas.push(['Dados', corpo]);
  if ((a.condicoes || []).length) linhas.push(['Saúde', a.condicoes.join(', ')]);
  if (a.saudeObs) linhas.push(['Outras condições', a.saudeObs]);
  if (a.restricoes) linhas.push(['Restrições alimentares', a.restricoes]);
  return linhas;
}
