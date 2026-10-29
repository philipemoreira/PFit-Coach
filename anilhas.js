// Calculadora de anilhas: diz quais anilhas colocar em cada lado da barra.
import { abrirFolha } from './folha.js';
import { escaparHtml, numero, formatarNumero } from './util.js';

// Anilhas da academia do Philipe (kg). São as únicas usadas na conta.
export const ANILHAS = [25, 20, 10, 5, 2.5];

// Só anilhas: a carga é dividida por 2 (um lado e outro). O peso da barra não entra na conta.
// Usa SÓ as anilhas disponíveis, com o menor número de anilhas por lado. Se não fecha exato, mostra o mais perto sem passar.
export function calcularAnilhas(total, disponiveis = ANILHAS) {
  const lado = total / 2;
  if (!(lado > 0)) return null;
  const U = 4; // trabalha em quartos de kg para não errar com decimais
  const pl = [...disponiveis].sort((x, y) => y - x).map((kg) => ({ kg, u: Math.round(kg * U) }));
  const alvo = Math.floor(lado * U + 1e-9);
  const dp = new Array(alvo + 1).fill(Infinity);
  dp[0] = 0;
  for (let v = 1; v <= alvo; v++) for (const p of pl) if (p.u <= v && dp[v - p.u] + 1 < dp[v]) dp[v] = dp[v - p.u] + 1;
  let r = alvo;
  while (r > 0 && dp[r] === Infinity) r--;
  const usadas = [];
  let resto = r;
  for (const p of pl) {
    let n = 0;
    while (resto - (n + 1) * p.u >= 0 && dp[resto - (n + 1) * p.u] === dp[resto] - (n + 1)) n++;
    if (n > 0) { usadas.push({ kg: p.kg, n }); resto -= n * p.u; }
  }
  return { usadas, sobra: Math.round((lado - r / U) * 1000) / 1000 };
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
