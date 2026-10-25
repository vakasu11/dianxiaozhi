import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyBackup} from '../scripts/verify-backup.mjs';
import {demo} from '../public/demo.mjs';
import {blank} from '../public/domain.mjs';
import {save,load,keyFor} from '../public/storage.mjs';
import {scopedStorage} from '../public/device.mjs';
const wrap=(state,mode='demo')=>({format:'dianxiaozhi-backup',mode,state});
test('跨地址备份恢复保留全部业务、聊天和财务，允许本机保存版本号变化',()=>{
  const original=demo();original.chat=[{role:'user',text:'本地隐私测试，不上传'}];
  const raw=new Map(),storage=scopedStorage({getItem:k=>raw.get(k)??null,setItem:(k,v)=>raw.set(k,v)});
  save(storage,'demo',{...structuredClone(original),revision:0},0);
  const restored=load(storage,'demo'),a=verifyBackup(wrap(original)),b=verifyBackup(wrap(restored));
  assert.deepEqual(a,b);assert.notEqual(original.revision,restored.revision);assert.equal(b.financial.profit,8550);assert.equal(b.financial.balanceDifference,0);assert.equal(restored.chat[0].text,original.chat[0].text);
  assert.equal(raw.has(keyFor('demo')),true);
});
test('核验指纹能发现商品、流水、聊天或行动内容变化，不仅比较条数',()=>{
  const state=demo(),before=verifyBackup(wrap(state));
  for(const change of [s=>s.products[0].name+='已修改',s=>s.chat.push({role:'user',text:'新增会话'}),s=>s.store+='已修改']){const altered=structuredClone(state);change(altered);assert.notEqual(verifyBackup(wrap(altered)).fingerprint,before.fingerprint);}
});
test('核验拒绝模式不一致和损坏库存，空白真实门店也可正确验证',()=>{
  assert.throws(()=>verifyBackup(wrap(demo(),'real')),/模式不一致/);
  assert.throws(()=>verifyBackup({format:'other',mode:'real',state:blank()}),/完整备份/);
  const broken=demo();broken.events.find(e=>e.type==='purchase').qty=-1;assert.throws(()=>verifyBackup(wrap(broken)));
  const result=verifyBackup(wrap(blank(),'real'));assert.equal(result.mode,'real');assert.equal(result.events,0);assert.equal(result.financial.profit,0);
});
