import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {migrate,reports,today} from '../public/domain.mjs';

function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
export function verifyBackup(backup){
  if(backup?.format!=='dianxiaozhi-backup'||!['real','demo'].includes(backup.mode))throw Error('不是有效的店小智完整备份');
  const state=migrate(structuredClone(backup.state));
  if((backup.mode==='demo')!==Boolean(state.demo))throw Error('备份标记与真实 / 演示数据模式不一致');
  const {revision,updatedAt,...business}=state;
  const fingerprint=createHash('sha256').update(JSON.stringify(canonical(business))).digest('hex');
  const r=reports(state,'2000-01-01',today());
  return{mode:backup.mode,schema:state.version,products:state.products.length,events:state.events.length,chat:state.chat.length,actions:state.actions.length,fingerprint,financial:{revenue:r.profit.revenue,profit:r.profit.total,cash:r.balance.cash,inventory:r.balance.inventory,balanceDifference:r.balance.difference}};
}
export async function readBackup(path){
  const data=await readFile(path);if(data.length>15000000)throw Error('备份超过 15 MB');return verifyBackup(JSON.parse(data.toString('utf8')));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const [before,after]=process.argv.slice(2);if(!before)throw Error('用法：node scripts/verify-backup.mjs 原始备份.json [恢复后备份.json]');
    const source=await readBackup(before);
    if(after){const restored=await readBackup(after),matches=source.mode===restored.mode&&source.fingerprint===restored.fingerprint;console.log(JSON.stringify({matches,source,restored},null,2));if(!matches)process.exitCode=1;}
    else console.log(JSON.stringify(source,null,2));
  }catch(e){console.error('备份核验失败：'+e.message);process.exitCode=1;}
}
