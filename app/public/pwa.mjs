let installEvent,registration,updating=false;
const install=document.querySelector('#install-app'),update=document.querySelector('#update-app'),status=document.querySelector('#network-status');
function network(){const connected=navigator.onLine;status.textContent=connected?'在线 · 记录在本机':'离线 · 记录在本机';status.classList.toggle('offline',!connected);document.body.classList.toggle('is-offline',!connected);}
network();addEventListener('online',network);addEventListener('offline',network);addEventListener('focus',network);
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e;install.textContent='安装应用';});
addEventListener('appinstalled',()=>{install.textContent='已安装';installEvent=null;});
install.onclick=async()=>{if(installEvent){await installEvent.prompt();await installEvent.userChoice;installEvent=null;install.textContent='安装说明';}else document.querySelector('#install-guide').showModal();};
function offer(){if(registration?.waiting&&navigator.serviceWorker.controller)update.hidden=false;}
update.onclick=()=>{if(document.querySelector('#edit-dialog').open){document.querySelector('#toast').textContent='请先保存或关闭当前表单，再更新应用';document.querySelector('#toast').hidden=false;return;}document.querySelector('#update-guide').showModal();};
document.querySelector('#confirm-update').onclick=()=>{updating=true;document.querySelector('#update-guide').close();registration?.waiting?.postMessage({type:'ACTIVATE_UPDATE'});};
if('serviceWorker'in navigator&&isSecureContext){
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updating)location.reload();});
  navigator.serviceWorker.register('./sw.js').then(r=>{registration=r;offer();r.addEventListener('updatefound',()=>r.installing?.addEventListener('statechange',offer));document.querySelector('#offline-status').textContent=r.active?'离线资源已就绪':'正在准备离线资源';navigator.serviceWorker.ready.then(()=>document.querySelector('#offline-status').textContent='离线资源已就绪');}).catch(()=>document.querySelector('#offline-status').textContent='离线缓存未就绪，请联网重开');
}else document.querySelector('#offline-status').textContent='当前环境不支持离线缓存';
