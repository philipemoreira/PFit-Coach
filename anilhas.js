// Calculadora de anilhas: diz quais anilhas colocar em cada lado da barra.
import { abrirFolha } from './folha.js';
import { escaparHtml, numero, formatarNumero } from './util.js';

const ANILHAS = [25, 20, 15, 10, 5, 2.5, 1.25]; // anilhas comuns de academia, em kg

// Só anilhas: a carga é dividida por 2 (um lado e outro). O peso da barra não entra na conta.
export function calcularAnilhas(total) {
  let lado = total / 2;
  if (!(lado > 0)) return null;
  const usadas = [];
  for (const a of ANILHAS) {
    const n = Math.floor((lado + 1e-9) / a);
    if (n > 0) { usadas.push({ kg: a, n }); lado -= n * a; }
  }
  return { usadas, sobra: Math.round(lado * 1000) / 1000 };
}

export function abrirAnilhas(cargaInicial) {
  const f = abrirFolha(`
    <h2>Calculadora de anilhas</h2>
    <p class="mudo peq">Digite a carga em anilhas (a mesma que você anota no treino). Mostro quanto colocar em cada lado.</p>
    <label class="campo">Carga (kg)<input class="in" inputmode="decimal" data-f="total" value="${cargaInicial != null ? escaparHtml(String(cargaInicial).replace('.', ',')) : ''}" placeholder="Ex.: 60"></label>
    <div id="anilhas-res" class="anilhas-res" aria-live="polite"></div>
    <p class="mudo peq">Anilhas usadas: ${ANILHAS.map((a) => formatarNumero(a)).join(', ')} kg.</p>
    <button class="btn cheio" type="button" data-fechar>Fechar</button>`);
  const total = f.el.querySelector('[data-f="total"]');
  const res = f.el.querySelector('#anilhas-res');
  const pintar = () => {
    const t = numero(total.value);
    if (t === null) { res.innerHTML = '<p class="mudo">Digite a carga total.</p>'; return; }
    const r = calcularAnilhas(t);
    if (!r) { res.innerHTML = '<p class="mudo">Digite uma carga maior que zero.</p>'; return; }
    res.innerHTML = `<p class="mudo peq">Em cada lado:</p>
      <div class="anilhas-lista">${r.usadas.map((u) => `<span class="anilha"><b>${u.n}×</b> ${formatarNumero(u.kg)} kg</span>`).join('')}</div>
      ${r.sobra > 0 ? `<p class="erro">Faltam ${formatarNumero(r.sobra * 2)} kg para fechar a carga com essas anilhas.</p>` : ''}`;
  };
  f.el.addEventListener('input', pintar);
  pintar();
}
