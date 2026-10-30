// Primeiros dados do personal (aparece depois das boas-vindas): data de nascimento, WhatsApp e CREF. Tudo pode ser pulado.
import { estado } from './estado.js';
import { abrirFolha } from './folha.js';
import { escaparHtml, dataLocal, toast } from './util.js';
import { salvarPerfil } from './dados.js';
import { idadeDe } from './onboarding.js';

const soDigitos = (t) => String(t || '').replace(/\D/g, '');

export function abrirDadosIniciais() {
  const p = estado.perfil || {};
  const f = abrirFolha(`
    <h2>Complete seu perfil</h2>
    <p class="mudo peq">Leva 30 segundos. Seus alunos veem o WhatsApp e o CREF em "Meu personal". Você pode pular e preencher depois em Configurações.</p>
    <label class="campo">Data de nascimento<input class="in" type="date" data-f="nasc" max="${dataLocal()}" value="${escaparHtml(p.nascimento || '')}"></label>
    <label class="campo">WhatsApp (com DDD) <small class="mudo">(opcional)</small><input class="in" data-f="whats" inputmode="tel" autocomplete="off" placeholder="(44) 99999-9999" value="${escaparHtml(p.whatsapp || '')}"></label>
    <label class="campo">CREF <small class="mudo">(opcional)</small><input class="in" data-f="cref" maxlength="30" autocomplete="off" placeholder="Ex.: 012345-G/PR" value="${escaparHtml(p.cref || '')}"></label>
    <p class="erro" data-erro role="alert"></p>
    <div class="linha-botoes"><button class="btn secundario" type="button" data-fechar>Pular</button><button class="btn" type="button" data-ed="salvar">Salvar</button></div>`);
  f.el.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-ed="salvar"]')) return;
    const erro = (t) => { f.el.querySelector('[data-erro]').textContent = t; };
    const nasc = f.el.querySelector('[data-f="nasc"]').value;
    const whats = soDigitos(f.el.querySelector('[data-f="whats"]').value);
    const cref = f.el.querySelector('[data-f="cref"]').value.trim();
    if (nasc) { const idade = idadeDe(nasc); if (idade === null || idade < 14 || idade > 110) return erro('Confira a data de nascimento.'); }
    if (whats && (whats.length < 10 || whats.length > 13)) return erro('Confira o WhatsApp: DDD + número (10 ou 11 dígitos).');
    const dados = {};
    if (nasc) dados.nascimento = nasc;
    if (whats) dados.whatsapp = whats;
    if (cref) dados.cref = cref;
    if (Object.keys(dados).length) { await salvarPerfil(estado.uid, dados, { merge: true }); toast('Perfil salvo.'); }
    f.fechar();
  });
}
