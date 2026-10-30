// Recados entre aluno e personal (uma conversa simples, sem tempo real além do que o banco já dá).
import { estado } from './estado.js';
import { contar } from './conquistas-personal.js';
import { abrirFolha } from './folha.js';
import { escaparHtml, novoId, toast } from './util.js';
import { salvarDoc } from './dados.js';

const quando = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function bolhas(lista, meuPapel) {
  if (!lista.length) return '<p class="mudo vazio-grafico">Nenhum recado ainda.</p>';
  return `<div class="recados">${[...lista].sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm))).map((r) => `
    <div class="recado ${r.de === meuPapel ? 'meu' : ''}">
      <p>${escaparHtml(r.texto)}</p>
      <small>${r.de === 'personal' ? 'Personal' : 'Aluno'} · ${quando(r.criadoEm)}</small>
    </div>`).join('')}</div>`;
}

// Abre a conversa. dono = uid da conta onde os recados ficam (o aluno); meuPapel = 'aluno' ou 'personal'.
export function abrirRecados({ donoUid, meuPapel, titulo, lista }) {
  const f = abrirFolha(`
    <h2>${escaparHtml(titulo)}</h2>
    <div id="recados-lista">${bolhas(lista(), meuPapel)}</div>
    <label class="campo">Novo recado<textarea class="in" data-f="texto" rows="3" maxlength="500" placeholder="Escreva aqui"></textarea></label>
    <div class="linha-botoes"><button class="btn secundario" type="button" data-fechar>Fechar</button><button class="btn" type="button" data-ed="enviar">Enviar</button></div>`, { classe: 'folha-alta' });
  const caixa = f.el.querySelector('[data-f="texto"]');
  const corpo = f.el.querySelector('#recados-lista');
  corpo.scrollTop = corpo.scrollHeight;
  // Atualiza a lista se chegar recado novo com a janela aberta.
  const timer = setInterval(() => {
    if (!document.body.contains(f.el)) { clearInterval(timer); return; }
    const novo = bolhas(lista(), meuPapel);
    if (corpo.innerHTML !== novo) { corpo.innerHTML = novo; corpo.scrollTop = corpo.scrollHeight; }
  }, 500);
  f.el.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-ed="enviar"]')) return;
    const texto = caixa.value.trim();
    if (!texto) return;
    await salvarDoc(donoUid, 'recados', novoId(), { texto, de: meuPapel, autorUid: estado.uid, criadoEm: new Date().toISOString() });
    caixa.value = '';
    if (meuPapel === 'personal') contar('recados');
    toast('Recado enviado.');
  });
  return f;
}

// Cartão em Hoje (só para quem tem personal).
export function blocoRecadosHoje() {
  if (!estado.vinculo) return '';
  const ultimo = [...estado.recados].sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))[0];
  return `
  <section class="card">
    <div class="card-topo"><h2>Seu personal</h2><span class="selo">${escaparHtml(estado.vinculo.personalNome || 'Personal')}</span></div>
    ${ultimo ? `<p class="recado-previa"><small class="mudo">${ultimo.de === 'personal' ? 'Último recado dele' : 'Seu último recado'} · ${quando(ultimo.criadoEm)}</small><br>${escaparHtml(ultimo.texto)}</p>` : '<p class="mudo">Nenhum recado ainda.</p>'}
    <div class="acoes-card"><button class="btn secundario cheio" type="button" data-acao="recados-abrir">Abrir recados</button></div>
  </section>`;
}

export const acoesRecados = {
  'recados-abrir': () => abrirRecados({
    donoUid: estado.uid, meuPapel: 'aluno',
    titulo: `Recados com ${(estado.vinculo && estado.vinculo.personalNome) || 'seu personal'}`,
    lista: () => estado.recados
  })
};

