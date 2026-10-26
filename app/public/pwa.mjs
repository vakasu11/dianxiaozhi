let installEvent,registration,updating=false,updateTimer;
const install=document.querySelector('#install-app'),update=document.querySelector('#update-app'),status=document.querySelector('#network-status');
function network(){const connected=navigator.onLine;status.textContent=connected?'在线 · 记录在本机':'离线 · 记录在本机';status.classList.toggle('offline',!connected);document.body.classList.toggle('is-offline',!connected);}
network();addEventListener('online',network);addEventListener('offline',network);addEventListener('focus',network);
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e;install.textContent='安装应用';});
addEventListener('appinstalled',()=>{install.textContent='已安装';installEvent=null;});
install.onclick=async()=>{if(installEvent){await installEvent.prompt();await installEvent.userChoice;installEvent=null;install.textContent='安装说明';}else document.querySelector('#install-guide').showModal();};
function offer(){if(registration?.waiting&&navigator.serviceWorker.controller)update.hidden=false;}
update.onclick=()=>{if(document.querySelector('#edit-dialog').open){document.querySelector('#toast').textContent='请先保存或关闭当前表单，再更新应用';document.querySelector('#toast').hidden=false;return;}document.querySelector('#update-guide').showModal();};
const confirmUpdate=document.querySelector('#confirm-update');
function updateFailed(){clearTimeout(updateTimer);updating=false;confirmUpdate.disabled=false;confirmUpdate.textContent='重试更新';document.querySelector('#offline-status').textContent='更新未完成，请保持联网后重试';const toast=document.querySelector('#toast');toast.textContent='更新未完成，已保存记录仍在。请保持联网后重试；如果浏览器下载网页文件，请返回在线网址，不要打开下载文件。';toast.hidden=false;}
function reloadUpdated(){if(!updating)return;clearTimeout(updateTimer);updating=false;location.reload();}
function waitForInstall(worker){return new Promise((resolve,reject)=>{let timer;const done=()=>{if(!['installed','activated','redundant'].includes(worker.state))return;clearTimeout(timer);worker.removeEventListener('statechange',done);worker.state==='redundant'?reject(Error('update failed')):resolve();};worker.addEventListener('statechange',done);timer=setTimeout(()=>{worker.removeEventListener('statechange',done);reject(Error('update timed out'));},15000);done();});}
confirmUpdate.onclick=async()=>{
  if(updating)return;
  updating=true;confirmUpdate.disabled=true;confirmUpdate.textContent='正在更新…';
  updateTimer=setTimeout(updateFailed,20000);
  try{
    const r=registration||await navigator.serviceWorker.getRegistration('./');
    if(!r)throw Error('registration unavailable');
    if(!r.waiting)await r.update();
    if(r.installing)await waitForInstall(r.installing);
    if(!updating)return;
    const waiting=r.waiting;
    if(waiting){waiting.postMessage({type:'ACTIVATE_UPDATE'});document.querySelector('#offline-status').textContent='正在启用新版，请稍候';}
    else reloadUpdated(); // Another tab may already have activated the update.
  }catch{if(updating)updateFailed();}
};
if('serviceWorker'in navigator&&isSecureContext){
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updating)reloadUpdated();});
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(r=>{registration=r;offer();r.addEventListener('updatefound',()=>r.installing?.addEventListener('statechange',offer));document.querySelector('#offline-status').textContent=r.active?'离线资源已就绪':'正在准备离线资源';navigator.serviceWorker.ready.then(()=>document.querySelector('#offline-status').textContent='离线资源已就绪');}).catch(()=>document.querySelector('#offline-status').textContent='离线缓存未就绪，请联网重开');
}else document.querySelector('#offline-status').textContent='当前环境不支持离线缓存';
