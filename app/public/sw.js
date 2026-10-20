const SCOPE=new URL(self.registration.scope).pathname;
const SUFFIX='-'+encodeURIComponent(SCOPE);
const CACHE='dianxiaozhi-shell-v061-pc-acceptance'+SUFFIX;
const FILES=['./','./index.html','./styles.css','./import-workflow.css','./merchant.css','./app.mjs','./domain.mjs','./business-schema.mjs','./business.mjs','./business-views.mjs','./report-export.mjs','./storage.mjs','./device.mjs','./offline-setup.mjs','./stocktake-view.mjs','./demo.mjs','./screens.mjs','./workflow.mjs','./importer.mjs','./excel-worker.js','./pwa.mjs','./manifest.webmanifest','./icons/store.svg','./icons/store-192.png','./icons/store-512.png','./lib/echarts.min.js','./lib/xlsx.full.min.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('dianxiaozhi-shell-')&&k!==CACHE&&(k.endsWith(SUFFIX)||SCOPE==='/'&&/^dianxiaozhi-shell-v0[45]/.test(k)&&!k.toLowerCase().includes('-%2f'))).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/api/'))return;
  // Serve a complete, versioned shell. Updates are offered together to avoid mixed module versions.
  const relative='./'+url.pathname.slice(new URL(self.registration.scope).pathname.length);
  if(e.request.mode==='navigate')e.respondWith(caches.open(CACHE).then(c=>c.match('./index.html')).then(r=>r||fetch(e.request)));
  else if(FILES.includes(relative))e.respondWith(caches.open(CACHE).then(c=>c.match(e.request)).then(r=>r||fetch(e.request)));
});
