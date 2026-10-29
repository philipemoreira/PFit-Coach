// Aba Hoje: semana, treino do dia, dieta de hoje.
import { estado } from './estado.js';
import { abrirFolha, confirmar } from './folha.js';
import { escaparHtml, dataLocal, formatarDataLonga, segundaDaSemana } from './util.js';
import { salvarDoc } from './dados.js';
import { rascunhoSalvo, retomarTreino, descartarRascunho } from './treinar.js';
import { avisoPassou } from './dieta.js';
import { dietaLiberada } from './estado.js';
import { nav } from './nav.js';
import { blocoRecadosHoje } from './recados.js';
import { blocoMacros } from './alimentos.js';
import { avisoAssinatura } from './assinatura.js';
import { volumeDoDia, metaVolume, metaAgua, aguaDoDia, sequenciaSemanas, formatarVolume } from './metricas.js';

const LETRAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']; // segunda a domingo

function blocoRascunho() {
  const r = rascunhoSalvo();
  if (!r) return '';
  return `
  <section class="card destaque">
    <h2>Treino em andamento</h2>
    <p class="mudo">${escaparHtml(r.treinoNome)} — você começou e não finalizou.</p>
    <div class="linha-botoes">
      <button class="btn perigo-claro" type="button" data-acao="rascunho-descartar">Descartar</button>
      <button class="btn" type="button" data-acao="rascunho-continuar">Continuar</button>
    </div>
  </section>`;
}

// Faixa com os 7 dias da semana: os dias em que você treinou ficam acesos.
function faixaSemana() {
  const segunda = segundaDaSemana();
  const hojeStr = dataLocal();
  const dias = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(segunda);
    d.setDate(segunda.getDate() + i);
    const str = dataLocal(d);
    const treinou = estado.sessoes.some((s) => s.data === str);
    dias.push(`<div class="dia ${treinou ? 'on' : ''} ${str === hojeStr ? 'hoje' : ''}"><i aria-hidden="true">${treinou ? '✔' : ''}</i><span>${LETRAS[i]}</span></div>`);
  }
  return `<section class="faixa-semana" aria-label="Seus treinos nesta semana">${dias.join('')}</section>`;
}

function blocoHero() {
  const hoje = new Date();
  const dataStr = dataLocal(hoje);
  const doDia = estado.treinos.filter((t) => (t.dias || []).includes(hoje.getDay()));
  const feitos = new Set(estado.sessoes.filter((s) => s.data === dataStr).map((s) => s.treinoId));

  if (!estado.treinos.length && estado.vinculo) {
    return `
    <article class="hero-treino">
      <span class="rotulo-hero">Treino de hoje</span>
      <h2>Aguardando seu personal</h2>
      <p>${escaparHtml(estado.vinculo.personalNome || 'Seu personal')} ainda não montou seu treino.</p>
    </article>`;
  }
  if (!estado.treinos.length) {
    return `
    <article class="hero-treino">
      <span class="rotulo-hero">Treino de hoje</span>
      <h2>Vamos começar?</h2>
      <p>Você ainda não criou nenhum treino.</p>
      <button class="btn escuro cheio" type="button" data-acao="treino-novo">Criar meu primeiro treino</button>
    </article>`;
  }

  const feitoTodos = doDia.length > 0 && doDia.every((t) => feitos.has(t.id));
  const treinouHoje = feitos.size > 0;
  const itens = doDia.map((t) => `
    <div class="treino-dia ${feitos.has(t.id) ? 'ok' : ''}">
      <div>
        <strong>${escaparHtml(t.nome)}</strong>
        <p>${(t.exercicios || []).length} exercício${(t.exercicios || []).length === 1 ? '' : 's'}${feitos.has(t.id) ? ' · <span class="ok-txt">feito hoje ✔</span>' : ''}</p>
      </div>
      <button class="btn pequeno ${feitos.has(t.id) ? 'secundario' : 'escuro'}" type="button" data-acao="treino-iniciar" data-id="${escaparHtml(t.id)}">${feitos.has(t.id) ? 'Repetir' : 'Iniciar'}</button>
    </div>`).join('');
  const livre = !doDia.length ? (treinouHoje ? '<h2>Você treinou hoje ✔</h2><p>Treino feito. Bom descanso!</p>' : '<h2>Dia livre</h2><p>Nenhum treino marcado para hoje.</p>') : '';

  return `
  <article class="hero-treino ${feitoTodos || (!doDia.length && treinouHoje) ? 'feito' : ''}">
    <span class="rotulo-hero">${feitoTodos || (!doDia.length && treinouHoje) ? '✔ Treino de hoje feito' : 'Treino de hoje'}</span>
    ${feitoTodos ? '<h2 class="feito-tit">Treino feito! 💪</h2>' : ''}
    ${itens || livre}
    <button class="link" type="button" data-acao="treino-outro">${doDia.length ? (feitoTodos ? 'Fazer outro treino' : 'Treinar outro treino') : 'Escolher um treino para fazer agora'}</button>
  </article>`;
}

function blocoTiles() {
  const semana = dataLocal(segundaDaSemana());
  const treinosSemana = estado.sessoes.filter((s) => s.data >= semana).length;
  return `
  <article class="tile">
    <span class="numero">${treinosSemana}</span>
    <span class="rotulo">treino${treinosSemana === 1 ? '' : 's'} na semana</span>
  </article>`;
}

function barra(valor, meta) {
  const pct = meta ? Math.min(100, (valor / meta) * 100) : 0;
  return `<div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="${meta || 0}" aria-valuenow="${Math.round(valor)}"><i style="width:${pct.toFixed(1)}%"></i></div>`;
}

function blocoVolumeHoje() {
  const vol = volumeDoDia(dataLocal());
  const mv = metaVolume();
  return `
  <section class="card volume-hoje">
    <div class="card-topo"><h2>Volume de hoje</h2>${mv && vol >= mv ? '<span class="selo">meta batida 🎉</span>' : ''}</div>
    <p class="volume-num">${Math.round(vol).toLocaleString('pt-BR')} <small>kg levantados</small></p>
    ${mv ? `${barra(vol, mv)}<p class="mudo peq">Meta do dia: ${formatarVolume(mv)}${vol < mv ? ` · faltam ${formatarVolume(mv - vol)}` : ''}</p>`
    : '<p class="mudo peq">Soma de carga × repetições dos seus treinos de hoje. <button class="link" type="button" data-acao="metas-editar">Definir meta</button></p>'}
    <button class="btn secundario cheio pequeno" type="button" data-acao="stats-abrir">Ver estatísticas ›</button>
  </section>`;
}

function blocoAgua() {
  const ml = aguaDoDia();
  const ma = metaAgua();
  const seq = sequenciaSemanas();
  return `
  <section class="card">
    <div class="card-topo"><h2>Água</h2><span class="selo">${seq.semanas > 0 ? `🔥 ${seq.semanas} sem. seguida${seq.semanas === 1 ? '' : 's'}` : 'sem sequência ainda'}</span></div>
    <p class="grande">${(ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} <small>litros</small></p>
    ${ma ? `${barra(ml, ma)}<p class="mudo peq">Meta: ${(ma / 1000).toLocaleString('pt-BR')} L · 1 copo = 250 ml</p>` : '<p class="mudo peq">1 copo = 250 ml. <button class="link" type="button" data-acao="metas-editar">Definir meta</button></p>'}
    <div class="acoes-card linha"><button class="btn secundario" type="button" data-acao="agua-menos" aria-label="Tirar um copo">− Copo</button><button class="btn" type="button" data-acao="agua-mais" aria-label="Adicionar um copo de 250 mililitros">+ Copo</button></div>
  </section>`;
}

export const hoje = {
  render() {
    const nome = ((estado.perfil && estado.perfil.nome) || '').split(' ')[0];
    return `
    <header class="hoje-topo">
      <p class="mudo">${formatarDataLonga()}</p>
      <h1>Olá${nome ? ', ' + escaparHtml(nome) : ''}</h1>
    </header>
    ${avisoAssinatura()}
    ${dietaLiberada() ? avisoPassou() : ''}
    ${blocoRascunho()}
    ${faixaSemana()}
    <section class="bento">
      ${blocoHero()}
      ${blocoTiles()}
    </section>
    <div class="grade-cards">${blocoVolumeHoje()}${blocoAgua()}${dietaLiberada() ? blocoMacros() : ''}${blocoRecadosHoje()}</div>`;
  },
  acoes: {
    'agua-mais': () => { const d = dataLocal(); salvarDoc(estado.uid, 'agua', d, { data: d, ml: aguaDoDia(d) + 250 }); },
    'agua-menos': () => { const d = dataLocal(); salvarDoc(estado.uid, 'agua', d, { data: d, ml: Math.max(0, aguaDoDia(d) - 250) }); },
    'treino-outro': () => {
      if (!estado.treinos.length) return;
      abrirFolha(`
        <h2>Qual treino?</h2>
        <div class="lista">
          ${estado.treinos.map((t) => `<button type="button" class="regra-linha" data-acao="treino-iniciar" data-id="${escaparHtml(t.id)}"><span>${escaparHtml(t.nome)}</span><span class="seta" aria-hidden="true">›</span></button>`).join('')}
        </div>
        <button class="btn secundario cheio" type="button" data-fechar>Cancelar</button>`);
    },
    'rascunho-continuar': () => retomarTreino(),
    'rascunho-descartar': async () => {
      if (await confirmar('Descartar o treino que ficou em andamento? O que foi marcado vai ser perdido.', { ok: 'Descartar', perigo: true })) {
        descartarRascunho();
        nav.renderizar();
      }
    }
  }
};
