// "Folhas": janelinhas que sobem de baixo da tela (formulários e confirmações).
import { escaparHtml } from './util.js';

export function abrirFolha(html, { aoFechar, fixo = false, classe = '' } = {}) {
  const fundo = document.createElement('div');
  fundo.className = 'folha-fundo';
  fundo.innerHTML = `<div class="folha ${classe}" role="dialog" aria-modal="true"><div class="folha-alca"></div><div class="folha-corpo">${html}</div></div>`;
  document.body.appendChild(fundo);
  document.body.classList.add('sem-rolagem');
  requestAnimationFrame(() => fundo.classList.add('aberto'));

  let fechado = false;
  const ehTopo = () => [...document.querySelectorAll('.folha-fundo')].pop() === fundo;
  const tecla = (e) => { if (e.key === 'Escape' && !fixo && ehTopo()) api.fechar(); };
  const api = {
    el: fundo.querySelector('.folha-corpo'),
    fechar() {
      if (fechado) return;
      fechado = true;
      fundo.remove();
      document.removeEventListener('keydown', tecla);
      if (!document.querySelector('.folha-fundo, .treinar')) document.body.classList.remove('sem-rolagem');
      if (aoFechar) aoFechar();
    }
  };
  document.addEventListener('keydown', tecla);
  fundo.addEventListener('click', (e) => {
    if (e.target === fundo && !fixo) api.fechar();
    else if (e.target.closest('[data-fechar]')) api.fechar();
  });
  return api;
}

export function fecharTodasFolhas() {
  document.querySelectorAll('.folha-fundo').forEach((f) => f.remove());
  if (!document.querySelector('.treinar')) document.body.classList.remove('sem-rolagem');
}

// Pergunta "tem certeza?". Devolve true (sim) ou false (não).
export function confirmar(mensagem, { ok = 'Confirmar', perigo = false } = {}) {
  return new Promise((resolver) => {
    let decidido = false;
    const folha = abrirFolha(
      `<p class="confirma-msg">${escaparHtml(mensagem)}</p>
       <div class="linha-botoes">
         <button class="btn secundario" type="button" data-r="n">Cancelar</button>
         <button class="btn ${perigo ? 'perigo' : ''}" type="button" data-r="s">${escaparHtml(ok)}</button>
       </div>`,
      { aoFechar: () => { if (!decidido) resolver(false); } }
    );
    folha.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (!b) return;
      decidido = true;
      resolver(b.dataset.r === 's');
      folha.fechar();
    });
  });
}
