// SHUİ Akademi service worker: çevrimdışı çalışır, internet varken hep en yeni sürümü getirir.
const V='fs-v10';
const CORE=['./','./index.html','./questions.json','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin===location.origin){
    const fresh=new Request(r.url,{cache:'no-cache',credentials:'same-origin'});
    e.respondWith(fetch(fresh).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put(r.url,cp));return res}).catch(()=>caches.match(r.url,{ignoreSearch:true}).then(m=>m||caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));return res})));
});
