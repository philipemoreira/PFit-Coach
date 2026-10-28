// Vídeo de demonstração do exercício: só aceita link https. YouTube abre dentro do app; outros links abrem em outra aba.
export function lerVideo(url) {
  const t = String(url || '').trim();
  if (!/^https:\/\//i.test(t)) return null;
  let u;
  try { u = new URL(t); } catch { return null; }
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
  return { tipo: 'link', url: t };
}

export const linkBusca = (nome) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`como fazer ${nome} execução correta`)}`;
export const urlEmbed = (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&modestbranding=1`;
export const urlMiniatura = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
