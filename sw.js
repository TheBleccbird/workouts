/* Service worker: precache di tutti gli asset, poi cache-first.
   Per pubblicare una nuova versione cambia VERSIONE: la cache vecchia viene cancellata in activate. */
const VERSIONE = 'v2';
const CACHE = 'allenamento-' + VERSIONE;
const ASSET = [
  './',
  'index.html',
  'app.css',
  'data.js',
  'db.js',
  'app.js',
  'manifest.webmanifest',
  'fonts/archivo-latin.woff2',
  'fonts/spline-sans-mono-latin.woff2',
  'icons/icona-192.png',
  'icons/icona-512.png',
  'icons/icona-maskable-192.png',
  'icons/icona-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png'
];

self.addEventListener('install', e => {
  // cache:'reload' salta la cache HTTP (GitHub Pages tiene i file 10 minuti)
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSET.map(u => new Request(u, {cache:'reload'})))));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nomi = await caches.keys();
    await Promise.all(nomi.filter(n => n.startsWith('allenamento-') && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// la pagina chiede di attivare subito la versione in attesa
self.addEventListener('message', e => {
  if(e.data === 'aggiorna') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const trovato = await cache.match(req, {ignoreSearch:true});
    if(trovato) return trovato;
    try{
      return await fetch(req);
    }catch(err){
      // offline e non in cache: per le navigazioni rispondo con l'app
      if(req.mode === 'navigate') return cache.match('./');
      throw err;
    }
  })());
});
