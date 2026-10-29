// Calorias e macros: seus alimentos (você cadastra os valores), o que você comeu no dia e os totais.
import { estado } from './estado.js';
import { abrirFolha, confirmar } from './folha.js';
import { escaparHtml, dataLocal, numero, formatarNumero, novoId, toast } from './util.js';
import { salvarDoc, removerDoc } from './dados.js';
import { metaMacros } from './metricas.js';
import { MOMENTOS, descreverItem } from './dietaplano.js';
import { listaRecolhivel } from './recolhivel.js';

export { MOMENTOS };

const r1 = (n) => Math.round(n * 10) / 10;

export function itensDoDia(data = dataLocal()) {
  const r = estado.refeicoes.find((x) => x.data === data);
  return (r && r.itens) || [];
}

export function totais(itens) {
  const t = { kcal: 0, prot: 0, carb: 0, gord: 0 };
  itens.forEach((i) => { t.kcal += i.kcal || 0; t.prot += i.prot || 0; t.carb += i.carb || 0; t.gord += i.gord || 0; });
  return { kcal: Math.round(t.kcal), prot: r1(t.prot), carb: r1(t.carb), gord: r1(t.gord) };
}

export const totaisDoDia = (data = dataLocal()) => totais(itensDoDia(data));

function barra(valor, meta) {
  const pct = meta ? Math.min(100, (valor / meta) * 100) : 0;
  return `<div class="barra peq" role="progressbar" aria-valuemin="0" aria-valuemax="${meta || 0}" aria-valuenow="${Math.round(valor)}"><i style="width:${pct.toFixed(1)}%"></i></div>`;
}

function minimacro(nome, valor, meta) {
  return `<div class="minimacro"><span>${nome}</span><strong>${formatarNumero(valor)} g</strong>${meta ? barra(valor, meta) + `<small class="mudo">meta ${formatarNumero(meta)} g</small>` : ''}</div>`;
}

// Cartão da aba Hoje.
export function blocoMacros() {
  const t = totaisDoDia();
  const m = metaMacros();
  return `
  <section class="card">
    <div class="card-topo"><h2>Calorias e macros</h2></div>
    <p class="grande">${t.kcal.toLocaleString('pt-BR')} <small>kcal</small></p>
    ${m.kcal ? `${barra(t.kcal, m.kcal)}<p class="mudo peq">Meta: ${m.kcal.toLocaleString('pt-BR')} kcal${t.kcal < m.kcal ? ` · faltam ${(m.kcal - t.kcal).toLocaleString('pt-BR')}` : ' · meta batida 🎉'}</p>` : `<p class="mudo peq">Sem meta de calorias. ${estado.vinculo ? '' : '<button class="link" type="button" data-acao="meta-editar" data-meta="kcal">Definir meta</button>'}</p>`}
    <div class="minimacros">${minimacro('Proteína', t.prot, m.prot)}${minimacro('Carbo', t.carb, m.carb)}${minimacro('Gordura', t.gord, m.gord)}</div>
    <div class="acoes-card linha">
      <button class="btn secundario" type="button" data-acao="comida-dia">Ver o dia</button>
      <button class="btn" type="button" data-acao="dieta-fora">+ Outra coisa</button>
    </div>
  </section>`;
}

// Cartão da aba Dieta: sua biblioteca de alimentos.
export function blocoAlimentos() {
  const lista = estado.alimentos;
  return `
  <section class="card larga">
    <div class="card-topo"><h2>Meus alimentos</h2><button class="btn pequeno" type="button" data-acao="alimento-novo">+ Novo</button></div>
    <p class="mudo peq">Alimentos com os valores de uma porção (veja no rótulo ou na sua tabela). Servem para preencher a lista da dieta e o “comi outra coisa” mais rápido.</p>
    ${lista.length ? listaRecolhivel('alimentos', lista.map((a) => `<button type="button" class="regra-linha" data-acao="alimento-editar" data-id="${escaparHtml(a.id)}"><span>${escaparHtml(a.nome)}<br><small class="mudo">${escaparHtml(a.porcao || '1 porção')} · ${formatarNumero(a.kcal)} kcal · P ${formatarNumero(a.prot)} · C ${formatarNumero(a.carb)} · G ${formatarNumero(a.gord)}</small></span><span class="seta" aria-hidden="true">›</span></button>`)) : '<p class="mudo vazio-peq">Nenhum alimento ainda.</p>'}
  </section>`;
}

function campoNum(rotulo, f, valor, extra = '') {
  return `<label class="campo">${rotulo}<input class="in" inputmode="decimal" data-f="${f}" value="${valor === null || valor === undefined ? '' : escaparHtml(String(valor).replace('.', ','))}" ${extra}></label>`;
}

export function abrirEditorAlimento(alimento, aoSalvar) {
  const a = alimento || {};
  const f = abrirFolha(`
    <h2>${alimento ? 'Editar alimento' : 'Novo alimento'}</h2>
    <label class="campo">Nome<input class="in" data-f="nome" maxlength="60" placeholder="Ex.: o alimento que você come" value="${escaparHtml(a.nome || '')}"></label>
    <label class="campo">O que é 1 porção?<input class="in" data-f="porcao" maxlength="30" placeholder="Ex.: 100 g, 1 unidade, 1 colher" value="${escaparHtml(a.porcao || '')}"></label>
    <div class="grade2">
      ${campoNum('Calorias (kcal)', 'kcal', a.kcal)}
      ${campoNum('Proteína (g)', 'prot', a.prot)}
      ${campoNum('Carboidrato (g)', 'carb', a.carb)}
      ${campoNum('Gordura (g)', 'gord', a.gord)}
    </div>
    <p class="erro" data-erro role="alert"></p>
    <div class="linha-botoes">
      ${alimento ? '<button class="btn perigo-claro" type="button" data-ed="excluir">Excluir</button>' : '<button class="btn secundario" type="button" data-fechar>Cancelar</button>'}
      <button class="btn" type="button" data-ed="salvar">Salvar</button>
    </div>`, { classe: 'folha-alta' });
  const q = (n) => f.el.querySelector(`[data-f="${n}"]`);
  f.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ed]');
    if (!b) return;
    if (b.dataset.ed === 'salvar') {
      const nome = q('nome').value.trim();
      const val = {};
      for (const k of ['kcal', 'prot', 'carb', 'gord']) {
        const t = q(k).value.trim();
        const n = t === '' ? (k === 'kcal' ? null : 0) : numero(t);
        if (n === null || n < 0 || n > (k === 'kcal' ? 5000 : 500)) { f.el.querySelector('[data-erro]').textContent = k === 'kcal' ? 'Informe as calorias (número).' : 'Confira os valores (números positivos).'; return; }
        val[k] = n;
      }
      if (!nome) { f.el.querySelector('[data-erro]').textContent = 'Dê um nome para o alimento.'; return; }
      const id = alimento ? alimento.id : novoId();
      await salvarDoc(estado.uid, 'alimentos', id, { nome, porcao: q('porcao').value.trim() || '1 porção', ...val, criadoEm: alimento ? alimento.criadoEm : new Date().toISOString() });
      f.fechar();
      toast('Alimento salvo.');
      if (aoSalvar) aoSalvar(id);
    } else if (b.dataset.ed === 'excluir') {
      if (await confirmar(`Excluir “${alimento.nome}” dos seus alimentos? O que você já registrou continua no histórico.`, { ok: 'Excluir', perigo: true })) {
        removerDoc(estado.uid, 'alimentos', alimento.id);
        f.fechar();
      }
    }
  });
}

function abrirDia() {
  const data = dataLocal();
  const f = abrirFolha('<div id="dia-comida"></div>', { classe: 'folha-alta' });
  let ultimo = '';
  const pintar = () => {
    const itens = itensDoDia(data);
    const t = totais(itens);
    const grupos = MOMENTOS.map((m) => [m, itens.filter((i) => i.momento === m)]).filter(([, l]) => l.length);
    const html = `
      <h2>O que você comeu hoje</h2>
      <p class="grande">${t.kcal.toLocaleString('pt-BR')} <small>kcal</small></p>
      <p class="mudo peq">P ${formatarNumero(t.prot)} g · C ${formatarNumero(t.carb)} g · G ${formatarNumero(t.gord)} g</p>
      ${grupos.length ? grupos.map(([m, l]) => `<h3 class="sub">${m}</h3><div class="lista">${l.map((i) => `<div class="linha-peso"><span>${escaparHtml(i.nome)}<br><small class="mudo">${escaparHtml(descreverItem(i))}${i.fora || !i.planoId ? ' · fora da lista' : ''} · P ${formatarNumero(i.prot)} · C ${formatarNumero(i.carb)} · G ${formatarNumero(i.gord)}</small></span><strong>${i.kcal} kcal</strong><button type="button" class="icone-peq" data-del="${escaparHtml(i.id)}" aria-label="Remover ${escaparHtml(i.nome)}">✕</button></div>`).join('')}</div>`).join('') : '<p class="mudo vazio-peq">Nada registrado hoje.</p>'}
      <div class="linha-botoes"><button class="btn" type="button" data-fechar>Fechar</button></div>`;
    if (html !== ultimo) { ultimo = html; f.el.querySelector('#dia-comida').innerHTML = html; }
  };
  pintar();
  const timer = setInterval(() => { if (!document.body.contains(f.el)) { clearInterval(timer); return; } pintar(); }, 700);
  f.el.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      const itens = itensDoDia(data).filter((i) => i.id !== del.dataset.del);
      await salvarDoc(estado.uid, 'refeicoes', data, { data, itens, atualizadoEm: new Date().toISOString() });
      pintar();
    }
  });
}

export const acoesAlimentos = {
  'comida-dia': () => abrirDia(),
  'alimento-novo': () => abrirEditorAlimento(null),
  'alimento-editar': (el) => {
    const a = estado.alimentos.find((x) => x.id === el.dataset.id);
    if (a) abrirEditorAlimento(a);
  }
};

