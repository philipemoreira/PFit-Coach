// Funções pequenas usadas em várias telas.

// Protege qualquer texto digitado pelo usuário antes de colocar na tela.
export function escaparHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
// Ordem para mostrar: segunda a domingo (números iguais aos do JavaScript: 0 = domingo).
export const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];

// Data de hoje no horário do celular, no formato 2026-10-27.
export function dataLocal(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function parseData(texto) {
  const [a, m, d] = String(texto).split('-').map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
}

export function formatarDataCurta(texto) {
  const d = parseData(texto);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatarDataLonga(d = new Date()) {
  const t = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function eFimDeSemana(d = new Date()) {
  const g = d.getDay();
  return g === 0 || g === 6;
}

// Lê número digitado ("12,5" ou "12.5"). Vazio ou inválido vira null.
export function numero(valor) {
  const n = parseFloat(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function formatarNumero(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

export function novoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

let tempoToast = null;
export function toast(mensagem) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = mensagem;
  el.classList.add('ver');
  clearTimeout(tempoToast);
  tempoToast = setTimeout(() => el.classList.remove('ver'), 3000);
}

export function formatarDuracao(segundos) {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const resto = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${resto}` : `${String(m).padStart(2, '0')}:${resto}`;
}

// Segunda-feira da semana de uma data (a semana começa na segunda).
export function segundaDaSemana(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
