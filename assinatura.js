// Assinatura: 15 dias grátis para conta nova; aluno de personal usa de graça enquanto o personal estiver em dia.
// A liberação é manual por enquanto: o dono do app muda o campo "ate" no console do Firebase.
import { estado } from './estado.js';
import { escaparHtml } from './util.js';

export const PRECOS = { aluno: 19.9, p5: 49.9, p15: 89.9, ilimitado: 129.9 };
export const LIMITES = { p5: 5, p15: 15 };
export const DIAS_TESTE = 15;
// Preencha com a forma de pagamento (ex.: "Pix: ..." ou um link). Enquanto estiver vazio, o app só pede para falar com você.
export const COMO_PAGAR = '';

const reais = (v) => 'R$ ' + v.toFixed(2).replace('.', ',');
const ms = (v) => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
};
const valida = (a) => !!a && ms(a.ate) > Date.now();
const dataBr = (t) => new Date(t).toLocaleDateString('pt-BR');

export function faixaPorAlunos(n) {
  return n <= LIMITES.p5 ? 'p5' : n <= LIMITES.p15 ? 'p15' : 'ilimitado';
}

// { estado: 'carregando' | 'ativo' | 'vencido', origem: 'proprio' | 'personal', ate, dias, plano }
export function acesso() {
  // null = ainda não existe: o app está criando o teste grátis agora.
  if (estado.assinatura === undefined || estado.assinatura === null) return { estado: 'carregando' };
  if (estado.vinculo) {
    if (estado.assinaturaPersonal === undefined) return { estado: 'carregando' };
    return valida(estado.assinaturaPersonal)
      ? { estado: 'ativo', origem: 'personal' }
      : { estado: 'vencido', origem: 'personal' };
  }
  const a = estado.assinatura;
  const fim = ms(a.ate);
  return {
    estado: fim > Date.now() ? 'ativo' : 'vencido',
    origem: 'proprio',
    ate: fim,
    dias: Math.max(0, Math.ceil((fim - Date.now()) / 86400000)),
    plano: a ? a.plano : null
  };
}

export const bloqueado = () => acesso().estado === 'vencido';

function tabelaPreco() {
  const personal = estado.perfil && estado.perfil.papel === 'personal';
  if (!personal) return `<p>Plano do aluno: <strong>${reais(PRECOS.aluno)}/mês</strong>.</p>`;
  return `<ul class="lista-simples"><li>Até ${LIMITES.p5} alunos: <strong>${reais(PRECOS.p5)}/mês</strong></li><li>De ${LIMITES.p5 + 1} a ${LIMITES.p15} alunos: <strong>${reais(PRECOS.p15)}/mês</strong></li><li>${LIMITES.p15 + 1} alunos ou mais: <strong>${reais(PRECOS.ilimitado)}/mês</strong></li></ul>`;
}

const comoPagar = () => (COMO_PAGAR
  ? `<p>${escaparHtml(COMO_PAGAR)}</p>`
  : '<p class="mudo">Para renovar, fale com quem te passou o app.</p>');

// Conteúdo da assinatura: { cls, html } (html começa com o título). Usado no card da conta.
export function corpoAssinatura() {
  const a = acesso();
  if (a.estado === 'carregando') return null;
  if (a.estado === 'vencido') {
    if (a.origem === 'personal') {
      return { cls: 'aviso-venc', html: `<h3 class="sub-conta">Acesso pausado</h3>
        <p>A assinatura do seu personal venceu. Assim que ele renovar, seu acesso volta sozinho. Seus dados estão guardados.</p>` };
    }
    return { cls: 'aviso-venc', html: `<h3 class="sub-conta">Seu acesso venceu</h3>
      <p>Seus dados continuam guardados. Para voltar a usar, renove a assinatura.</p>${tabelaPreco()}${comoPagar()}` };
  }
  if (a.origem === 'personal') {
    return { cls: '', html: `<h3 class="sub-conta">Assinatura</h3><p class="mudo">Seu acesso está incluído no plano do seu personal. Você não paga nada.</p>` };
  }
  const teste = a.plano === 'teste';
  return { cls: '', html: `<h3 class="sub-conta">Assinatura</h3>
    <p>${teste ? 'Teste grátis' : 'Plano ativo'} · vale até <strong>${dataBr(a.ate)}</strong> (${a.dias} ${a.dias === 1 ? 'dia' : 'dias'}).</p>
    ${tabelaPreco()}${a.dias <= 7 ? comoPagar() : ''}` };
}

// Card da assinatura sozinho (mantido para quem precisar).
export function blocoAssinatura() {
  const c = corpoAssinatura();
  return c ? `<section class="card ${c.cls ? 'destaque ' + c.cls : ''}">${c.html}</section>` : '';
}

// Aviso curto na aba Hoje quando faltam 7 dias ou menos.
export function avisoAssinatura() {
  const a = acesso();
  if (a.estado !== 'ativo' || a.origem !== 'proprio' || a.dias > 7) return '';
  return `<p class="alerta-atraso" role="status">⏳ Sua assinatura vence em ${a.dias} ${a.dias === 1 ? 'dia' : 'dias'} (${dataBr(a.ate)}). Veja como renovar em Minha conta (toque na engrenagem, no topo).</p>`;
}

// Aviso para o personal quando passou do limite da faixa que paga.
export function avisoFaixa() {
  const a = estado.assinatura;
  if (!a || !LIMITES[a.plano]) return '';
  const n = estado.alunos.length;
  if (n <= LIMITES[a.plano]) return '';
  return `<p class="alerta-atraso" role="status">⚠️ Você tem ${n} alunos, mas seu plano é até ${LIMITES[a.plano]}. Fale para ajustar a faixa e não perder o acesso.</p>`;
}

// Cartão da assinatura para a tela Minha conta: situação em cima e os planos em cartões embaixo.
const planoCard = (nome, sub, preco, atual) => `<div class="plano ${atual ? 'atual' : ''}">
  ${atual ? '<span class="plano-tag">Seu plano</span>' : ''}
  <b class="plano-nome">${nome}</b><small class="mudo">${sub}</small>
  <span class="plano-preco">${reais(preco)}<small>/mês</small></span></div>`;

export function cartaoPlanos() {
  const a = acesso();
  if (a.estado === 'carregando') return '';
  const personal = estado.perfil && estado.perfil.papel === 'personal';
  if (a.origem === 'personal') {
    const ok = a.estado === 'ativo';
    return `<section class="card assin-card ${ok ? '' : 'venc'}"><div class="assin-topo"><h2>${ok ? 'Incluída no plano do personal' : 'Acesso pausado'}</h2></div>
      <p class="mudo">${ok ? 'Seu acesso está incluído no plano do seu personal. Você não paga nada.' : 'A assinatura do seu personal venceu. Assim que ele renovar, seu acesso volta sozinho. Seus dados estão guardados.'}</p></section>`;
  }
  const venc = a.estado === 'vencido';
  const pct = venc ? 0 : Math.max(4, Math.min(100, (a.dias / DIAS_TESTE) * 100));
  const nome = a.plano === 'teste' ? 'Teste grátis' : 'Plano ativo';
  return `<section class="card assin-card ${venc ? 'venc' : ''}">
    <div class="assin-topo"><h2>${venc ? 'Seu acesso venceu' : nome}</h2>${venc ? '' : `<span class="selo">${a.dias} ${a.dias === 1 ? 'dia' : 'dias'}</span>`}</div>
    <p class="mudo">${venc ? 'Seus dados continuam guardados. Para voltar a usar, renove a assinatura.' : `Vale até <strong>${dataBr(a.ate)}</strong>.`}</p>
    ${venc ? '' : `<span class="assin-trilho" aria-hidden="true"><i style="width:${pct.toFixed(0)}%"></i></span>`}
    <div class="acoes-card"><button class="btn ${venc ? '' : 'secundario'} cheio" type="button" data-acao="planos-abrir">Ver planos</button></div>
  </section>`;
}

// Conteúdo da janela "Planos".
export function folhaPlanos() {
  const a = acesso();
  const personal = estado.perfil && estado.perfil.papel === 'personal';
  const venc = a.estado === 'vencido';
  const faixa = personal ? faixaPorAlunos(estado.alunos.length) : 'aluno';
  const marca = (k) => !venc && a.origem === 'proprio' && (a.plano === k || (a.plano === 'teste' && faixa === k));
  const planos = personal
    ? [planoCard('Até 5 alunos', 'Para começar', PRECOS.p5, marca('p5')),
      planoCard('6 a 15 alunos', 'Para crescer', PRECOS.p15, marca('p15')),
      planoCard('16 alunos ou mais', 'Sem limite', PRECOS.ilimitado, marca('ilimitado'))].join('')
    : planoCard('Plano do aluno', 'Treino e dieta completos', PRECOS.aluno, marca('aluno'));
  return `<h2>Planos</h2>
    <p class="mudo peq">${personal ? 'O preço depende de quantos alunos você tem conectados.' : 'Tudo incluído: treino, dieta e progresso.'} Os 15 primeiros dias são grátis.</p>
    <div class="planos ${personal ? '' : 'um'}">${planos}</div>
    ${a.estado === 'ativo' && a.origem === 'proprio' && a.dias > 7 ? '' : comoPagar()}
    <button class="btn secundario cheio" type="button" data-fechar>Fechar</button>`;
}
