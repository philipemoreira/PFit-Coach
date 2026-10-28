// Fotos de progresso. Ficam guardadas no próprio Firestore (imagem reduzida), sem custo extra.
// Só você vê, a não ser que ligue "Compartilhar com meu personal".
import { estado } from './estado.js';
import { abrirFolha, confirmar } from './folha.js';
import { escaparHtml, dataLocal, novoId, toast, formatarDataCurta } from './util.js';
import { salvarDoc, removerDoc, lerFotos, salvarPerfil } from './dados.js';

const LIMITE_CHARS = 700000; // o documento do Firestore aceita ~1 MB

// Reduz a foto (lado maior 900 px, JPEG) para caber no banco.
async function reduzir(arquivo) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error('imagem')); i.src = url; });
    for (const [lado, q] of [[900, 0.72], [720, 0.65], [560, 0.6], [420, 0.55]]) {
      const esc = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * esc));
      c.height = Math.max(1, Math.round(img.naturalHeight * esc));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL('image/jpeg', q);
      if (dataUrl.length < LIMITE_CHARS) return dataUrl;
    }
    throw new Error('grande');
  } finally { URL.revokeObjectURL(url); }
}

// uid = de quem são as fotos; dono = sou eu mesmo (posso adicionar/apagar e compartilhar).
export function abrirFotos({ uid, dono, nome }) {
  const f = abrirFolha('<div id="fotos-corpo"><p class="mudo">Carregando…</p></div>', { classe: 'folha-alta' });
  let lista = [];
  const corpo = () => f.el.querySelector('#fotos-corpo');

  const pintar = (aviso) => {
    const el = corpo();
    if (!el) return;
    const temPersonal = !!estado.vinculo;
    const compartilha = !!(estado.perfil && estado.perfil.compartilhaFotos);
    el.innerHTML = `
      <h2>Fotos de progresso${nome ? ` · ${escaparHtml(nome)}` : ''}</h2>
      ${aviso ? `<p class="mudo">${escaparHtml(aviso)}</p>` : ''}
      ${dono && temPersonal ? `<label class="cardio-opcao"><input type="checkbox" data-f="compartilha" ${compartilha ? 'checked' : ''}> Compartilhar minhas fotos com meu personal</label>` : ''}
      ${dono ? `<input type="file" accept="image/*" data-f="arquivo" hidden>
        <p class="mudo peq">As fotos ficam só na sua conta${temPersonal ? ' (e com seu personal, se você compartilhar)' : ''}. Use sempre a mesma luz e o mesmo lugar para comparar.</p>
        <button class="btn cheio" type="button" data-ed="adicionar">+ Adicionar foto</button>` : ''}
      ${lista.length >= 2 ? '<button class="btn secundario cheio" type="button" data-ed="comparar">Antes e depois</button>' : ''}
      ${lista.length ? `<div class="grade-fotos">${lista.map((x) => `<button type="button" class="foto" data-ed="ver" data-id="${escaparHtml(x.id)}"><img src="${x.img}" alt="Foto de ${formatarDataCurta(x.data)}" loading="lazy"><small>${formatarDataCurta(x.data)}</small></button>`).join('')}</div>` : '<p class="mudo vazio-peq">Nenhuma foto ainda.</p>'}
      <button class="btn secundario cheio" type="button" data-fechar>Fechar</button>`;
  };

  const carregar = async () => {
    try { lista = await lerFotos(uid); pintar(); } catch (e) {
      console.error(e);
      lista = [];
      pintar(dono ? 'Não consegui carregar as fotos agora.' : 'Este aluno ainda não compartilhou as fotos com você.');
    }
  };
  carregar();

  f.el.addEventListener('change', async (e) => {
    if (e.target.matches('[data-f="compartilha"]')) {
      await salvarPerfil(estado.uid, { compartilhaFotos: e.target.checked }, { merge: true });
      toast(e.target.checked ? 'Fotos compartilhadas com seu personal.' : 'Fotos só para você.');
    } else if (e.target.matches('[data-f="arquivo"]')) {
      const arq = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!arq) return;
      try {
        toast('Preparando a foto…');
        const img = await reduzir(arq);
        await salvarDoc(uid, 'fotos', novoId(), { data: dataLocal(), img, criadoEm: new Date().toISOString() });
        await carregar();
        toast('Foto salva.');
      } catch (err) { console.error(err); toast('Não consegui usar essa foto. Tente outra.'); }
    }
  });

  f.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ed]');
    if (!b) return;
    if (b.dataset.ed === 'adicionar') f.el.querySelector('[data-f="arquivo"]').click();
    else if (b.dataset.ed === 'ver') {
      const x = lista.find((i) => i.id === b.dataset.id);
      if (!x) return;
      const v = abrirFolha(`<h2>${formatarDataCurta(x.data)}</h2><img class="foto-grande" src="${x.img}" alt="Foto de ${formatarDataCurta(x.data)}">
        <div class="linha-botoes">${dono ? '<button class="btn perigo-claro" type="button" data-ed="apagar">Apagar</button>' : ''}<button class="btn secundario" type="button" data-fechar>Fechar</button></div>`);
      v.el.addEventListener('click', async (ev) => {
        if (!ev.target.closest('[data-ed="apagar"]')) return;
        if (await confirmar('Apagar essa foto? Não dá para desfazer.', { ok: 'Apagar', perigo: true })) {
          await removerDoc(uid, 'fotos', x.id);
          v.fechar();
          await carregar();
        }
      });
    } else if (b.dataset.ed === 'comparar') {
      const antes = lista[lista.length - 1];
      const depois = lista[0];
      abrirFolha(`<h2>Antes e depois</h2><div class="comparar"><figure><img src="${antes.img}" alt="Antes"><figcaption>Antes · ${formatarDataCurta(antes.data)}</figcaption></figure><figure><img src="${depois.img}" alt="Depois"><figcaption>Depois · ${formatarDataCurta(depois.data)}</figcaption></figure></div><button class="btn secundario cheio" type="button" data-fechar>Fechar</button>`, { classe: 'folha-alta' });
    }
  });
}
