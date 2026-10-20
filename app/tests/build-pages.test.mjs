import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,sep,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPages} from '../scripts/build-pages.mjs';
test('静态部署仅包含网页资源，不携带后端、环境配置、备份或验收记录',async()=>{const temp=await mkdtemp(join(tmpdir(),'dianxiaozhi-pages-'));try{const result=await buildPages(temp),names=result.files.map(f=>f.path);assert.ok(names.includes('index.html'));assert.ok(names.includes('sw.js'));assert.ok(names.includes('.nojekyll'));assert.ok(names.includes('lib/xlsx.full.min.js'));assert.ok(!names.some(n=>/server\.mjs|\.env|backup|tests\/|\.log$/.test(n)));assert.match(await readFile(join(temp,'app.mjs'),'utf8'),/providerAvailable=false/);assert.equal((await readdir(temp)).length>10,true);await assert.rejects(()=>buildPages(temp),/空/);}finally{assert.ok(resolve(temp).startsWith(resolve(tmpdir())+sep)&&basename(temp).startsWith('dianxiaozhi-pages-'));await rm(temp,{recursive:true,force:true});}});
test('构建不能把输出目录放进源文件 public，避免递归复制或改写源文件',async()=>{await assert.rejects(()=>buildPages(fileURLToPath(new URL('../public/',import.meta.url))),/public/);});
