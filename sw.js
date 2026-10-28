// Guarda os arquivos do app no aparelho para ele abrir rápido e funcionar sem internet.
// Toda vez que eu mudar o app, o número da versão sobe (NOME_DO_CACHE).
const NOME_DO_CACHE = 'treino-v21';

const ARQUIVOS_ESSENCIAIS = [
  './', './index.html', './style.css', './manifest.json',
  './app.js', './firebase.js', './firebase-config.js', './util.js', './folha.js', './nav.js',
  './dados.js', './estado.js', './tema.js', './metricas.js',
  './exercicios-base.js',
  './alimentos.js',
  './fotos.js',
  './conta.js', './assinatura.js', './ajuda.js', './onboarding.js', './vinculo.js', './dicas.js', './video.js', './dietaplano.js', './anilhas.js', './personal.js', './recados.js', './auth.js', './hoje.js', './treinos.js', './treinar.js',
  './dieta.js', './progresso.js', './perfil.js',
  './icones/icone.svg', './icones/icone-180.png', './icones/icone-192.png', './icones/icone-512.png'
];

// Biblioteca do Firebase (precisa ser a mesma versão usada em firebase.js).
const FIREBASE = 'https://www.gstatic.com/firebasejs/10.12.2/';
const ARQUIVOS_FIREBASE = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map((n) => FIREBASE + n);

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(NOME_DO_CACHE)
      .then((cache) => cache.addAll(ARQUIVOS_ESSENCIAIS).then(() =>
        // Se a biblioteca do Firebase não puder ser guardada agora, não tem problema: guarda no primeiro uso.
        Promise.allSettled(ARQUIVOS_FIREBASE.map((u) => cache.add(new Request(u, { mode: 'cors' }))))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== NOME_DO_CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Biblioteca do Firebase (endereço com versão fixa): guarda na primeira vez e reaproveita depois.
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    evento.respondWith(
      caches.match(req).then((guardado) => guardado || fetch(req).then((resp) => {
        const copia = resp.clone();
        caches.open(NOME_DO_CACHE).then((c) => c.put(req, copia));
        return resp;
      }))
    );
    return;
  }

  // Vídeos passam direto (precisam de pedaços do arquivo e não devem ficar guardados no aparelho).
  if (req.headers.has('range') || /\.(mp4|webm|mov|m4v)$/i.test(url.pathname)) return;

  // Só mexe nos arquivos do próprio app. O resto (banco de dados, login) passa direto.
  if (url.origin !== self.location.origin) return;

  evento.respondWith(
    caches.match(req).then((guardado) => {
      if (guardado) return guardado;
      return fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    })
  );
});
