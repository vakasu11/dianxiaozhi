import {stockList,ledger,addEvent,uid,today,validDate,validate} from './domain.mjs';
const DAY=86400000;
export const shiftDate=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
export const daysBetween=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/DAY);
export function setCoverage(state,from,to){if(!validDate(from)||!validDate(to)||from>to||to>today())throw Error('完整销售期间无效');const next=structuredClone(state);next.coverage={from,to,confirmedAt:today()};return validate(next);}
export function insights(state,asof=today()){
  const l=ledger(state,asof),c=state.coverage;let from=null,days=0;
  if(c&&c.from<=asof&&c.to>=asof){from=c.from>shiftDate(asof,-29)?c.from:shiftDate(asof,-29);days=daysBetween(from,asof)+1;}
  return stockList(state,asof).filter(p=>p.active).map(p=>{
    const first=l.rows.find(e=>e.productId===p.id)?.date,observed=from&&first?(first>from?first:from):null,observedDays=observed?daysBetween(observed,asof)+1:0;
    const sold=observed?l.rows.filter(e=>e.type==='sale'&&e.productId===p.id&&e.date>=observed).reduce((n,e)=>n+e.qty,0):null;
    const average=observedDays>=7&&sold>0?sold/observedDays:null;
    const coverageDays=average?p.qty/average:null,target=average?Math.max(p.minStock,Math.ceil(average*(p.leadDays+p.safetyDays))):null;
    const suggestedQty=target!==null?Math.ceil(Math.max(0,target-p.qty)/p.packSize)*p.packSize:null;
    const restock=p.low||(suggestedQty>0),slow=p.qty>0&&observedDays>=30&&(sold===0||(coverageDays!==null&&coverageDays>90));
    return {...p,asof,from:observed,days:observedDays,sold,average,coverageDays,target,suggestedQty,restock,slow,complete:days>0,warning:observedDays<7?'完整记录不足 7 天，暂不估算补货量':sold===0?'已确认区间内无销量，需人工确认需求':'历史销量可能受到断货、节假日或促销影响；按过去速度估算，不保证未来需求'};
  });
}
export function createAction(state,productId,kind,status='accepted',note='',asof=today()){
  if(!['restock','slow'].includes(kind)||!['accepted','rejected'].includes(status))throw Error('建议类型或操作无效');
  const item=insights(state,asof).find(p=>p.id===productId);if(!item||!(kind==='restock'?item.restock:item.slow))throw Error('该建议已变化，请刷新后重新核对');
  if(state.actions.some(a=>a.productId===productId&&a.kind===kind&&['accepted','executed'].includes(a.status)))throw Error('此商品已有进行中的同类行动，请先完成或拒绝该行动');
  if(state.actions.some(a=>a.productId===productId&&a.kind===kind&&a.asof===asof&&['rejected','reviewed'].includes(a.status)))throw Error('今天已记录过此建议，请查看行动历史');
  const next=structuredClone(state);next.actions.push({id:uid(),productId,kind,status,asof,note:String(note).trim().slice(0,1000),facts:{qty:item.qty,value:item.value,sold:item.sold,days:item.days,from:item.from,average:item.average,coverageDays:item.coverageDays,suggestedQty:item.suggestedQty,leadDays:item.leadDays,safetyDays:item.safetyDays,packSize:item.packSize},ruleVersion:'inventory-1'});return validate(next);
}
export function rejectAction(state,id,note){const next=structuredClone(state),a=next.actions.find(a=>a.id===id);if(!a||a.status!=='accepted')throw Error('只能拒绝尚未执行的行动');if(!String(note).trim())throw Error('请填写未执行的原因');a.status='rejected';a.note=String(note).trim().slice(0,1000);return validate(next);}
export function executeAction(state,id,input){
  const action=state.actions.find(a=>a.id===id);if(!action||action.status!=='accepted')throw Error('此行动已经执行或状态已变化');
  if(!validDate(input.date)||input.date<action.asof||input.date>today())throw Error('执行日期不能早于建议日期或晚于今天');
  let next;
  if(action.kind==='restock'){if(input.type!=='purchase'||input.productId!==action.productId)throw Error('补货执行必须关联同一商品的采购入库');next=addEvent(state,{...input,actionId:id});}
  else{if(!String(input.note||'').trim())throw Error('请描述实际采取的处理措施');next=structuredClone(state);}
  const a=next.actions.find(a=>a.id===id);a.status='executed';a.executedAt=input.date;a.executionNote=String(input.note||'').trim().slice(0,1000);a.beforeQty=ledger(state,input.date).stock[a.productId].qty;if(action.kind==='restock')a.eventId=next.events.at(-1).id;return validate(next);
}
export function reviewMetrics(state,action,date=today()){
  if(!validDate(date)||!action.executedAt||date<action.executedAt||date>today())throw Error('复盘日期应在执行日与今天之间');
  const elapsedDays=daysBetween(action.executedAt,date),beforeStart=shiftDate(action.executedAt,-7),beforeEnd=shiftDate(action.executedAt,-1),afterStart=shiftDate(action.executedAt,1);
  const sales=(from,to)=>state.events.filter(e=>e.productId===action.productId&&e.type==='sale'&&e.date>=from&&e.date<=to).reduce((n,e)=>n+e.qty,0);
  const c=state.coverage,complete=Boolean(elapsedDays>0&&c&&c.from<=beforeStart&&c.to>=date);
  return {date,elapsedDays,beforeStart,beforeEnd,afterStart,stockBefore:action.beforeQty,stockAfter:ledger(state,date).stock[action.productId].qty,salesBefore:sales(beforeStart,beforeEnd),salesAfter:elapsedDays?sales(afterStart,date):0,complete};
}
export function reviewAction(state,id,{date,outcome,note}){
  const next=structuredClone(state),a=next.actions.find(a=>a.id===id);if(!a||a.status!=='executed')throw Error('请先记录实际执行');if(!['有帮助','无明显变化','有问题','待观察'].includes(outcome)||!String(note).trim())throw Error('请选择结果并填写复盘观察');
  const metrics=reviewMetrics(state,a,date);if(!metrics.elapsedDays&&outcome!=='待观察')throw Error('执行当天只能记录“待观察”，还没有后续观察期');
  a.status=outcome==='待观察'?'executed':'reviewed';a.review={...metrics,outcome,note:String(note).trim().slice(0,1000)};a.reviews=[...(a.reviews||[]),a.review].slice(-100);return validate(next);
}
