// Assinatura: 1 mês grátis para conta nova; aluno de personal usa de graça enquanto o personal estiver em dia.
// A liberação é manual por enquanto: o dono do app muda o campo "ate" no console do Firebase.
import { estado } from './estado.js';
import { escaparHtml } from './util.js';

export const PRECOS = { aluno: 19.9, p5: 49.9, p15: 89.9, ilimitado: 129.9 };
export const LIMITES = { p5: 5, p15: 15 };
export const DIAS_TESTE = 30;
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
  // null = ainda não existe: o app está criando o mês grátis agora.
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

// Card do Perfil (e tela de acesso vencido).
export function blocoAssinatura() {
  const a = acesso();
  if (a.estado === 'carregando') return '';
  if (a.estado === 'vencido') {
    if (a.origem === 'personal') {
      return `<section class="card destaque aviso-venc"><h2>Acesso pausado</h2>
        <p>A assinatura do seu personal venceu. Assim que ele renovar, seu acesso volta sozinho. Seus dados estão guardados.</p></section>`;
    }
    return `<section class="card destaque aviso-venc"><h2>Seu acesso venceu</h2>
      <p>Seus dados continuam guardados. Para voltar a usar, renove a assinatura.</p>${tabelaPreco()}${comoPagar()}</section>`;
  }
  if (a.origem === 'personal') {
    return `<section class="card"><h2>Assinatura</h2><p class="mudo">Seu acesso está incluído no plano do seu personal. Você não paga nada.</p></section>`;
  }
  const teste = a.plano === 'teste';
  return `<section class="card"><h2>Assinatura</h2>
    <p>${teste ? 'Mês grátis de teste' : 'Plano ativo'} · vale até <strong>${dataBr(a.ate)}</strong> (${a.dias} ${a.dias === 1 ? 'dia' : 'dias'}).</p>
    ${tabelaPreco()}${a.dias <= 7 ? comoPagar() : ''}</section>`;
}

// Aviso curto na aba Hoje quando faltam 7 dias ou menos.
export function avisoAssinatura() {
  const a = acesso();
  if (a.estado !== 'ativo' || a.origem !== 'proprio' || a.dias > 7) return '';
  return `<p class="alerta-atraso" role="status">⏳ Sua assinatura vence em ${a.dias} ${a.dias === 1 ? 'dia' : 'dias'} (${dataBr(a.ate)}). Veja como renovar em Perfil.</p>`;
}

// Aviso para o personal quando passou do limite da faixa que paga.
export function avisoFaixa() {
  const a = estado.assinatura;
  if (!a || !LIMITES[a.plano]) return '';
  const n = estado.alunos.length;
  if (n <= LIMITES[a.plano]) return '';
  return `<p class="alerta-atraso" role="status">⚠️ Você tem ${n} alunos, mas seu plano é até ${LIMITES[a.plano]}. Fale para ajustar a faixa e não perder o acesso.</p>`;
}
