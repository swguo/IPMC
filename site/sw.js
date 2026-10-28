// Only encrypted data and public app assets are cached. Bump on each release.
const CACHE='travel-v29';
const ASSETS=['./','./index.html','./style.css?v=29','./app.js?v=29','./vault.json','./qa.js?v=29','./qa.css?v=29','./qa-voice.js?v=29','./trainer.js?v=29','./trainer-core.js?v=29'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('travel-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==location.origin)return;
 const asset=ASSETS.find(p=>new URL(p,self.registration.scope).pathname===url.pathname);if(!asset)return;
 const key=new URL(asset,self.registration.scope).href;
 event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
   if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(key,copy)))}
   return response;
 }).catch(()=>caches.match(key).then(r=>r||Response.error())));
});
