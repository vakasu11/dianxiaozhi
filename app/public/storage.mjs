import {blank,validate,migrate} from './domain.mjs';
export const keyFor=mode=>`dianxiaozhi.v2.${mode}`;
export function load(storage,mode){const raw=storage.getItem(keyFor(mode));return raw?migrate(JSON.parse(raw)):blank();}
export function save(storage,mode,next,expected){
  const raw=storage.getItem(keyFor(mode));
  if(raw&&migrate(JSON.parse(raw)).revision!==expected)throw Error('另一个窗口已更新数据，请刷新页面后重试');
  if(!raw&&expected!==0)throw Error('存储已被其他窗口移除，请刷新页面');
  const value={...next,revision:expected+1};validate(value);
  storage.setItem(keyFor(mode),JSON.stringify(value));return value;
}
