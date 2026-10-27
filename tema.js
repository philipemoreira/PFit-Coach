// Tema do app: Automático (segue o celular), Claro ou Escuro. A escolha fica guardada no aparelho.
const CHAVE = 'treino-tema';
const COR_BARRA = { claro: '#f2f4f7', escuro: '#0b0d10' };

export function temaSalvo() {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === 'claro' || t === 'escuro' ? t : 'auto';
  } catch { return 'auto'; }
}

function temaEfetivo(t) {
  if (t === 'claro' || t === 'escuro') return t;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro';
}

export function aplicarTema(t = temaSalvo()) {
  const raiz = document.documentElement;
  if (t === 'claro' || t === 'escuro') raiz.dataset.tema = t; else delete raiz.dataset.tema;
  // Cor da barra do navegador/celular acompanha o tema.
  const cor = COR_BARRA[temaEfetivo(t)];
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', cor));
}

export function definirTema(t) {
  try { localStorage.setItem(CHAVE, t); } catch { /* sem espaço: vale só até fechar */ }
  aplicarTema(t);
}

// Se o celular mudar de claro para escuro e o app estiver em Automático, acompanha.
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => aplicarTema());
}
