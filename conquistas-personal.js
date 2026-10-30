// Conquistas do personal: ligadas aos ALUNOS (quantos tem, treinos e dietas montados, treinos que eles fazem).
// Contadores de "montados" e "recados" ficam no perfil do personal (perfil.contadores); o resto é calculado na hora.
import { estado } from './estado.js';
import { salvarPerfil } from './dados.js';
import { escaparHtml, dataLocal, segundaDaSemana } from './util.js';
import { textoProgresso, percentualConquista } from './metricas.js';

// Soma 1 em um contador do perfil (só para personal).
export function contar(chave) {
  const p = estado.perfil;
  if (!p || p.papel !== 'personal') return;
  const atual = (p.contadores && p.contadores[chave]) || 0;
  const novo = { ...(p.contadores || {}), [chave]: atual + 1 };
  p.contadores = novo; // atualiza já, para contar certo se salvar de novo antes do banco responder
  salvarPerfil(estado.uid, { contadores: novo }, { merge: true });
}

// resumo = { uidAluno: [sessões recentes] } (o que o app já escuta; nada de leitura extra)
export function conquistasPersonal(resumo) {
  const cont = (estado.perfil && estado.perfil.contadores) || {};
  const nAlunos = estado.alunos.length;
  const maxAlunos = Math.max(nAlunos, cont.alunosMax || 0);
  const seg = dataLocal(segundaDaSemana(new Date()));
  const naSemana = (id) => (resumo[id] || []).filter((s) => s.data && s.data >= seg).length;
  const treinosSemana = estado.alunos.reduce((n, v) => n + naSemana(v.id), 0);
  const ativos = estado.alunos.filter((v) => naSemana(v.id) > 0).length;
  const c = (icone, nome, desc, atual, alvo, unidade = '') => ({ icone, nome, desc, ok: atual >= alvo, atual: Math.min(atual, alvo), alvo, fmt: 'n', unidade });
  return [
    c('🤝', 'Primeiro aluno', 'Conecte 1 aluno ao seu código', maxAlunos, 1, 'aluno'),
    c('👥', '5 alunos', 'Tenha 5 alunos conectados', maxAlunos, 5, 'alunos'),
    c('🏟️', '10 alunos', 'Tenha 10 alunos conectados', maxAlunos, 10, 'alunos'),
    c('🌟', '25 alunos', 'Tenha 25 alunos conectados', maxAlunos, 25, 'alunos'),
    c('📝', 'Primeiro treino montado', 'Monte 1 treino (para um aluno ou um modelo)', cont.treinos || 0, 1, 'treino'),
    c('📋', '10 treinos montados', 'Monte 10 treinos para seus alunos', cont.treinos || 0, 10, 'treinos'),
    c('🗂️', '50 treinos montados', 'Monte 50 treinos. Você é uma máquina de treinos.', cont.treinos || 0, 50, 'treinos'),
    c('🥗', 'Primeira dieta', 'Coloque 1 alimento na dieta de um aluno', cont.dietas || 0, 1, 'alimento'),
    c('🍽️', 'Dieta montada', 'Coloque 30 alimentos nas dietas dos alunos', cont.dietas || 0, 30, 'alimentos'),
    c('🍎', 'Nutrição em dia', 'Coloque 150 alimentos nas dietas dos alunos', cont.dietas || 0, 150, 'alimentos'),
    c('🔥', 'Semana movimentada', 'Seus alunos fazem 10 treinos na mesma semana', treinosSemana, 10, 'treinos'),
    c('🚀', 'Semana de ouro', 'Seus alunos fazem 30 treinos na mesma semana', treinosSemana, 30, 'treinos'),
    c('💯', 'Todo mundo treinando', 'Pelo menos 3 alunos diferentes treinaram esta semana', ativos, 3, 'alunos'),
    c('💬', '10 recados', 'Envie 10 recados aos alunos', cont.recados || 0, 10, 'recados'),
    c('📣', '50 recados', 'Envie 50 recados aos alunos. Presença de verdade.', cont.recados || 0, 50, 'recados')
  ];
}

function barra(c, grande) {
  const real = percentualConquista(c);
  const pct = Math.floor(real) < 1 ? 0 : real;
  return `<span class="conq-trilho ${grande ? 'grande' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(pct)}" aria-label="Progresso: ${escaparHtml(c.nome)}"><i style="width:${pct.toFixed(1)}%"></i></span>`;
}

export function linhaConq(c, acao) {
  const n = `data-acao="${acao}" data-n="${escaparHtml(c.nome)}"`;
  if (c.ok) {
    return `<button type="button" class="conq-lin feita" ${n}><span class="conq-topo"><span class="conq-ico" aria-hidden="true">${c.icone}</span><span class="conq-nome"><b>${escaparHtml(c.nome)}</b><small>Conquistada</small></span><span class="conq-check" aria-label="Conquistada">✓</span></span></button>`;
  }
  return `<button type="button" class="conq-lin" ${n}><span class="conq-topo"><span class="conq-ico" aria-hidden="true">${c.icone}</span><span class="conq-nome"><b>${escaparHtml(c.nome)}</b><small>${escaparHtml(textoProgresso(c))}</small></span><em class="conq-pct">${Math.floor(percentualConquista(c))}%</em></span>${barra(c, false)}</button>`;
}

export const ordenar = (lista) => [
  ...lista.filter((c) => !c.ok).sort((a, b) => percentualConquista(b) - percentualConquista(a)),
  ...lista.filter((c) => c.ok)
];

export function cartaoConquistasPersonal(resumo) {
  const todas = ordenar(conquistasPersonal(resumo));
  const faltam = todas.filter((c) => !c.ok);
  return `
  <section class="card conq-card">
    <div class="card-topo"><h2>Conquistas</h2><span class="selo">${todas.length - faltam.length} de ${todas.length}</span></div>
    ${faltam.length ? `<div class="conq-lista">${faltam.slice(0, 3).map((c) => linhaConq(c, 'pc-ver')).join('')}</div>` : '<p class="mudo">Você conquistou tudo! 🏆</p>'}
    <button class="btn secundario cheio" type="button" data-acao="pc-todas">Ver todas as ${todas.length} conquistas ›</button>
  </section>`;
}

export function folhaConquista(c) {
  const prog = c.ok ? '' : `${barra(c, true)}<p class="conq-cont grande-cont"><span>${escaparHtml(textoProgresso(c))}</span><em>${Math.floor(percentualConquista(c))}%</em></p>`;
  return `<div class="conq-folha"><span class="conq-folha-ico ${c.ok ? 'ok' : ''}" aria-hidden="true">${c.icone}</span><h2>${escaparHtml(c.nome)}</h2><p>${c.ok ? '✅ Conquistada!' : '🔒 Ainda não.'}</p><p class="mudo">${escaparHtml(c.desc)}</p>${prog}</div><button class="btn cheio" type="button" data-fechar>Fechar</button>`;
}
