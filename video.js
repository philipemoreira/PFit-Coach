// Vídeo de demonstração do exercício. Toca dentro do app:
//  - arquivo de vídeo seu (.mp4, .webm, .mov): link https ou caminho da pasta do app, ex.: videos/supino.mp4
//  - YouTube e Vimeo (abrem dentro do app)
// Qualquer outro link https só abre em outra aba.
const EXT = /\.(mp4|webm|mov|m4v)$/i;

export function lerVideo(url) {
  const t = String(url || '').trim();
  if (!t) return null;
  // Arquivo guardado junto com o app (pasta "videos" do GitHub).
  if (/^(\.\/)?videos\/[\w\-./ %()]+$/i.test(t) && EXT.test(t) && !t.includes('..')) return { tipo: 'arquivo', url: t.replace(/^\.\//, '') };
  if (!/^https:\/\//i.test(t)) return null;
  let u;
  try { u = new URL(t); } catch { return null; }
  if (EXT.test(u.pathname)) return { tipo: 'arquivo', url: t };
  const h = u.hostname.replace(/^(www|m)\./, '');
  let id = null;
  if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{6,20})/);
      if (m) id = m[2];
    }
  }
  if (id && /^[\w-]{6,20}$/.test(id)) return { tipo: 'youtube', id, url: t };
  if (h === 'vimeo.com' || h === 'player.vimeo.com') {
    const m = u.pathname.match(/\/(\d{5,12})/);
    if (m) return { tipo: 'vimeo', id: m[1], url: t };
  }
  return { tipo: 'link', url: t };
}

export const urlEmbed = (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&modestbranding=1`;
export const urlVimeo = (id) => `https://player.vimeo.com/video/${id}?playsinline=1`;
export const urlMiniatura = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

// Botão "Ver como fazer": abre a busca de vídeos do Google com o nome do exercício.
export const urlBuscaGoogle = (nome) => `https://www.google.com/search?q=${encodeURIComponent(`como fazer ${String(nome || '').trim()} exercício academia`)}&tbm=vid`;
