import {hosted} from './deployment.mjs';
const api=new URL('./api/',import.meta.url),marker='dianxiaozhi.authorized.'+new URL('./',import.meta.url).pathname;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function onlineAccess(onChange){
  let status={configured:false,authRequired:hosted,authenticated:false},gate,previousOverflow='';
  const available=()=>navigator.onLine&&status.configured&&!status.expired&&(!status.authRequired||status.authenticated);
  async function refresh(){
    try{const r=await fetch(new URL('status',api),{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();const next=await r.json();if(typeof next.configured!=='boolean'||typeof next.authRequired!=='boolean')throw Error();status=next;return true;}
    catch{status={...status,configured:false,authenticated:false};return false;}
    finally{onChange(available());}
  }
  function previouslyAllowed(){try{return localStorage.getItem(marker)==='yes';}catch{return false;}}
  function remember(){try{localStorage.setItem(marker,'yes');}catch{}}
  function release(){if(gate){gate.remove();document.body.style.overflow=previousOverflow;}gate=null;document.querySelector('main').inert=false;document.querySelector('#navigation').inert=false;}
  function showGate(connectionFailed=false){
    release();previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';document.querySelector('main').inert=true;document.querySelector('#navigation').inert=true;
    gate=document.createElement('section');gate.className='access-gate';gate.setAttribute('aria-label','试用访问');
    gate.innerHTML=`<div class="access-sheet"><img src="icons/store.svg" width="44" height="44" alt=""><h1>店小智试用</h1><p>新生杯答辩与小范围测试</p><p class="muted">输入团队提供的邀请码。门店账本保存在本机，使用 AI 前会单独确认发送范围。</p><form id="access-form"><label class="field">邀请码<input name="code" type="password" autocomplete="off" maxlength="128" required></label><p class="error" role="alert" id="access-error">${connectionFailed?'暂时无法连接测试服务，请联网后重试。':''}</p><button class="button primary" type="submit">验证并进入</button><button class="button subtle" type="button" id="access-retry">重新检查连接</button></form>${previouslyAllowed()?'<button class="text-button" id="local-entry">仅使用本机账本与备份</button>':''}<p class="filter-note">邀请码用于控制在线试用和 AI 接口，不能加密本机记录。共用设备请使用独立的浏览器账户。</p></div>`;
    document.body.append(gate);
    gate.querySelector('#access-form').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;const error=gate.querySelector('#access-error');error.textContent='';try{await post('login',{code:new FormData(e.target).get('code')});await refresh();if(!status.authenticated)throw Error('验证未保持，请允许当前网站的 Cookie 后重试');remember();release();onChange(available());}catch(e){error.textContent=e.message;}finally{button.disabled=false;}};
    gate.querySelector('#access-retry').onclick=async()=>{const ok=await refresh();if(ok&&(!status.authRequired||status.authenticated||status.expired&&previouslyAllowed()))release();else gate.querySelector('#access-error').textContent=ok?(status.expired?'本次在线测试已结束。':'连接已恢复，请输入邀请码。'):'暂时无法连接测试服务，请稍后重试。';};
    gate.querySelector('#local-entry')?.addEventListener('click',()=>{status.configured=false;release();onChange(false);});
    gate.querySelector('input').focus();
  }
  async function post(path,payload){const r=await fetch(new URL(path,api),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(32000)});const result=await r.json();if(!r.ok)throw Error(result.error||'服务暂时不可用');return result;}
  async function start(){const ok=await refresh();if(status.authenticated)remember();if((status.authRequired&&!status.authenticated&&!(status.expired&&previouslyAllowed()))||hosted&&!ok&&!previouslyAllowed())showGate(!ok);}
  function panel(){return `<section class="card"><h2>经营问答与试用访问</h2><span class="badge">${available()?esc(status.model):'本地规则查数'}</span><p class="muted">本地问答直接查账。勾选使用模型时，发送本次问题、商品名称及必要的经营汇总给测试后端和智谱；不发送整份账本、订单号或历史聊天。后端不保存请求与回复，模型服务按其服务规则处理。</p>${status.endsAt?`<p class="muted">在线测试截止：${esc(new Date(status.endsAt).toLocaleString('zh-CN'))}。${status.expired?'测试已结束。':''}</p>`:''}<div class="action-row"><a class="button subtle" href="#assistant">打开经营问答</a><button class="button subtle" id="check-online">检查模型连接</button>${status.authRequired?'<button class="text-button" id="verify-invite">重新验证邀请码</button><button class="text-button" id="logout-online">退出在线试用</button>':''}</div><p class="filter-note">每次请求单独同意，不会自动启用模型。离线仍可使用本机记录，API Key 仅由团队在后端配置。</p></section>`;}
  function attach(notify){
    document.querySelector('#check-online').onclick=async()=>{await refresh();notify(available()?'模型已配置；实际可用性以发送结果为准':'当前使用本地问答；可检查联网、邀请码与服务配置');};
    document.querySelector('#verify-invite')?.addEventListener('click',()=>showGate());
    document.querySelector('#logout-online')?.addEventListener('click',async()=>{try{await post('logout',{});try{localStorage.removeItem(marker);}catch{}status.authenticated=false;onChange(false);showGate();}catch(e){notify(e.message);}});
  }
  window.addEventListener('offline',()=>{status.configured=false;onChange(false);});
  window.addEventListener('online',()=>refresh());
  return{start,refresh,panel,attach,available,post,label:()=>status.model||'已配置模型'};
}
