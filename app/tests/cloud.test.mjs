import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {accessControl,inviteHash} from '../cloud-security.mjs';
import {createServer} from '../server.mjs';
import {modelSummary} from '../public/ai-summary.mjs';
import {buildCloudbase} from '../scripts/build-cloudbase.mjs';
const code='test-only-random-invitation',secret='unit-test-session-secret-32-characters',origin='https://demo.example.com';
const config=()=>({APP_MODE:'cloudbase',PUBLIC_ORIGIN:origin,INVITE_HASHES:inviteHash(code),SESSION_SECRET:secret,DEMO_END_AT:new Date(Date.now()+28*86400000).toISOString()});
async function run(c,fn){const s=createServer(c);await new Promise(r=>s.listen(0,'127.0.0.1',r));try{await fn(`http://127.0.0.1:${s.address().port}`);}finally{s.closeAllConnections();await new Promise(r=>s.close(r));}}
function request(base,path,{method='GET',data,headers={}}={}){return new Promise((resolve,reject)=>{const r=http.request(base+path,{method,headers:{Host:'demo.example.com',...(method==='POST'?{'Content-Type':'application/json',Origin:origin}:{}),...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text,json:()=>JSON.parse(text)}));});r.on('error',reject);r.end(data===undefined?undefined:JSON.stringify(data));});}
test('云模式配置缺失或超长测试期时拒绝启动',()=>{
  assert.throws(()=>createServer({APP_MODE:'cloudbase'}),/PUBLIC_ORIGIN/);
  for(const change of [{PUBLIC_ORIGIN:'http://demo.example.com'},{PUBLIC_ORIGIN:origin+'/prefix'},{PUBLIC_ORIGIN:origin+'?wrong=1'},{PUBLIC_ORIGIN:'https://user:password@demo.example.com'},{SESSION_SECRET:'short'},{INVITE_HASHES:'raw-code'},{DEMO_END_AT:new Date(Date.now()+32*86400000).toISOString()}])assert.throws(()=>createServer({...config(),...change}));
});
test('会话签名、截止、邀请码撤销及云 Cookie 属性',()=>{
  let now=Date.now();const c=config(),a=accessControl(c,()=>now),cookie=a.login(code),headers={cookie:cookie.split(';')[0]};
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/__Host-dxz_session=/);
  assert.equal(a.authenticate({headers}),inviteHash(code));
  assert.equal(a.authenticate({headers:{cookie:headers.cookie+'tampered'}}),null);
  assert.equal(accessControl({...c,INVITE_HASHES:inviteHash('different-code')},()=>now).authenticate({headers}),null);
  assert.equal(accessControl({...c,SESSION_SECRET:secret+'rotated'},()=>now).authenticate({headers}),null);
  now+=8*3600000+1;assert.equal(a.authenticate({headers}),null);
  now=Date.parse(c.DEMO_END_AT);assert.equal(a.login(code),null);assert.equal(a.authenticate({headers}),null);
  assert.match(a.logout(),/Max-Age=0/);
});
test('单进程调用窗口到期恢复，不宣称持久限额',()=>{let now=0;const a=accessControl({},()=>now);assert.equal(a.limit('x',2,100),true);assert.equal(a.limit('x',2,100),true);assert.equal(a.limit('x',2,100),false);now=100;assert.equal(a.limit('x',2,100),true);assert.equal(accessControl({},()=>now).limit('x',2,100),true);});
test('云接口要求邀请码、同源和显式发送同意，不暴露 Key',async()=>run({...config(),GLM_API_KEY:'unit-test-not-a-real-key',CHAT_MODEL:'paid-model-ignored'},async base=>{
  const status=await request(base,'/api/status');assert.equal(status.json().model,'glm-4-flash-250414');assert.equal(status.json().authenticated,false);assert.doesNotMatch(status.text,/unit-test-not-a-real-key/);
  assert.equal((await request(base,'/api/chat',{method:'POST',data:{}})).status,401);
  assert.equal((await request(base,'/api/login',{method:'POST',data:{code},headers:{Origin:'https://evil.example'}})).status,403);
  assert.equal((await request(base,'/api/login',{method:'POST',data:{code},headers:{Origin:''}})).status,403);
  assert.equal((await request(base,'/api/login',{method:'POST',data:{code:'incorrect'}})).status,401);
  const login=await request(base,'/api/login',{method:'POST',data:{code}});assert.equal(login.status,200);
  const Cookie=login.headers['set-cookie'][0].split(';')[0];
  assert.equal((await request(base,'/api/status',{headers:{Cookie}})).json().authenticated,true);
  assert.equal((await request(base,'/api/chat',{method:'POST',headers:{Cookie},data:{question:'利润',data:{}}})).status,400);
  assert.equal((await request(base,'/api/chat',{method:'POST',headers:{Cookie},data:{consent:true,question:'x'.repeat(1001),data:{}}})).status,400);
  assert.equal((await request(base,'/api/chat',{method:'POST',headers:{Cookie},data:{consent:true,question:'利润',data:{text:'x'.repeat(80001)}}})).status,413);
  assert.equal((await request(base,'/api/logout',{method:'POST',data:{},headers:{Cookie}})).status,200);
  assert.equal((await request(base,'/api/status',{headers:{Host:'evil.example'}})).status,403);
}));
test('到期拒绝登录和 AI，但保留静态账本与健康检查',async()=>run({...config(),DEMO_END_AT:new Date(Date.now()-1000).toISOString()},async base=>{
  assert.equal((await request(base,'/')).status,200);
  assert.equal((await request(base,'/api/login',{method:'POST',data:{code}})).status,403);
  assert.equal((await request(base,'/api/chat',{method:'POST',data:{}})).status,403);
  assert.equal((await request(base,'/healthz',{headers:{Host:'localhost:9000'}})).status,200);
}));
test('云模式忽略通用代理 Key，缺少智谱 Key 时明确未配置',async()=>run({...config(),CHAT_API_KEY:'must-ignore',CHAT_API_URL:'https://evil.example',CHAT_MODEL:'paid'},async base=>{assert.equal((await request(base,'/api/status')).json().configured,false);}));
test('登录全局限频防止无限猜测',async()=>run(config(),async base=>{for(let i=0;i<30;i++)assert.equal((await request(base,'/api/login',{method:'POST',data:{code:'wrong'}})).status,401);assert.equal((await request(base,'/api/login',{method:'POST',data:{code}})).status,429);}));
test('AI 汇总白名单移除账本、聊天、门店名与订单号，保留金额和裁剪标记',()=>{
  const s=modelSummary({store:'PRIVATE',events:[{note:'PRIVATE'}],chat:['PRIVATE'],period:{start:'2026-10-01',end:'2026-10-25',secret:'PRIVATE'},profit:{total:400,raw:'PRIVATE'},orderSummary:{count:2,average:300,orders:['PRIVATE']},products:Array.from({length:105},()=>({name:'牛奶',unit:'瓶',qty:3,sold:1,orderId:'PRIVATE'}))});
  assert.doesNotMatch(JSON.stringify(s),/PRIVATE/);assert.equal(s.profit.total,400);assert.equal(s.products.length,100);assert.equal(s.omittedRows,5);assert.deepEqual(modelSummary(s),s);
  const c=modelSummary({campaign:{title:'周末',text:'x'.repeat(6000),price:500,other:'PRIVATE'},events:['PRIVATE']});assert.equal(c.campaign.text.length,5000);assert.doesNotMatch(JSON.stringify(c),/PRIVATE/);
});
test('本机模拟模型验证邀请码、裁剪、用量与分钟限制，未请求真实智谱',async()=>{
  let received,calls=0;const provider=http.createServer(async(req,res)=>{let text='';for await(const c of req)text+=c;received=JSON.parse(text);calls++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:'模拟接口回答'}}],usage:{prompt_tokens:3,completion_tokens:2}}));});await new Promise(r=>provider.listen(0,'127.0.0.1',r));
  try{await run({...config(),APP_MODE:'local',CHAT_API_URL:`http://127.0.0.1:${provider.address().port}`,CHAT_MODEL:'mock',CHAT_API_KEY:'test-only-key'},async base=>{
    const headers={Host:new URL(base).host,Origin:base},login=await request(base,'/api/login',{method:'POST',headers,data:{code}});assert.equal(login.status,200);headers.Cookie=login.headers['set-cookie'][0].split(';')[0];
    for(let i=0;i<5;i++){const r=await request(base,'/api/chat',{method:'POST',headers,data:{consent:true,question:'利润',data:{profit:{total:400},events:['PRIVATE'],chat:['PRIVATE']}}});assert.equal(r.status,200);assert.deepEqual(r.json().usage,{inputTokens:3,outputTokens:2});}
    assert.doesNotMatch(JSON.stringify(received),/PRIVATE/);assert.equal(calls,5);
    assert.equal((await request(base,'/api/chat',{method:'POST',headers,data:{consent:true,question:'利润',data:{}}})).status,429);assert.equal(calls,5);
  });}finally{provider.closeAllConnections();await new Promise(r=>provider.close(r));}
});
function unzip(buffer){const files=new Map();let pos=0;while(buffer.readUInt32LE(pos)===0x04034b50){const size=buffer.readUInt32LE(pos+18),nameLength=buffer.readUInt16LE(pos+26),extra=buffer.readUInt16LE(pos+28),start=pos+30+nameLength+extra,name=buffer.subarray(pos+30,pos+30+nameLength).toString();files.set(name,inflateRawSync(buffer.subarray(start,start+size)));pos=start+size;}return files;}
test('云函数包只包含白名单源文件、云模式开关与可校验清单，不带本机数据',async()=>{
  const target=await mkdtemp(join(tmpdir(),'dxz-cloud-'));
  try{const built=await buildCloudbase(target),zip=await readFile(built.archive),files=unzip(zip);assert.ok(files.has('server.mjs'));assert.ok(files.has('public/index.html'));assert.ok(![...files.keys()].some(p=>/backup|\.env$|tests\/|output\/|tmp\//.test(p)));assert.match(files.get('public/deployment.mjs').toString(),/hosted=true/);assert.doesNotMatch(files.get('scf_bootstrap').toString(),/\r/);assert.match(files.get('scf_bootstrap').toString(),/node22\/bin\/node/);
    const manifest=JSON.parse(files.get('MANIFEST.json'));for(const f of manifest)assert.equal(createHash('sha256').update(files.get(f.path)).digest('hex'),f.sha256);
    assert.equal((await readFile(built.archive+'.sha256','utf8')).trim(),createHash('sha256').update(zip).digest('hex'));
    await assert.rejects(()=>buildCloudbase(target),/输出目录必须为空/);
  }finally{await rm(target,{recursive:true,force:true});}
});
