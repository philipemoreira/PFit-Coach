// Aba Alunos (só para quem é personal): convite, lista de alunos, treino/dieta/metas de cada aluno, modelos.
import {
  db, onSnapshot, collection, doc, query, orderBy, limit
} from './firebase.js';
import { estado } from './estado.js';
import { abrirFolha, confirmar, fecharTodasFolhas } from './folha.js';
import { escaparHtml, dataLocal, parseData, formatarDataCurta, formatarNumero, numero, novoId, toast, segundaDaSemana, DIAS_CURTOS, ORDEM_DIAS } from './util.js';
import { salvarDoc, salvarGlobal, removerGlobal, salvarPerfil } from './dados.js';
import { abrirEditorTreino } from './treinos.js';
import { abrirEditorItem } from './dieta.js';
import { MOMENTOS, ordenarPlano, analisarDia, textoPassou, cumprimento as cumprimentoPlano, descreverQtd } from './dietaplano.js';
import { abrirRecados } from './recados.js';
import { volumeSessao, formatarVolume } from './metricas.js';
import { nav } from './nav.js';
import { totais } from './alimentos.js';
import { avisoFaixa } from './assinatura.js';
import { listaRecolhivel } from './recolhivel.js';
import { resumoAnamnese } from './onboarding.js';
import { abrirFotos } from './fotos.js';
import { contar, conquistasPersonal, cartaoConquistasPersonal, linhaConq, ordenar, folhaConquista } from './conquistas-personal.js';

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem letras que se confundem (0/O, 1/I)
const DIAS_SUMIDO = 7;

let alunoAberto = null;
let abaAluno = 'treinos'; // treinos | dieta | corpo | perfil
let dados = vazio();
let paradoresAluno = [];
const resumo = {}; // uid -> sessoes recentes (para a lista)
const resumoDieta = {}; // uid -> { plano, refeicoes } (para o aviso de "passou")
const paradoresLista = {};
let uidSync = null;

function vazio() {
  return { treinos: [], dietaItens: [], sessoes: [], peso: [], checks: [], medidas: [], recados: [], refeicoes: [], metas: null, perfilAluno: null };
}

export function pararPersonal() {
  Object.values(paradoresLista).forEach((p) => p());
  Object.keys(paradoresLista).forEach((k) => delete paradoresLista[k]);
  Object.keys(resumo).forEach((k) => delete resumo[k]);
  Object.keys(resumoDieta).forEach((k) => delete resumoDieta[k]);
  paradoresAluno.forEach((p) => p());
  paradoresAluno = [];
  alunoAberto = null;
  dados = vazio();
  uidSync = null;
}

// Liga/desliga a escuta dos treinos recentes de cada aluno conforme a lista muda.
function sincronizarLista() {
  if (uidSync !== estado.uid) { pararPersonal(); uidSync = estado.uid; }
  const ids = new Set(estado.alunos.map((a) => a.id));
  Object.keys(paradoresLista).forEach((k) => {
    if (!ids.has(k)) { paradoresLista[k](); delete paradoresLista[k]; delete resumo[k]; delete resumoDieta[k]; }
  });
  ids.forEach((id) => {
    if (paradoresLista[id]) return;
    const q = query(collection(db, 'usuarios', id, 'sessoes'), orderBy('data', 'desc'), limit(30));
    paradoresLista[id] = onSnapshot(q, (snap) => {
      resumo[id] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      nav.renderizar();
    }, (e) => { console.error(e); resumo[id] = resumo[id] || []; });
    // Dieta do aluno (lista + o que ele comeu), só para avisar quando ele passou do combinado.
    resumoDieta[id] = { plano: [], refeicoes: [] };
    const pPlano = onSnapshot(query(collection(db, 'usuarios', id, 'dietaItens'), orderBy('ordem', 'asc')), (snap) => {
      resumoDieta[id].plano = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      nav.renderizar();
    }, (e) => console.error(e));
    const pRef = onSnapshot(query(collection(db, 'usuarios', id, 'refeicoes'), orderBy('data', 'desc'), limit(7)), (snap) => {
      resumoDieta[id].refeicoes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      nav.renderizar();
    }, (e) => console.error(e));
    const pSessoes = paradoresLista[id];
    paradoresLista[id] = () => { pSessoes(); pPlano(); pRef(); };
  });
}

function abrirDetalhe(uid) {
  fecharDetalhe();
  alunoAberto = uid;
  abaAluno = 'treinos';
  dados = vazio();
  const ouvir = (sub, campo, restr) => {
    paradoresAluno.push(onSnapshot(query(collection(db, 'usuarios', uid, sub), ...restr), (snap) => {
      dados[campo] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      nav.renderizar();
    }, (e) => console.error(e)));
  };
  ouvir('treinos', 'treinos', [orderBy('ordem', 'asc')]);
  ouvir('dietaItens', 'dietaItens', [orderBy('ordem', 'asc')]);
  ouvir('sessoes', 'sessoes', [orderBy('data', 'desc'), limit(60)]);
  ouvir('peso', 'peso', [orderBy('data', 'desc'), limit(60)]);
  ouvir('checks', 'checks', [orderBy('data', 'desc'), limit(30)]);
  ouvir('medidas', 'medidas', [orderBy('data', 'desc'), limit(30)]);
  ouvir('refeicoes', 'refeicoes', [orderBy('data', 'desc'), limit(14)]);
  ouvir('recados', 'recados', [orderBy('criadoEm', 'desc'), limit(40)]);
  paradoresAluno.push(onSnapshot(doc(db, 'usuarios', uid), (snap) => {
    dados.perfilAluno = snap.exists() ? { ...snap.data() } : null;
    nav.renderizar();
  }, (e) => console.error(e)));
  paradoresAluno.push(onSnapshot(doc(db, 'usuarios', uid, 'config', 'metas'), (snap) => {
    dados.metas = snap.exists() ? { ...snap.data() } : null;
    nav.renderizar();
  }, (e) => console.error(e)));
}

function fecharDetalhe() {
  paradoresAluno.forEach((p) => p());
  paradoresAluno = [];
  alunoAberto = null;
  dados = vazio();
}

// ---------- Contas ----------
const diasDesde = (dataStr) => Math.floor((Date.now() - parseData(dataStr).getTime()) / 86400000);

function ultimaSessao(lista) {
  return [...lista].sort((a, b) => String(b.data).localeCompare(String(a.data)))[0] || null;
}

function situacao(vinculo) {
  const lista = resumo[vinculo.id];
  if (!lista) return { carregando: true };
  const ult = ultimaSessao(lista);
  const segunda = dataLocal(segundaDaSemana());
  const semana = lista.filter((s) => s.data >= segunda).length;
  const base = ult ? diasDesde(ult.data) : (vinculo.criadoEm ? Math.floor((Date.now() - new Date(vinculo.criadoEm).getTime()) / 86400000) : 0);
  return { ult, semana, dias: base, sumido: base >= DIAS_SUMIDO };
}

const ultimosDatas = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return dataLocal(d); });

// O que o aluno passou hoje (para o aviso ao personal).
function passouHoje(uid) {
  const r = resumoDieta[uid];
  if (!r) return null;
  const hoje = r.refeicoes.find((x) => x.data === dataLocal());
  const a = analisarDia(ordenarPlano(r.plano), (hoje && hoje.itens) || []);
  return a.passou.length ? textoPassou(a) : null;
}

function gerarCodigo() {
  const bytes = new Uint32Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => LETRAS[b % LETRAS.length]).join('');
}

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* tenta o jeito antigo */ }
  try {
    const t = document.createElement('textarea');
    t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  } catch { return false; }
}

// ---------- Telas ----------
function cartaoConvite() {
  const codigo = estado.perfil && estado.perfil.codigoConvite;
  if (!codigo) {
    return `
    <section class="card destaque">
      <h2>Convide seus alunos</h2>
      <p class="mudo">Gere um código e passe para o aluno. Ele digita em Minha conta, em “Tenho um código de personal”. Só quem tem o código consegue se conectar.</p>
      <div class="acoes-card"><button class="btn cheio" type="button" data-acao="p-convite-gerar">Gerar meu código</button></div>
    </section>`;
  }
  return `
  <section class="card convite-mini">
    <div class="convite-linha">
      <div class="convite-cod"><small class="mudo">Seu código de convite</small><p class="codigo-mini" aria-label="Código de convite">${escaparHtml(codigo)}</p></div>
      <div class="convite-acoes">
        <button class="btn pequeno" type="button" data-acao="p-convite-copiar">Copiar</button>
        <button class="btn pequeno secundario" type="button" data-acao="p-convite-novo">Trocar</button>
      </div>
    </div>
    <p class="mudo peq">O aluno digita em Minha conta. Quem já está conectado continua conectado se você trocar.</p>
  </section>`;
}

function cartaoAluno(v) {
  const s = situacao(v);
  const nome = v.alunoNome || v.alunoEmail || 'Aluno';
  let linha;
  if (s.carregando) linha = 'Carregando…';
  else if (!s.ult) linha = 'Ainda não treinou';
  else linha = `Último treino: ${formatarDataCurta(s.ult.data)}${s.dias === 0 ? ' (hoje)' : s.dias === 1 ? ' (ontem)' : ` (${s.dias} dias)`} · ${s.semana} na semana`;
  const passou = passouHoje(v.id);
  return `
  <button type="button" class="aluno-lin" data-acao="p-aluno-abrir" data-id="${escaparHtml(v.id)}">
    <span class="avatar peq" aria-hidden="true">${escaparHtml(nome.trim().charAt(0).toUpperCase())}</span>
    <span class="aluno-txt"><b>${escaparHtml(nome)}</b><small class="mudo">${escaparHtml(linha)}</small>
      ${passou ? `<small class="aluno-aviso">⚠️ Passou da dieta hoje: ${escaparHtml(passou)}</small>` : ''}</span>
    ${!s.carregando && s.sumido ? `<span class="selo alerta">${s.dias} dias</span>` : ''}
    <svg class="linha-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
  </button>`;
}

function cartaoModelos() {
  const lista = estado.modelos;
  return `
  <section class="card">
    <div class="card-topo"><h2>Modelos de treino</h2><button class="btn pequeno" type="button" data-acao="p-modelo-novo">+ Novo</button></div>
    <p class="mudo peq">Treinos prontos que você aplica em qualquer aluno com um toque.</p>
    ${lista.length ? listaRecolhivel('modelos', lista.map((m) => `<button type="button" class="regra-linha" data-acao="p-modelo-editar" data-id="${escaparHtml(m.id)}"><span>${escaparHtml(m.nome)}<br><small class="mudo">${(m.exercicios || []).length} exercício${(m.exercicios || []).length === 1 ? '' : 's'}</small></span><span class="seta" aria-hidden="true">›</span></button>`)) : '<p class="mudo vazio-peq">Nenhum modelo ainda.</p>'}
  </section>`;
}

function listaAlunos() {
  sincronizarLista();
  const sumidos = estado.alunos.filter((v) => { const s = situacao(v); return !s.carregando && s.sumido; });
  const passaram = estado.alunos.filter((v) => passouHoje(v.id));
  const cq = ordenar(conquistasPersonal(resumo));
  const prox = cq.find((c) => !c.ok);
  return `
  <header class="topo"><h1>Alunos</h1></header>
  ${avisoFaixa()}
  ${passaram.length ? `<p class="alerta-passou" role="status">⚠️ ${passaram.length === 1 ? '1 aluno passou' : passaram.length + ' alunos passaram'} da dieta hoje: ${escaparHtml(passaram.map((v) => v.alunoNome || 'Aluno').join(', '))}.</p>` : ''}
  ${cartaoConvite()}
  ${sumidos.length ? `<p class="alerta-atraso" role="status">⚠️ ${sumidos.length} ${sumidos.length === 1 ? 'aluno está' : 'alunos estão'} há ${DIAS_SUMIDO} dias ou mais sem treinar: ${escaparHtml(sumidos.map((v) => v.alunoNome || 'Aluno').join(', '))}.</p>` : ''}
  <section class="secao">
    <div class="secao-cab"><h2>Seus alunos${estado.alunos.length ? ` <span class="selo">${estado.alunos.length}</span>` : ''}</h2></div>
    ${estado.alunos.length
    ? `<div class="linhas alunos-lista">${estado.alunos.map(cartaoAluno).join('')}</div>`
    : '<section class="card"><p class="mudo vazio-grafico">Nenhum aluno conectado ainda.<br>Passe o código para o primeiro.</p></section>'}
  </section>
  <section class="secao">
    <div class="linhas">
      ${atalho('p-modelos-abrir', 'Modelos de treino', estado.modelos.length ? `${estado.modelos.length} ${estado.modelos.length === 1 ? 'modelo' : 'modelos'} · aplique em qualquer aluno` : 'Treinos prontos para aplicar em qualquer aluno')}
      ${atalho('pc-todas', 'Conquistas', `${cq.filter((c) => c.ok).length} de ${cq.length}${prox ? ` · próxima: ${prox.nome}` : ''}`)}
    </div>
  </section>`;
}

const atalho = (acao, titulo, sub) => `
      <button type="button" class="linha-menu" data-acao="${acao}"><span class="linha-txt"><b>${titulo}</b><small>${escaparHtml(sub)}</small></span><svg class="linha-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>`;

function blocoMacrosAluno(m) {
  const hoje = dataLocal();
  const doDia = dados.refeicoes.find((r) => r.data === hoje);
  const th = totais((doDia && doDia.itens) || []);
  const recentes = dados.refeicoes.filter((r) => (r.itens || []).length);
  if (!recentes.length) return '<p class="mudo peq">Ele ainda não anotou o que comeu.</p>';
  const soma = recentes.reduce((n, r) => n + totais(r.itens).kcal, 0);
  const media = Math.round(soma / recentes.length);
  const meta = typeof m.metaKcal === 'number' ? ` (meta ${m.metaKcal.toLocaleString('pt-BR')})` : '';
  return `<p class="mudo peq">Hoje: <strong>${th.kcal.toLocaleString('pt-BR')} kcal</strong>${meta}<br>
    Proteína ${formatarNumero(th.prot)} g · carbo ${formatarNumero(th.carb)} g · gordura ${formatarNumero(th.gord)} g<br>
    Média dos últimos ${recentes.length} ${recentes.length === 1 ? 'dia anotado' : 'dias anotados'}: <strong>${media.toLocaleString('pt-BR')} kcal</strong></p>`;
}

function blocoPassou(plano) {
  const dias = ultimosDatas(7).map((data) => {
    const r = dados.refeicoes.find((x) => x.data === data);
    return { data, anotou: !!(r && (r.itens || []).length), a: analisarDia(plano, (r && r.itens) || []) };
  }).filter((d) => d.anotou && d.a.passou.length);
  if (!dias.length) return '<p class="mudo peq">Nos últimos 7 dias ele não passou do combinado.</p>';
  return `<h3 class="sub">Passou do combinado (7 dias)</h3><div class="lista">${dias.map((d) => `<div class="linha-peso"><span>${formatarDataCurta(d.data)}<br><small class="mudo">${escaparHtml(textoPassou(d.a))}</small></span></div>`).join('')}</div>`;
}

function detalhe(v) {
  const nome = v.alunoNome || v.alunoEmail || 'Aluno';
  const segunda = dataLocal(segundaDaSemana());
  const mes = dataLocal().slice(0, 7);
  const sess = dados.sessoes;
  const semana = sess.filter((s) => s.data >= segunda).length;
  const noMes = sess.filter((s) => String(s.data).startsWith(mes)).length;
  const volSemana = sess.filter((s) => s.data >= segunda).reduce((n, s) => n + volumeSessao(s), 0);
  const planoAluno = ordenarPlano(dados.dietaItens);
  const dieta = cumprimentoPlano(planoAluno, dados.refeicoes, ultimosDatas(7));
  const ult = ultimaSessao(sess);
  const peso = [...dados.peso].sort((a, b) => String(b.data).localeCompare(String(a.data)))[0];
  const m = dados.metas || {};
  const medida = [...dados.medidas].sort((a, b) => String(b.data).localeCompare(String(a.data)))[0];
  return `
  <header class="topo">
    <button class="btn pequeno secundario" type="button" data-acao="p-aluno-voltar">‹ Alunos</button>
    <button class="btn pequeno" type="button" data-acao="p-aluno-recados">Recados</button>
  </header>
  <section class="card perfil-topo">
    <div class="avatar" aria-hidden="true">${escaparHtml(nome.trim().charAt(0).toUpperCase())}</div>
    <div><h2>${escaparHtml(nome)}</h2><p class="mudo peq">${escaparHtml(v.alunoEmail || '')}</p>
    <span class="selo">${ult ? `Último treino: ${formatarDataCurta(ult.data)}` : 'Ainda não treinou'}</span></div>
  </section>
  <section class="resumo">
    <div class="num-card"><strong>${semana}</strong><span>treinos na semana</span></div>
    <div class="num-card"><strong>${noMes}</strong><span>treinos no mês</span></div>
    <div class="num-card"><strong>${dieta === null ? '—' : dieta + '%'}</strong><span>dieta em 7 dias</span></div>
  </section>
  <nav class="abas-aluno" role="tablist" aria-label="Seções do aluno">
    ${[['treinos', 'Treinos'], ['dieta', 'Dieta'], ['corpo', 'Corpo'], ['perfil', 'Perfil']].map(([k, r]) => `<button type="button" role="tab" class="aba-aluno" data-acao="p-aba" data-aba="${k}" aria-selected="${abaAluno === k}">${r}</button>`).join('')}
  </nav>
  ${abaAluno === 'treinos' ? `<div class="grade-cards">
    <section class="card">
      <div class="card-topo"><h2>Treinos dele</h2><button class="btn pequeno" type="button" data-acao="p-treino-novo">+ Novo</button></div>
      ${dados.treinos.length ? listaRecolhivel('p-treinos', dados.treinos.map((t) => `
        <div class="linha-treino-aluno">
          <button type="button" class="regra-linha" data-acao="p-treino-editar" data-id="${escaparHtml(t.id)}"><span>${escaparHtml(t.nome)}<br><small class="mudo">${(t.exercicios || []).length} exercício${(t.exercicios || []).length === 1 ? '' : 's'}${(t.dias || []).length ? ' · ' + ORDEM_DIAS.filter((d) => t.dias.includes(d)).map((d) => DIAS_CURTOS[d]).join(' ') : ''}</small></span><span class="seta" aria-hidden="true">›</span></button>
          <button type="button" class="icone-peq" data-acao="p-treino-modelo" data-id="${escaparHtml(t.id)}" title="Salvar como modelo" aria-label="Salvar ${escaparHtml(t.nome)} como modelo">⧉</button>
        </div>`)) : '<p class="mudo vazio-peq">Nenhum treino ainda.</p>'}
      <div class="acoes-card"><button class="btn secundario cheio" type="button" data-acao="p-treino-modelo-usar">Usar um modelo</button></div>
    </section>
  </div>
  <section class="card">
    <h2>Últimos treinos dele</h2>
    ${sess.length ? listaRecolhivel('p-sessoes', sess.slice(0, 10).map((s) => `<button type="button" class="regra-linha" data-acao="p-aluno-sessao" data-id="${escaparHtml(s.id)}">
      <small class="hora">${formatarDataCurta(s.data)}</small>
      <span>${escaparHtml(s.treinoNome)}<br><small class="mudo">${s.duracaoMin ? s.duracaoMin + ' min · ' : ''}${Math.round(volumeSessao(s)).toLocaleString('pt-BR')} kg${(s.recordes || []).length ? ' · 🏆' : ''}${s.nota ? ' · 💬 tem anotação' : ''}</small></span><span class="seta" aria-hidden="true">›</span></button>`)) : '<p class="mudo">Nenhum treino feito ainda.</p>'}
  </section>` : ''}
  ${abaAluno === 'dieta' ? `<div class="grade-cards">
    <section class="card">
      <div class="card-topo"><h2>Dieta dele</h2><button class="btn pequeno" type="button" data-acao="p-dieta-item-novo">+ Item</button></div>
      <p class="mudo peq">Lista fixa, igual todos os dias. Ele só marca o que comeu.</p>
      ${planoAluno.length ? MOMENTOS.map((m) => [m, planoAluno.filter((p) => p.momento === m)]).filter(([, l]) => l.length).map(([m, l]) => `<div class="grupo-regras"><div class="card-topo"><h3>${m}</h3><button class="link" type="button" data-acao="p-dieta-item-novo" data-momento="${m}">+ item</button></div>
        <div class="lista">${l.map((p) => `<button type="button" class="regra-linha" data-acao="p-dieta-item-editar" data-id="${escaparHtml(p.id)}"><span>${escaparHtml(p.nome)}<br><small class="mudo">${escaparHtml(descreverQtd(p.qtd, p.unidade))}${p.kcal ? ` · ${formatarNumero(p.kcal)} kcal` : ''}</small></span><span class="seta" aria-hidden="true">›</span></button>`).join('')}</div></div>`).join('') : '<p class="mudo vazio-peq">Nenhum item ainda.</p>'}
      ${blocoPassou(planoAluno)}
    </section>
    <section class="card">
      <h2>Alimentação</h2>
      ${blocoMacrosAluno(m)}
    </section>
  </div>` : ''}
  ${abaAluno === 'corpo' ? `<div class="grade-cards">
    <section class="card">
      <h2>Metas dele</h2>
      <p class="mudo peq">Volume por dia: <strong>${typeof m.metaVolume === 'number' ? formatarVolume(m.metaVolume) : 'sem meta'}</strong><br>
      Água por dia: <strong>${typeof m.metaAgua === 'number' ? (m.metaAgua / 1000).toLocaleString('pt-BR') + ' L' : 'sem meta'}</strong><br>
      Peso desejado: <strong>${typeof m.metaPeso === 'number' ? formatarNumero(m.metaPeso) + ' kg' : 'sem meta'}</strong><br>
      Calorias por dia: <strong>${typeof m.metaKcal === 'number' ? m.metaKcal.toLocaleString('pt-BR') + ' kcal' : 'sem meta'}</strong><br>
      Proteína · carbo · gordura: <strong>${['metaProt', 'metaCarb', 'metaGord'].map((k) => (typeof m[k] === 'number' ? m[k] + ' g' : '—')).join(' · ')}</strong></p>
      <div class="acoes-card"><button class="btn secundario cheio" type="button" data-acao="p-aluno-metas">Definir metas</button></div>
    </section>
    <section class="card">
      <h2>Corpo</h2>
      <p class="mudo peq">Peso atual: <strong>${peso ? formatarNumero(peso.kg) + ' kg (' + formatarDataCurta(peso.data) + ')' : 'sem registro'}</strong>${typeof m.metaPeso === 'number' && peso ? `<br>Meta: <strong>${formatarNumero(m.metaPeso)} kg</strong> · faltam ${formatarNumero(Math.abs(peso.kg - m.metaPeso))} kg` : ''}</p>
      ${medida ? `<p class="mudo peq">Medidas (${formatarDataCurta(medida.data)}): ${[['peito', 'peito'], ['cintura', 'cintura'], ['quadril', 'quadril'], ['braco', 'braço'], ['coxa', 'coxa'], ['panturrilha', 'panturrilha']].filter(([k]) => typeof medida[k] === 'number').map(([k, n]) => `${n} ${formatarNumero(medida[k])} cm`).join(' · ')}</p>` : '<p class="mudo peq">Sem medidas registradas.</p>'}
      <p class="mudo peq">Volume levantado nesta semana: <strong>${formatarVolume(volSemana)}</strong></p>
      <div class="acoes-card"><button class="btn secundario cheio" type="button" data-acao="p-aluno-fotos">Ver fotos (se ele compartilhar)</button></div>
    </section>
  </div>` : ''}
  ${abaAluno === 'perfil' ? `<div class="grade-cards">
    <section class="card">
      <h2>Sobre o aluno</h2>
      ${(() => { const l = resumoAnamnese(dados.perfilAluno && dados.perfilAluno.anamnese); return l.length ? `<div class="lista-metas">${l.map(([k, v]) => `<div><span>${escaparHtml(k)}</span><strong>${escaparHtml(v)}</strong></div>`).join('')}</div>` : '<p class="mudo peq">Ele ainda não respondeu o questionário inicial.</p>'; })()}
    </section>
  </div>
  <button class="btn perigo-claro cheio" type="button" data-acao="p-aluno-remover">Remover este aluno</button>` : ''}`;
}

function atual() { return estado.alunos.find((a) => a.id === alunoAberto) || null; }

export const personal = {
  render() {
    if (alunoAberto) {
      const v = atual();
      if (!v) { fecharDetalhe(); return listaAlunos(); }
      return detalhe(v);
    }
    return listaAlunos();
  },
  acoes: {
    'p-convite-gerar': async () => {
      const codigo = gerarCodigo();
      try {
        await salvarGlobal('convites', codigo, { personalUid: estado.uid, personalNome: (estado.perfil && estado.perfil.nome) || '', criadoEm: new Date().toISOString() });
        await salvarPerfil(estado.uid, { codigoConvite: codigo }, { merge: true });
        toast('Código criado.');
      } catch (e) { console.error(e); toast('Não consegui criar o código. Confira a internet e as regras do Firebase.'); }
    },
    'p-convite-copiar': async () => {
      const codigo = estado.perfil && estado.perfil.codigoConvite;
      if (!codigo) return;
      toast((await copiar(codigo)) ? 'Código copiado.' : `Seu código: ${codigo}`);
    },
    'p-convite-novo': async () => {
      if (!(await confirmar('Trocar o código? O código antigo deixa de funcionar para novos alunos. Quem já está conectado continua.', { ok: 'Trocar' }))) return;
      const antigo = estado.perfil && estado.perfil.codigoConvite;
      const codigo = gerarCodigo();
      try {
        await salvarGlobal('convites', codigo, { personalUid: estado.uid, personalNome: (estado.perfil && estado.perfil.nome) || '', criadoEm: new Date().toISOString() });
        await salvarPerfil(estado.uid, { codigoConvite: codigo }, { merge: true });
        if (antigo) await removerGlobal('convites', antigo);
        toast('Código novo criado.');
      } catch (e) { console.error(e); toast('Não consegui trocar o código.'); }
    },
    'p-aluno-abrir': (el) => { abrirDetalhe(el.dataset.id); nav.renderizar(); window.scrollTo(0, 0); },
    'p-aluno-voltar': () => { fecharDetalhe(); nav.renderizar(); },
    'p-aluno-recados': () => {
      const v = atual();
      if (!v) return;
      abrirRecados({ donoUid: v.id, meuPapel: 'personal', titulo: `Recados com ${v.alunoNome || 'aluno'}`, lista: () => dados.recados });
    },
    'p-treino-novo': () => { if (alunoAberto) abrirEditorTreino(null, { uid: alunoAberto }); },
    'p-treino-editar': (el) => {
      const t = dados.treinos.find((x) => x.id === el.dataset.id);
      if (t) abrirEditorTreino(t, { uid: alunoAberto });
    },
    'p-treino-modelo': async (el) => {
      const t = dados.treinos.find((x) => x.id === el.dataset.id);
      if (!t) return;
      const resto = { ...t };
      delete resto.id;
      await salvarDoc(estado.uid, 'modelos', novoId(), { ...resto, dias: [], ordem: Date.now(), criadoEm: new Date().toISOString() });
      toast(`“${t.nome}” salvo nos seus modelos.`);
    },
    'p-treino-modelo-usar': () => {
      if (!estado.modelos.length) { toast('Você ainda não tem modelos. Crie um na lista de alunos.'); return; }
      const f = abrirFolha(`<h2>Qual modelo?</h2>
        <div class="lista">${estado.modelos.map((m) => `<button type="button" class="regra-linha" data-m="${escaparHtml(m.id)}"><span>${escaparHtml(m.nome)}<br><small class="mudo">${(m.exercicios || []).length} exercícios</small></span><span class="seta" aria-hidden="true">›</span></button>`).join('')}</div>
        <button class="btn secundario cheio" type="button" data-fechar>Cancelar</button>`);
      f.el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-m]');
        if (!b) return;
        const m = estado.modelos.find((x) => x.id === b.dataset.m);
        if (!m || !alunoAberto) return;
        const resto = { ...m };
        delete resto.id;
        await salvarDoc(alunoAberto, 'treinos', novoId(), { ...resto, ordem: Date.now(), criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString() });
        contar('treinos');
        f.fechar();
        toast('Treino aplicado ao aluno.');
      });
    },
    'p-dieta-item-novo': (el) => { if (alunoAberto) abrirEditorItem(el.dataset.momento, null, alunoAberto); },
    'p-dieta-item-editar': (el) => {
      const p = dados.dietaItens.find((x) => x.id === el.dataset.id);
      if (p) abrirEditorItem(p.momento, p, alunoAberto);
    },
    'p-aluno-fotos': () => {
      const v = atual();
      if (v) abrirFotos({ uid: alunoAberto, dono: false, nome: v.alunoNome || 'Aluno' });
    },
    'p-aluno-metas': () => {
      const m = dados.metas || {};
      const alvo = alunoAberto;
      const f = abrirFolha(`
        <h2>Metas do aluno</h2>
        <label class="campo">Volume por dia (kg) — vazio = sem meta<input class="in" inputmode="numeric" data-f="vol" value="${typeof m.metaVolume === 'number' ? m.metaVolume : ''}"></label>
        <label class="campo">Água por dia (litros) — vazio = sem meta<input class="in" inputmode="decimal" data-f="agua" value="${typeof m.metaAgua === 'number' ? String(m.metaAgua / 1000).replace('.', ',') : ''}"></label>
        <label class="campo">Peso desejado (kg) — vazio = sem meta<input class="in" inputmode="decimal" data-f="peso" value="${typeof m.metaPeso === 'number' ? String(m.metaPeso).replace('.', ',') : ''}"></label>
        <label class="campo">Calorias por dia (kcal) — vazio = sem meta<input class="in" inputmode="numeric" data-f="kcal" value="${typeof m.metaKcal === 'number' ? m.metaKcal : ''}"></label>
        <div class="grade3">
          <label class="campo">Proteína (g)<input class="in" inputmode="numeric" data-f="prot" value="${typeof m.metaProt === 'number' ? m.metaProt : ''}"></label>
          <label class="campo">Carbo (g)<input class="in" inputmode="numeric" data-f="carb" value="${typeof m.metaCarb === 'number' ? m.metaCarb : ''}"></label>
          <label class="campo">Gordura (g)<input class="in" inputmode="numeric" data-f="gord" value="${typeof m.metaGord === 'number' ? m.metaGord : ''}"></label>
        </div>
        <p class="erro" data-erro role="alert"></p>
        <div class="linha-botoes"><button class="btn secundario" type="button" data-fechar>Cancelar</button><button class="btn" type="button" data-ed="salvar">Salvar</button></div>`);
      f.el.addEventListener('click', (e) => {
        if (!e.target.closest('[data-ed="salvar"]')) return;
        const mac = {};
        let macroRuim = false;
        [['kcal', 'metaKcal', 20000], ['prot', 'metaProt', 1000], ['carb', 'metaCarb', 2000], ['gord', 'metaGord', 1000]].forEach(([k, campo, max]) => {
          const t = f.el.querySelector(`[data-f="${k}"]`).value.trim();
          const n = t ? numero(t) : null;
          if (t && (n === null || n <= 0 || n > max)) macroRuim = true;
          mac[campo] = n;
        });
        const tv = f.el.querySelector('[data-f="vol"]').value.trim();
        const ta = f.el.querySelector('[data-f="agua"]').value.trim();
        const tp = f.el.querySelector('[data-f="peso"]').value.trim();
        const v = tv ? numero(tv) : null;
        const a = ta ? numero(ta) : null;
        const p = tp ? numero(tp) : null;
        if ((tv && (v === null || v <= 0 || v > 1000000)) || (ta && (a === null || a <= 0 || a > 20)) || (tp && (p === null || p < 20 || p > 400)) || macroRuim) {
          f.el.querySelector('[data-erro]').textContent = 'Digite números válidos (ou deixe vazio).'; return;
        }
        salvarDoc(alvo, 'config', 'metas', { metaVolume: v, metaAgua: a === null ? null : Math.round(a * 1000), metaPeso: p, ...mac, definidoPor: estado.uid, atualizadoEm: new Date().toISOString() });
        f.fechar();
        toast('Metas salvas.');
      });
    },
    'p-aluno-sessao': (el) => {
      const s = dados.sessoes.find((x) => x.id === el.dataset.id);
      if (!s) return;
      const rot = { aq: ' (aquecimento)', dr: ' (drop)', fa: ' (falha)' };
      const blocos = (s.exercicios || []).map((e) => {
        if (e.cardio) return `<div class="det-ex"><strong>${escaparHtml(e.nome)}</strong> <span class="selo">cardio</span><p class="mudo peq">${e.feito ? formatarNumero(e.minutos) + ' min' : 'Não feito'}</p></div>`;
        const feitas = (e.series || []).filter((x) => x.feito);
        return `<div class="det-ex"><strong>${escaparHtml(e.nome)}</strong><p class="mudo peq">${feitas.length ? feitas.map((x) => `${x.carga != null ? formatarNumero(x.carga) + ' kg' : '—'} × ${x.reps != null ? formatarNumero(x.reps) : '—'}${rot[x.tipo] || ''}`).join(' · ') : 'Nenhuma série marcada'}</p></div>`;
      }).join('');
      abrirFolha(`<h2>${escaparHtml(s.treinoNome)}</h2>
        <p class="mudo peq">${parseData(s.data).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}${s.duracaoMin ? ' · ' + s.duracaoMin + ' min' : ''}</p>
        <p><strong>${Math.round(volumeSessao(s)).toLocaleString('pt-BR')} kg</strong> <span class="mudo">levantados</span></p>
        ${(s.recordes || []).length ? `<p class="ultima">🏆 Recordes: ${s.recordes.map((r) => `${escaparHtml(r.nome)} (${formatarNumero(r.carga)} kg)`).join(', ')}</p>` : ''}
        ${s.nota ? `<p class="obs">${escaparHtml(s.nota)}</p>` : ''}
        ${blocos}
        <button class="btn secundario cheio" type="button" data-fechar>Fechar</button>`);
    },
    'p-aluno-remover': async () => {
      const v = atual();
      if (!v) return;
      if (!(await confirmar(`Remover ${v.alunoNome || 'este aluno'}? Você deixa de ver os dados dele e de montar o treino. O que já foi montado fica com o aluno.`, { ok: 'Remover', perigo: true }))) return;
      try {
        await removerGlobal('vinculos', v.id);
        fecharDetalhe();
        nav.renderizar();
        toast('Aluno removido.');
      } catch (e) { console.error(e); toast('Não consegui remover. Tente de novo.'); }
    },
    'p-aba': (el) => { abaAluno = el.dataset.aba; nav.renderizar(); window.scrollTo(0, 0); },
    'p-modelos-abrir': () => abrirFolha(`${cartaoModelos()}<button class="btn secundario cheio" type="button" data-fechar>Fechar</button>`, { classe: 'folha-alta' }),
    'pc-todas': () => {
      const todas = ordenar(conquistasPersonal(resumo));
      abrirFolha(`<div class="card-topo"><h2>Conquistas</h2><span class="selo">${todas.filter((c) => c.ok).length} de ${todas.length}</span></div>
        <div class="conq-modal-lista">${todas.map((c) => linhaConq(c, 'pc-ver')).join('')}</div>
        <button class="btn cheio" type="button" data-fechar>Fechar</button>`, { classe: 'folha-alta' });
    },
    'pc-ver': (el) => {
      const c = conquistasPersonal(resumo).find((x) => x.nome === el.dataset.n);
      if (c) abrirFolha(folhaConquista(c));
    },
    'p-modelo-novo': () => { fecharTodasFolhas(); abrirEditorTreino(null, { uid: estado.uid, colecao: 'modelos' }); },
    'p-modelo-editar': (el) => {
      const m = estado.modelos.find((x) => x.id === el.dataset.id);
      if (m) { fecharTodasFolhas(); abrirEditorTreino(m, { uid: estado.uid, colecao: 'modelos' }); }
    }
  }
};

