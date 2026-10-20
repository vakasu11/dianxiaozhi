import {blank,validate,migrate} from './domain.mjs';
export const keyFor=mode=>`dianxiaozhi.v2.${mode}`;
export function load(storage,mode){const raw=storage.getItem(keyFor(mode));return raw?migrate(JSON.parse(raw)):blank();}
export function save(storage,mode,next,expected){
  const raw=storage.getItem(keyFor(mode));
  if(raw&&migrate(JSON.parse(raw)).revision!==expected)throw Error('另一个窗口已更新数据，请刷新页面后重试');
  if(!raw&&expected!==0)throw Error('存储已被其他窗口移除，请刷新页面');
  const value={...next,revision:expected+1,updatedAt:new Date().toISOString()};validate(value);
  try{storage.setItem(keyFor(mode),JSON.stringify(value));}catch(e){throw Error(e?.name==='QuotaExceededError'?'手机浏览器空间不足，本次未保存。请先导出现有备份，再整理存储空间。':'本机保存失败，当前记录未写入；请检查浏览器存储权限。');}return value;
}
