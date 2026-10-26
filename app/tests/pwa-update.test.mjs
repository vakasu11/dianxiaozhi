import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/pwa.mjs',import.meta.url),'utf8');
async function setup(overrides={}){
  const elements=new Map(),listeners={},timers=new Map();let reloads=0,sequence=0;
  const element=selector=>{if(!elements.has(selector))elements.set(selector,{hidden:true,disabled:false,open:false,textContent:'',classList:{toggle(){}},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(selector);};
  const registration={active:{},waiting:null,installing:null,update:async()=>{},addEventListener(){},...overrides};
  const serviceWorker={controller:{},ready:Promise.resolve(),register:async()=>registration,getRegistration:async()=>registration,addEventListener:(name,fn)=>listeners[name]=fn};
  vm.runInNewContext(source,{document:{querySelector:element,body:{classList:{toggle(){}}}},navigator:{onLine:true,serviceWorker},isSecureContext:true,addEventListener(){},location:{reload(){reloads++;}},setTimeout:(fn,delay)=>{const id=++sequence;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)});
  await new Promise(setImmediate);
  return {element,registration,listeners,timers,reloads:()=>reloads};
}

test('确认更新时等待中的版本已被另一标签启用，仍检查更新并重新载入',async()=>{
  let checks=0;const app=await setup({update:async()=>checks++});
  await app.element('#confirm-update').onclick();
  assert.equal(checks,1);assert.equal(app.reloads(),1);assert.equal(app.timers.size,0);
});

test('更新等待安装完成后才启用，收到控制器变更后载入一次',async()=>{
  let stateChanged,messages=0;const worker={state:'installing',addEventListener:(name,fn)=>stateChanged=fn,removeEventListener(){}};
  const app=await setup({installing:worker});
  const pending=app.element('#confirm-update').onclick();
  await new Promise(setImmediate);
  assert.equal(app.reloads(),0);
  app.registration.installing=null;app.registration.waiting={postMessage:message=>{assert.equal(message.type,'ACTIVATE_UPDATE');messages++;}};
  worker.state='installed';stateChanged();await pending;
  assert.equal(messages,1);assert.equal(app.reloads(),0);
  app.listeners.controllerchange();assert.equal(app.reloads(),1);assert.equal(app.timers.size,0);
});

test('更新网络失败后显示原因与重试入口，不静默关闭对话框',async()=>{
  const app=await setup({update:async()=>{throw Error('offline');}});
  await app.element('#confirm-update').onclick();
  assert.equal(app.reloads(),0);assert.equal(app.element('#confirm-update').disabled,false);assert.equal(app.element('#confirm-update').textContent,'重试更新');
  assert.equal(app.element('#toast').hidden,false);assert.match(app.element('#toast').textContent,/已保存记录仍在/);assert.equal(app.timers.size,0);
});

test('等待版本未能激活时超时给出反馈，允许再次尝试',async()=>{
  const app=await setup({waiting:{postMessage(){}}});
  await app.element('#confirm-update').onclick();
  const timeout=[...app.timers.values()].find(item=>item.delay===20000);assert.ok(timeout);timeout.fn();
  assert.equal(app.reloads(),0);assert.equal(app.element('#confirm-update').disabled,false);assert.match(app.element('#offline-status').textContent,/更新未完成/);
});
