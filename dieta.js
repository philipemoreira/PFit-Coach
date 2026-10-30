// Aba Dieta: uma lista fixa por refeição, igual todos os dias. A pessoa só marca o que comeu e a quantidade.
import { cartaoArquivosAluno, abrirArquivoDieta } from './dietaarquivo.js';
import { estado } from './estado.js';
import { contar } from './conquistas-personal.js';
import { abrirFolha, confirmar } from './folha.js';
import { escaparHtml, novoId, dataLocal, numero, toast, formatarNumero } from './util.js';
import { salvarDoc, removerDoc } from './dados.js';
import { nav } from './nav.js';
import { blocoAlimentos, acoesAlimentos, itensDoDia, totais, MOMENTOS } from './alimentos.js';
import { UNIDADES, ordenarPlano, analisarDia, textoPassou, descreverQtd, valoresProporcionais } from './dietaplano.js';

let editando = false; // modo "editar lista" (só quem monta a própria dieta)

const podeEditar = () => !estado.vinculo;
const momentoAgora = () => {
  const h = new Date().getHours();
  return h < 10 ? 'Café da manhã' : h < 14 ? 'Almoço' : h < 17 ? 'Lanche' : h < 21 ? 'Jantar' : 'Ceia';
};

async function gravarDia(itens) {
  const data = dataLocal();
  await salvarDoc(estado.uid, 'refeicoes', data, { data, itens, atualizadoEm: new Date().toISOString() });
}

function entradaDe(p, qtd) {
  return { id: novoId(), planoId: p.id, fora: false, nome: p.nome, qtd, unidade: p.unidade || '', momento: p.momento, ...valoresProporcionais(p, qtd) };
}

export const planoDaDieta = () => ordenarPlano(estado.dietaItens);

// Aviso "você passou" (aparece para a pessoa; o personal vê o mesmo no cartão do aluno).
export function avisoPassou() {
  const a = analisarDia(planoDaDieta(), itensDoDia());
  if (!a.passou.length) return '';
  return `<p class="alerta-passou" role="status">⚠️ Você passou do combinado hoje: <strong>${escaparHtml(textoPassou(a))}</strong>.<br><small>Acontece! Siga o resto do dia no plano.${estado.vinculo ? ' Seu personal vai ver isso.' : ''}</small></p>`;
}

function linhaItem(p, e, edit) {
  if (edit) {
    return `<button type="button" class="regra-linha" data-acao="dieta-item-editar" data-id="${escaparHtml(p.id)}"><span>${escaparHtml(p.nome)}<br><small class="mudo">${escaparHtml(descreverQtd(p.qtd, p.unidade))}${p.kcal ? ` · ${formatarNumero(p.kcal)} kcal` : ''}</small></span><span class="seta" aria-hidden="true">›</span></button>`;
  }
  const extra = e ? (e.qtd || 0) - p.qtd : 0;
  const passou = extra > 0.0001;
  const sub = e
    ? `comeu ${escaparHtml(descreverQtd(e.qtd, p.unidade))}${passou ? ` · <b>+${escaparHtml(descreverQtd(extra, p.unidade))}</b>` : ''} <span class="mudo">(previsto ${escaparHtml(descreverQtd(p.qtd, p.unidade))})</span>`
    : `previsto ${escaparHtml(descreverQtd(p.qtd, p.unidade))}`;
  return `<div class="dieta-item ${e ? 'feito' : ''} ${passou ? 'passou' : ''}">
    <button type="button" class="dieta-check" role="checkbox" aria-checked="${!!e}" aria-label="Comi ${escaparHtml(p.nome)}" data-acao="dieta-marcar" data-id="${escaparHtml(p.id)}"><span class="caixa">${e ? '✔' : ''}</span></button>
    <button type="button" class="dieta-corpo" data-acao="dieta-qtd" data-id="${escaparHtml(p.id)}"><b>${escaparHtml(p.nome)}</b><small>${sub}</small></button>
  </div>`;
}

// A lista do dia, por refeição. Usada na aba Dieta e na aba Hoje.
export function blocoRegistro({ titulo = true, edit = false } = {}) {
  const plano = planoDaDieta();
  const a = analisarDia(plano, itensDoDia());
  const fora = itensDoDia().filter((i) => i.fora || !i.planoId);
  if (!plano.length) {
    return `<section class="card"><h2>Dieta de hoje</h2>${estado.vinculo
      ? '<p class="mudo">Seu personal ainda não montou a sua dieta.</p>'
      : '<p class="mudo">Você ainda não montou a sua lista de alimentos.</p><button class="btn secundario cheio" type="button" data-acao="dieta-item-novo">Montar minha lista</button>'}</section>`;
  }
  const t = totais(itensDoDia());
  const grupos = MOMENTOS.map((m) => [m, plano.filter((p) => p.momento === m)]).filter(([, l]) => l.length);
  return `
  <section class="card larga">
    ${titulo ? `<div class="card-topo"><h2>Dieta de hoje</h2><span class="selo">${a.feitos}/${a.total} itens</span></div>` : ''}
    ${avisoPassou()}
    ${t.kcal ? `<p class="mudo peq">Hoje: <strong>${t.kcal.toLocaleString('pt-BR')} kcal</strong> · P ${formatarNumero(t.prot)} g · C ${formatarNumero(t.carb)} g · G ${formatarNumero(t.gord)} g</p>` : ''}
    ${grupos.map(([m, l]) => `<div class="dieta-refeicao"><div class="card-topo"><h3>${m}</h3>${edit ? `<button class="link" type="button" data-acao="dieta-item-novo" data-momento="${escaparHtml(m)}">+ item</button>` : ''}</div>
      <div class="lista">${l.map((p) => linhaItem(p, a.consumo.get(p.id), edit)).join('')}</div></div>`).join('')}
    ${fora.length && !edit ? `<div class="dieta-refeicao"><div class="card-topo"><h3>Fora da lista</h3></div><div class="lista">${fora.map((i) => `<div class="dieta-item feito passou"><span class="dieta-ico" aria-hidden="true">!</span><div class="dieta-corpo"><b>${escaparHtml(i.nome)}</b><small>${escaparHtml(i.qtdTexto || '')}${i.kcal ? ` · ${i.kcal} kcal` : ''}</small></div><button type="button" class="icone-peq" data-acao="dieta-fora-remover" data-id="${escaparHtml(i.id)}" aria-label="Remover ${escaparHtml(i.nome)}">✕</button></div>`).join('')}</div></div>` : ''}
    ${edit ? `<div class="acoes-card"><button class="btn secundario cheio" type="button" data-acao="dieta-item-novo">+ Adicionar item</button></div>` : '<div class="acoes-card"><button class="btn secundario cheio" type="button" data-acao="dieta-fora">+ Comi outra coisa</button></div>'}
  </section>`;
}

// ---------- Editor de item da lista (personal, ou a própria pessoa se não tem personal) ----------
export function abrirEditorItem(momentoInicial, item, uidAlvo = estado.uid) {
  const f = abrirFolha(`
    <h2>${item ? 'Editar item' : 'Novo item da dieta'}</h2>
    ${estado.alimentos.length ? `<label class="campo">Preencher com um dos meus alimentos (opcional)
      <select class="in" data-f="lib"><option value="">— escolher —</option>${estado.alimentos.map((a) => `<option value="${escaparHtml(a.id)}">${escaparHtml(a.nome)} (${escaparHtml(a.porcao || '1 porção')})</option>`).join('')}</select></label>` : ''}
    <label class="campo">Refeição
      <select class="in" data-f="momento">${MOMENTOS.map((m) => `<option ${m === (item ? item.momento : momentoInicial || 'Café da manhã') ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
    <label class="campo">Alimento<input class="in" data-f="nome" maxlength="60" placeholder="O que é" value="${escaparHtml(item ? item.nome : '')}"></label>
    <div class="grade2">
      <label class="campo">Quantidade<input class="in" inputmode="decimal" data-f="qtd" value="${item ? String(item.qtd).replace('.', ',') : ''}"></label>
      <label class="campo">Medida<input class="in" data-f="unidade" list="lista-unidades" maxlength="15" value="${escaparHtml(item ? item.unidade || '' : 'g')}"><datalist id="lista-unidades">${UNIDADES.map((u) => `<option value="${u}">`).join('')}</datalist></label>
    </div>
    <details class="como-fazer" ${item && item.kcal ? 'open' : ''}><summary>Calorias e macros dessa quantidade (opcional)</summary>
      <div class="grade2">
        ${['kcal:Calorias (kcal)', 'prot:Proteína (g)', 'carb:Carboidrato (g)', 'gord:Gordura (g)'].map((x) => { const [k, r] = x.split(':'); return `<label class="campo">${r}<input class="in" inputmode="decimal" data-f="${k}" value="${item && item[k] ? String(item[k]).replace('.', ',') : ''}"></label>`; }).join('')}
      </div>
      <p class="mudo peq">Se preencher, o app calcula sozinho as calorias do que a pessoa comeu.</p>
    </details>
    <p class="erro" data-erro role="alert"></p>
    <div class="linha-botoes">
      ${item ? '<button class="btn perigo-claro" type="button" data-ed="excluir">Excluir</button>' : '<button class="btn secundario" type="button" data-fechar>Cancelar</button>'}
      <button class="btn" type="button" data-ed="salvar">Salvar</button>
    </div>`, { classe: 'folha-alta' });
  const q = (n) => f.el.querySelector(`[data-f="${n}"]`);
  const lib = q('lib');
  if (lib) {
    lib.addEventListener('change', () => {
      const a = estado.alimentos.find((x) => x.id === lib.value);
      if (!a) return;
      q('nome').value = a.nome;
      q('qtd').value = '1';
      q('unidade').value = a.porcao || 'porção';
      ['kcal', 'prot', 'carb', 'gord'].forEach((k) => { q(k).value = a[k] ? String(a[k]).replace('.', ',') : ''; });
      f.el.querySelector('details').open = true;
    });
  }
  f.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ed]');
    if (!b) return;
    const erro = (t) => { f.el.querySelector('[data-erro]').textContent = t; };
    if (b.dataset.ed === 'salvar') {
      const nome = q('nome').value.trim();
      const qtd = numero(q('qtd').value);
      if (!nome) return erro('Escreva o nome do alimento.');
      if (qtd === null || qtd <= 0 || qtd > 100000) return erro('Informe a quantidade (número maior que zero).');
      const dados = { momento: q('momento').value, nome, qtd, unidade: q('unidade').value.trim(), ordem: item ? item.ordem : Date.now(), criadoEm: item ? item.criadoEm : new Date().toISOString() };
      for (const k of ['kcal', 'prot', 'carb', 'gord']) {
        const t = q(k).value.trim();
        const n = t === '' ? 0 : numero(t);
        if (n === null || n < 0 || n > 100000) return erro('Confira as calorias e macros (números positivos).');
        dados[k] = n;
      }
      salvarDoc(uidAlvo, 'dietaItens', item ? item.id : novoId(), dados);
      if (!item && uidAlvo !== estado.uid) contar('dietas');
      f.fechar();
    } else if (b.dataset.ed === 'excluir') {
      if (await confirmar(`Tirar “${item.nome}” da lista?`, { ok: 'Tirar', perigo: true })) {
        removerDoc(uidAlvo, 'dietaItens', item.id);
        f.fechar();
      }
    }
  });
}

// ---------- Quanto comeu ----------
function abrirQuantidade(p) {
  const atual = itensDoDia().find((i) => i.planoId === p.id && !i.fora);
  const f = abrirFolha(`
    <h2>${escaparHtml(p.nome)}</h2>
    <p class="mudo">Previsto: <strong>${escaparHtml(descreverQtd(p.qtd, p.unidade))}</strong></p>
    <label class="campo">Quanto você comeu? ${p.unidade ? `(${escaparHtml(p.unidade)})` : ''}
      <input class="in grande-in" inputmode="decimal" data-f="qtd" value="${String(atual ? atual.qtd : p.qtd).replace('.', ',')}"></label>
    <p class="erro" data-erro role="alert"></p>
    <div class="linha-botoes">
      ${atual ? '<button class="btn perigo-claro" type="button" data-ed="nao">Não comi</button>' : '<button class="btn secundario" type="button" data-fechar>Cancelar</button>'}
      <button class="btn" type="button" data-ed="salvar">Salvar</button>
    </div>`);
  const campo = f.el.querySelector('[data-f="qtd"]');
  campo.focus();
  campo.select();
  f.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ed]');
    if (!b) return;
    const resto = itensDoDia().filter((i) => !(i.planoId === p.id && !i.fora));
    if (b.dataset.ed === 'nao') { await gravarDia(resto); f.fechar(); return; }
    const qtd = numero(campo.value);
    if (qtd === null || qtd <= 0 || qtd > 100000) { f.el.querySelector('[data-erro]').textContent = 'Informe a quantidade (número maior que zero).'; return; }
    await gravarDia([...resto, entradaDe(p, qtd)]);
    f.fechar();
    if (qtd > p.qtd + 0.0001) toast(`Você passou ${descreverQtd(qtd - p.qtd, p.unidade)} de ${p.nome}. Tudo bem, siga o plano no resto do dia.`);
  });
}

// ---------- Comi outra coisa (fora da lista) ----------
function abrirFora() {
  let macros = {};
  const f = abrirFolha(`
    <h2>Comi outra coisa</h2>
    <p class="mudo peq">Pode anotar. Isso conta como “passou” e ${estado.vinculo ? 'o seu personal vê' : 'fica registrado'}.</p>
    ${estado.alimentos.length ? `<label class="campo">Escolher dos meus alimentos (opcional)
      <select class="in" data-f="lib"><option value="">— escolher —</option>${estado.alimentos.map((a) => `<option value="${escaparHtml(a.id)}">${escaparHtml(a.nome)} (${escaparHtml(a.porcao || '1 porção')})</option>`).join('')}</select></label>` : ''}
    <label class="campo">O que você comeu?<input class="in" data-f="nome" maxlength="60"></label>
    <div class="grade2">
      <label class="campo">Quanto?<input class="in" data-f="qtdTexto" maxlength="30" placeholder="Ex.: 2 fatias"></label>
      <label class="campo">Refeição<select class="in" data-f="momento">${MOMENTOS.map((m) => `<option ${m === momentoAgora() ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
    </div>
    <label class="campo">Calorias (opcional)<input class="in" inputmode="decimal" data-f="kcal"></label>
    <p class="erro" data-erro role="alert"></p>
    <div class="linha-botoes"><button class="btn secundario" type="button" data-fechar>Cancelar</button><button class="btn" type="button" data-ed="salvar">Anotar</button></div>`, { classe: 'folha-alta' });
  const q = (n) => f.el.querySelector(`[data-f="${n}"]`);
  const lib = q('lib');
  if (lib) {
    lib.addEventListener('change', () => {
      const a = estado.alimentos.find((x) => x.id === lib.value);
      if (!a) return;
      q('nome').value = a.nome;
      q('qtdTexto').value = a.porcao || '1 porção';
      q('kcal').value = String(a.kcal || '');
      macros = { prot: a.prot || 0, carb: a.carb || 0, gord: a.gord || 0 };
    });
  }
  f.el.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-ed="salvar"]')) return;
    const nome = q('nome').value.trim();
    const t = q('kcal').value.trim();
    const kcal = t === '' ? 0 : numero(t);
    if (!nome) { f.el.querySelector('[data-erro]').textContent = 'Escreva o que você comeu.'; return; }
    if (kcal === null || kcal < 0 || kcal > 10000) { f.el.querySelector('[data-erro]').textContent = 'Confira as calorias (número).'; return; }
    await gravarDia([...itensDoDia(), { id: novoId(), planoId: null, fora: true, nome, qtdTexto: q('qtdTexto').value.trim(), momento: q('momento').value, kcal: Math.round(kcal), prot: macros.prot || 0, carb: macros.carb || 0, gord: macros.gord || 0 }]);
    f.fechar();
    toast('Anotado. Passou do combinado, mas tudo bem.');
  });
}

export const dieta = {
  render() {
    const edit = editando && podeEditar();
    return `
    <header class="topo"><h1>Dieta</h1>${podeEditar() && estado.dietaItens.length ? `<button class="btn pequeno ${edit ? '' : 'secundario'}" type="button" data-acao="dieta-modo-editar">${edit ? 'Pronto' : 'Editar lista'}</button>` : ''}</header>
    ${estado.vinculo ? `<p class="faixa-personal">Sua dieta é montada por <strong>${escaparHtml(estado.vinculo.personalNome || 'seu personal')}</strong>. Toque no quadrado quando comer o previsto; toque no nome para dizer outra quantidade.</p>` : '<p class="mudo peq margem-b">Sua lista é igual todos os dias. Toque no quadrado quando comer o previsto.</p>'}
    ${cartaoArquivosAluno()}
    ${blocoRegistro({ edit })}
    ${blocoAlimentos()}
    <p class="aviso-rodape">Este app organiza a sua dieta, mas não substitui nutricionista nem médico.</p>`;
  },
  acoes: {
    ...acoesAlimentos,
    'arq-abrir': (el) => { const m = estado.dietaArquivos.find((x) => x.id === el.dataset.id); if (m) abrirArquivoDieta(estado.uid, m); },
    'comida-adicionar': () => abrirFora(),
    'dieta-fora': () => abrirFora(),
    'dieta-fora-remover': async (el) => { await gravarDia(itensDoDia().filter((i) => i.id !== el.dataset.id)); },
    'dieta-modo-editar': () => { editando = !editando; nav.renderizar(); },
    'dieta-marcar': async (el) => {
      const p = estado.dietaItens.find((x) => x.id === el.dataset.id);
      if (!p) return;
      const tem = itensDoDia().some((i) => i.planoId === p.id && !i.fora);
      const resto = itensDoDia().filter((i) => !(i.planoId === p.id && !i.fora));
      await gravarDia(tem ? resto : [...resto, entradaDe(p, p.qtd)]);
    },
    'dieta-qtd': (el) => {
      const p = estado.dietaItens.find((x) => x.id === el.dataset.id);
      if (p) abrirQuantidade(p);
    },
    'dieta-item-novo': (el) => {
      editando = true;
      nav.irPara('dieta');
      abrirEditorItem(el.dataset.momento);
    },
    'dieta-item-editar': (el) => {
      const p = estado.dietaItens.find((x) => x.id === el.dataset.id);
      if (p) abrirEditorItem(p.momento, p);
    }
  }
};
