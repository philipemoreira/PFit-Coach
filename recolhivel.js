// Listas longas: no celular mostram só as primeiras (3 ou 4) e um botão expande/recolhe. No computador mostram tudo.
const abertos = new Set(); // quais listas estão abertas (sobrevive às atualizações de tela)

// Põe uma classe no primeiro elemento do texto HTML (sem mexer no resto).
function marcar(html, classe) {
  const t = html.trimStart();
  if (/^<\w+[^>]*\sclass="/.test(t)) return t.replace(/^(<\w+[^>]*\sclass=")/, `$1${classe} `);
  return t.replace(/^<(\w+)/, `<$1 class="${classe}"`);
}

// chave: nome único da lista. itens: lista de textos HTML. classe: classe do contêiner (ex.: 'lista').
export function listaRecolhivel(chave, itens, { visiveis = 4, classe = 'lista' } = {}) {
  const extras = Math.max(0, itens.length - visiveis);
  const corpo = itens.map((h, i) => (i >= visiveis ? marcar(h, 'rc-extra') : h)).join('');
  if (!extras) return `<div class="${classe}">${corpo}</div>`;
  const aberta = abertos.has(chave);
  return `<div class="recolhivel ${aberta ? 'aberta' : ''}" data-rc="${chave}">
    <div class="${classe}">${corpo}</div>
    <button type="button" class="btn secundario cheio rc-btn" data-acao="rc-alternar" data-chave="${chave}" aria-expanded="${aberta}">
      <span class="rc-mais">Ver mais (${extras})</span><span class="rc-menos">Mostrar menos</span>
    </button>
  </div>`;
}

export const acoesRecolhivel = {
  'rc-alternar': (el) => {
    const chave = el.dataset.chave;
    const caixa = el.closest('.recolhivel');
    const abre = !abertos.has(chave);
    if (abre) abertos.add(chave); else abertos.delete(chave);
    if (caixa) caixa.classList.toggle('aberta', abre);
    el.setAttribute('aria-expanded', String(abre));
  }
};
