import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedStorage,storageStatus,requestPersistence} from '../public/device.mjs';
import {blank} from '../public/domain.mjs';
import {save,load,keyFor} from '../public/storage.mjs';
const memory=()=>({data:new Map(),getItem(k){return this.data.get(k)??null;},setItem(k,v){this.data.set(k,v);}});
test('GitHub Pages不同项目路径的数据、模式和备份时间隔离，根目录兼容旧存储',()=>{const raw=memory(),a=scopedStorage(raw,'/shop-a/'),b=scopedStorage(raw,'/shop-b/'),root=scopedStorage(raw,'/');const state=save(a,'real',blank(),0);a.setItem('dianxiaozhi.mode','real');a.setItem('last-export.real','2026-10-19');assert.equal(load(a,'real').revision,1);assert.equal(load(b,'real').revision,0);assert.equal(b.getItem('last-export.real'),null);assert.equal(b.getItem('dianxiaozhi.mode'),null);assert.ok(raw.getItem(a.key(keyFor('real'))));assert.equal(root.key(keyFor('real')),keyFor('real'));assert.ok(state.updatedAt);});
test('本地保存失败不冒充成功，空间不足能得到可操作提示',()=>{const raw=memory();raw.setItem=()=>{const e=Error('full');e.name='QuotaExceededError';throw e;};const before=blank();assert.throws(()=>save(raw,'real',before,0),/空间不足.*未保存/);assert.equal(before.revision,0);assert.equal(load(raw,'real').events.length,0);});
test('持久保存许可成功、拒绝、不支持都保留明确状态',async()=>{const manager={persisted:async()=>false,estimate:async()=>({usage:123,quota:1000}),persist:async()=>true};assert.deepEqual(await storageStatus(manager),{supported:true,persisted:false,usage:123,quota:1000});assert.equal(await requestPersistence(manager),true);assert.equal(await requestPersistence({persist:async()=>false}),false);assert.equal(await requestPersistence({}),false);assert.equal((await storageStatus({})).supported,false);});
