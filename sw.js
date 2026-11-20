/* Çevrimdışı çalışma için service worker.
   Uygulama dosyaları önbellekten gelir; sorular.json önce internetten denenir,
   bağlantı yoksa son kaydedilen kopya kullanılır.
   Uygulama dosyalarını değiştirdiğinde SURUM değerini artır. */
const SURUM = 'shui-v3';
const DOSYALAR = ['./', 'index.html', 'style.css', 'app.js', 'sorular.json', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'gorseller/hh-trafik-3.webp', 'gorseller/hh-trafik-6.webp', 'gorseller/loj-depo-ayristirma.webp', 'gorseller/loj-depo-birlestirme.webp', 'gorseller/loj-depo-karisim.webp', 'gorseller/loj-montaj-tablo.webp', 'gorseller/loj-ts-tablo.webp'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SURUM).then(c => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SURUM).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Yazı tipleri ve ikon kütüphanesi: önbellek önce (internetsiz de görünsün)
  if (/^(fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com)$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const kopya = res.clone(); caches.open(SURUM).then(c => c.put(req, kopya)); return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;
  // Soru görselleri: önbellek önce, ilk açılışta kaydet
  if (url.pathname.includes('/gorseller/')) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const kopya = res.clone(); caches.open(SURUM).then(c => c.put(req, kopya)); return res;
    })));
    return;
  }

  // Ağ önce: sorular ve sayfanın kendisi (güncel kalsın), olmazsa önbellek
  const agOnce = req.mode === 'navigate' || req.url.endsWith('sorular.json') || req.url.endsWith('app.js') || req.url.endsWith('style.css');
  if (agOnce) {
    e.respondWith(
      fetch(req)
        .then(res => { const kopya = res.clone(); caches.open(SURUM).then(c => c.put(req, kopya)); return res; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
    );
    return;
  }
  // Diğerleri: önbellek önce
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
