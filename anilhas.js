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
    <h2>Quais anilhas colocar?</h2>
    <p class="mudo">Digite o peso <b>só das anilhas</b> (o peso da barra não entra na conta). Eu divido entre os dois lados.</p>
    <div class="seg" role="group" aria-label="O número que você digita é">
      <button type="button" aria-pressed="true" data-modo="total">Total dos 2 lados</button>
      <button type="button" aria-pressed="false" data-modo="lado">Cada lado</button>
    </div>
    <label class="campo"><span id="anilhas-rotulo">Peso total das anilhas (kg)</span><input class="in" inputmode="decimal" data-f="total" value="${cargaInicial != null ? escaparHtml(String(cargaInicial).replace('.', ',')) : ''}" placeholder="Ex.: 60"></label>
    <p class="mudo peq" id="anilhas-exemplo">Exemplo: 60 kg no total = 30 kg em cada lado = 1× 25 kg + 1× 5 kg de cada lado.</p>
    <div id="anilhas-res" class="anilhas-res" aria-live="polite"></div>
    <p class="mudo peq">Anilhas consideradas: ${ANILHAS.map((a) => formatarNumero(a)).join(', ')} kg.</p>
    <button class="btn cheio" type="button" data-fechar>Fechar</button>`);
  const campo = f.el.querySelector('[data-f="total"]');
  const res = f.el.querySelector('#anilhas-res');
  let modo = 'total';
  const pintar = () => {
    const t = numero(campo.value);
    if (t === null) { res.innerHTML = '<p class="mudo">Digite o peso das anilhas.</p>'; return; }
    const total = modo === 'lado' ? t * 2 : t;
    const r = calcularAnilhas(total);
    if (!r) { res.innerHTML = '<p class="mudo">Digite um peso maior que zero.</p>'; return; }
    const lado = total / 2;
    res.innerHTML = `<p class="anilhas-conta">${formatarNumero(total)} kg no total = <b>${formatarNumero(lado)} kg em cada lado</b></p>
      <p class="mudo peq">Coloque em <b>cada lado</b> da barra:</p>
      <div class="anilhas-lista">${r.usadas.map((u) => `<span class="anilha"><b>${u.n}×</b> ${formatarNumero(u.kg)} kg</span>`).join('')}</div>
      ${r.sobra > 0 ? `<p class="erro">Com essas anilhas faltam ${formatarNumero(r.sobra * 2)} kg para fechar o peso (${formatarNumero(r.sobra)} kg em cada lado).</p>` : ''}`;
  };
  f.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-modo]');
    if (!b) return;
    modo = b.dataset.modo;
    f.el.querySelectorAll('[data-modo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    f.el.querySelector('#anilhas-rotulo').textContent = modo === 'lado' ? 'Peso das anilhas em cada lado (kg)' : 'Peso total das anilhas (kg)';
    f.el.querySelector('#anilhas-exemplo').textContent = modo === 'lado' ? 'Exemplo: 30 kg em cada lado = 1× 25 kg + 1× 5 kg de cada lado.' : 'Exemplo: 60 kg no total = 30 kg em cada lado = 1× 25 kg + 1× 5 kg de cada lado.';
    pintar();
  });
  f.el.addEventListener('input', pintar);
  pintar();
}
