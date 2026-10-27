// Aba Dieta: regras para o dia a dia, para o fim de semana e para todos os dias.
import { estado } from './estado.js';
import { abrirFolha, confirmar } from './folha.js';
import { escaparHtml, novoId, eFimDeSemana } from './util.js';
import { salvarDoc, removerDoc } from './dados.js';
import { nav } from './nav.js';

const GRUPOS = [
  { id: 'sempre', titulo: 'Todos os dias', sub: '' },
  { id: 'semana', titulo: 'Dia a dia', sub: 'segunda a sexta' },
  { id: 'fds', titulo: 'Fim de semana', sub: 'sábado e domingo' }
];

export const grupoDeHoje = (d = new Date()) => (eFimDeSemana(d) ? 'fds' : 'semana');

function ordenar(lista) {
  return [...lista].sort((a, b) => {
    const ha = a.horario || '99:99';
    const hb = b.horario || '99:99';
    if (ha !== hb) return ha < hb ? -1 : 1;
    return (a.ordem || 0) - (b.ordem || 0);
  });
}

// Regras que valem para o dia (todos os dias + semana ou fim de semana).
export function regrasDoDia(d = new Date()) {
  const g = grupoDeHoje(d);
  return ordenar(estado.regras.filter((r) => r.grupo === 'sempre' || r.grupo === g));
}

function linhaRegra(r) {
  return `<button type="button" class="regra-linha" data-acao="regra-editar" data-id="${escaparHtml(r.id)}">
    ${r.horario ? `<small class="hora">${escaparHtml(r.horario)}</small>` : ''}
    <span>${escaparHtml(r.texto)}</span>
    <span class="seta" aria-hidden="true">›</span>
  </button>`;
}

function blocoGrupo(g) {
  const regras = ordenar(estado.regras.filter((r) => r.grupo === g.id));
  const hoje = g.id === 'sempre' || g.id === grupoDeHoje();
  return `
  <section class="card">
    <div class="card-topo">
      <div><h2>${g.titulo}</h2>${g.sub ? `<p class="mudo peq">${g.sub}</p>` : ''}</div>
      ${hoje ? '<span class="selo">vale hoje</span>' : ''}
    </div>
    ${regras.length ? `<div class="lista">${regras.map(linhaRegra).join('')}</div>` : '<p class="mudo vazio-peq">Nenhuma regra ainda.</p>'}
    <div class="acoes-card"><button class="btn secundario cheio" type="button" data-acao="regra-nova" data-grupo="${g.id}">+ Adicionar regra</button></div>
  </section>`;
}

function abrirEditor(grupoInicial, regra) {
  const grupo = regra ? regra.grupo : grupoInicial || 'sempre';
  const folha = abrirFolha(`
    <h2>${regra ? 'Editar regra' : 'Nova regra'}</h2>
    <label class="campo">Regra
      <textarea class="in" data-f="texto" rows="3" maxlength="300" placeholder="Escreva a regra do seu jeito"></textarea>
    </label>
    <label class="campo">Quando vale
      <select class="in" data-f="grupo">
        ${GRUPOS.map((g) => `<option value="${g.id}" ${g.id === grupo ? 'selected' : ''}>${g.titulo}${g.sub ? ` (${g.sub})` : ''}</option>`).join('')}
      </select>
    </label>
    <label class="campo">Horário (opcional)
      <input class="in" type="time" data-f="horario">
    </label>
    <p class="erro" data-erro role="alert"></p>
    <div class="linha-botoes">
      ${regra ? '<button class="btn perigo-claro" type="button" data-ed="excluir">Excluir</button>' : '<button class="btn secundario" type="button" data-fechar>Cancelar</button>'}
      <button class="btn" type="button" data-ed="salvar">Salvar</button>
    </div>`);
  const el = folha.el;
  const campo = (n) => el.querySelector(`[data-f="${n}"]`);
  if (regra) {
    campo('texto').value = regra.texto || '';
    campo('horario').value = regra.horario || '';
  }
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ed]');
    if (!b) return;
    if (b.dataset.ed === 'salvar') {
      const texto = campo('texto').value.trim();
      if (!texto) { el.querySelector('[data-erro]').textContent = 'Escreva a regra.'; return; }
      const dados = {
        texto,
        grupo: campo('grupo').value,
        horario: campo('horario').value || null,
        ordem: regra ? regra.ordem : Date.now(),
        criadoEm: regra ? regra.criadoEm : new Date().toISOString()
      };
      salvarDoc(estado.uid, 'regras', regra ? regra.id : novoId(), dados);
      folha.fechar();
    } else if (b.dataset.ed === 'excluir') {
      if (await confirmar('Excluir essa regra?', { ok: 'Excluir', perigo: true })) {
        removerDoc(estado.uid, 'regras', regra.id);
        folha.fechar();
      }
    }
  });
}

export const dieta = {
  render() {
    return `
    <header class="topo"><h1>Dieta</h1></header>
    <p class="mudo peq margem-b">Suas regras de alimentação. Na aba Hoje você marca o que cumpriu no dia.</p>
    <div class="grade-cards tres">${GRUPOS.map(blocoGrupo).join('')}</div>
    <p class="aviso-rodape">Este app organiza a sua dieta, mas não substitui nutricionista nem médico.</p>`;
  },
  acoes: {
    'regra-nova': (el) => {
      nav.irPara('dieta');
      abrirEditor(el.dataset.grupo);
    },
    'regra-editar': (el) => {
      const r = estado.regras.find((x) => x.id === el.dataset.id);
      if (r) abrirEditor(r.grupo, r);
    }
  }
};
