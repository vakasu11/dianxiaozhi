import {uid,today,validDate,validate,addProduct,reports,ledger,money} from './domain.mjs';
import {daysBetween,shiftDate,insights} from './workflow.mjs';
const requireDate=(d,allowFuture=false)=>{if(!validDate(d)||!allowFuture&&d>today())throw Error('日期无效或晚于今天');};
const int=(n,min=0,max=1e10)=>{if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('数量或金额无效');return n;};
const text=(v,max,required=false)=>{v=String(v||'').trim();if(v.length>max||required&&!v)throw Error(`请填写有效内容，最多 ${max} 字`);return v;};
export function orderStats(state,start,end){
  const r=reports(state,start,end),sales=r.period.filter(e=>e.type==='sale'),linked=sales.filter(e=>e.orderId),groups=new Map(),products=new Map();
  for(const e of sales){const p=products.get(e.productId)||{id:e.productId,name:state.products.find(p=>p.id===e.productId)?.name||'已停用商品',unit:state.products.find(p=>p.id===e.productId)?.unit||'件',qty:0,revenue:0,cost:0};p.qty+=e.qty;p.revenue+=e.amount;p.cost+=e.delta.cogs;products.set(p.id,p);}
  for(const e of linked){const key=e.date+'|'+e.orderId,g=groups.get(key)||{date:e.date,amount:0,products:new Set(),time:e.orderTime||''};g.amount+=e.amount;g.products.add(e.productId);if(e.orderTime)g.time=e.orderTime;groups.set(key,g);}
  const orders=[...groups.values()],pairs=new Map(),hours=Array.from({length:24},(_,hour)=>({hour,count:0,amount:0}));
  for(const o of orders){if(o.time){const h=hours[Number(o.time.slice(0,2))];h.count++;h.amount+=o.amount;}const ids=[...o.products].sort();for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const key=ids[i]+'|'+ids[j],p=pairs.get(key)||{ids:[ids[i],ids[j]],count:0};p.count++;pairs.set(key,p);}}
  const revenue=orders.reduce((n,o)=>n+o.amount,0);
  return {count:orders.length,revenue,average:orders.length?Math.round(revenue/orders.length):null,linkedLines:linked.length,totalLines:sales.length,timedOrders:orders.filter(o=>o.time).length,hours,orders,products:[...products.values()].map(p=>({...p,gross:p.revenue-p.cost})).sort((a,b)=>b.revenue-a.revenue),pairs:[...pairs.values()].map(p=>({...p,names:p.ids.map(id=>state.products.find(p=>p.id===id)?.name||'未知商品')})).sort((a,b)=>b.count-a.count),daily:[...new Set(orders.map(o=>o.date))].sort().map(date=>{const rows=orders.filter(o=>o.date===date);return{date,count:rows.length,average:Math.round(rows.reduce((n,o)=>n+o.amount,0)/rows.length)};})};
}
export function addTrial(state,input){
  const next=structuredClone(state),product=next.products.find(p=>p.id===input.productId);requireDate(input.startDate);
  next.trials.push({id:uid(),name:text(product?.name||input.name,80,true),productId:product?.id||null,source:text(input.source,300,true),reason:text(input.reason,1000),cost:int(input.cost),price:int(input.price),startDate:input.startDate,status:product?'running':'planned',note:''});return validate(next);
}
export function beginTrial(state,id,input){
  const trial=state.trials.find(t=>t.id===id);if(!trial||trial.status!=='planned')throw Error('此候选已开始或已结束');
  let next=addProduct(state,{...input,name:trial.name,cost:trial.cost,price:trial.price});const t=next.trials.find(t=>t.id===id);t.productId=next.products.at(-1).id;t.startDate=today();t.status='running';return validate(next);
}
export function closeTrial(state,id,note){const next=structuredClone(state),t=next.trials.find(t=>t.id===id);if(!t||t.status==='closed')throw Error('试销状态已变化');t.note=text(note,1000,true);t.status='closed';t.closedAt=today();return validate(next);}
export function trialMetrics(state,trial,asof=today()){
  const elapsed=daysBetween(trial.startDate,trial.closedAt&&trial.closedAt<asof?trial.closedAt:asof)+1;
  return [7,14,30].map(days=>{const until=shiftDate(trial.startDate,days-1),ready=elapsed>=days,complete=Boolean(ready&&trial.productId&&state.coverage&&state.coverage.from<=trial.startDate&&state.coverage.to>=until);if(!complete)return{days,ready,complete:false,qty:null,revenue:null,gross:null,reason:!trial.productId?'尚未建档':!ready?'观察期未满':'未确认完整销售记录'};const r=reports(state,trial.startDate,until),rows=r.period.filter(e=>e.type==='sale'&&e.productId===trial.productId);return{days,ready,complete:true,qty:rows.reduce((n,e)=>n+e.qty,0),revenue:rows.reduce((n,e)=>n+e.amount,0),gross:rows.reduce((n,e)=>n+e.amount-e.delta.cogs,0)};});
}
export function createCampaign(state,input){
  const p=state.products.find(p=>p.id===input.productId&&p.active);if(!p)throw Error('请选择经营中的商品');requireDate(input.from,true);requireDate(input.to,true);if(input.from>input.to)throw Error('活动结束日不能早于开始日');int(input.price,1);if(input.price>p.price)throw Error('活动售价不能高于当前售价');
  const stock=ledger(state).stock[p.id],unitCost=stock.qty?Math.round(stock.value/stock.qty):p.cost;
  if(input.price<unitCost&&!input.allowLoss)throw Error('活动价低于记录成本，请先确认是否允许亏本活动');
  const title=text(input.title,80,true),copy=`${title}\n${p.name}：活动价 ${money(input.price)} 元 / ${p.unit}。\n活动时间：${input.from} 至 ${input.to}。\n到店前请核对活动商品与库存，以门店确认的活动规则为准。`;
  const next=structuredClone(state);next.campaigns.push({id:uid(),productId:p.id,title,from:input.from,to:input.to,price:input.price,unitCost,costBasis:stock.qty?'当前库存平均成本':'商品参考进价',text:copy,status:'draft'});return validate(next);
}
export function campaignText(state,id,copy){const next=structuredClone(state),c=next.campaigns.find(c=>c.id===id);if(!c||c.status!=='draft')throw Error('仅可编辑草稿');c.text=text(copy,5000,true);return validate(next);}
export function executeCampaign(state,id,date){requireDate(date);const next=structuredClone(state),c=next.campaigns.find(c=>c.id===id);if(!c||c.status!=='draft'||date<c.from||date>c.to)throw Error('执行日期应在活动期间内，且活动尚未执行');c.status='executed';c.executedAt=date;return validate(next);}
export function addService(state,input){requireDate(input.date);const next=structuredClone(state);next.serviceRecords.push({id:uid(),date:input.date,type:input.type,minutes:int(input.minutes,0,1440),cost:int(input.cost),note:text(input.note,1000)});return validate(next);}
export function addFeedback(state,input){requireDate(input.date);const next=structuredClone(state);next.feedback.push({id:uid(),date:input.date,category:input.category,rating:input.rating,priority:input.priority,status:'open',actionId:input.actionId||null,text:text(input.text,1000,true)});return validate(next);}
export function feedbackStatus(state,id,status){const next=structuredClone(state),f=next.feedback.find(f=>f.id===id);if(!f)throw Error('反馈不存在');f.status=status;return validate(next);}
export function setRates(state,input,output){const next=structuredClone(state);next.rates={input:input===null?null:int(input),output:output===null?null:int(output)};return validate(next);}
export function addModelUsage(state,{status,usage,durationMs}){
  const next=structuredClone(state),valid=n=>Number.isSafeInteger(n)&&n>=0?n:null,inputTokens=valid(usage?.inputTokens),outputTokens=valid(usage?.outputTokens),priced=inputTokens!==null&&outputTokens!==null&&next.rates.input!==null&&next.rates.output!==null;
  next.modelUsage.push({id:uid(),date:today(),status,inputTokens,outputTokens,costMicros:priced?Math.round((inputTokens*next.rates.input+outputTokens*next.rates.output)/100):null,durationMs:Number.isFinite(durationMs)?Math.max(0,durationMs):0});return validate(next);
}
export function periodSummary(state,start,end){
  const r=reports(state,start,end),orders=orderStats(state,start,end),within=d=>d>=start&&d<=end,actions=state.actions.filter(a=>within(a.asof)),accepted=actions.filter(a=>a.status!=='rejected'),executed=accepted.filter(a=>a.executedAt&&a.executedAt<=end),service=state.serviceRecords.filter(s=>within(s.date)),feedback=state.feedback.filter(f=>within(f.date)),usage=state.modelUsage.filter(u=>within(u.date));
  return {start,end,dataMode:state.demo?'演示数据':'本地录入',profit:r.profit,balance:r.balance,flow:r.flow,businessRows:r.period.length,orders:{count:orders.count,average:orders.average,linkedLines:orders.linkedLines,totalLines:orders.totalLines},actions:{total:actions.length,accepted:accepted.length,executed:executed.length,reviewed:executed.filter(a=>a.review?.date<=end&&a.status==='reviewed').length,acceptanceRate:actions.length?accepted.length/actions.length:null,executionRate:accepted.length?executed.length/accepted.length:null},service:{minutes:service.reduce((n,s)=>n+s.minutes,0),cost:service.reduce((n,s)=>n+s.cost,0)},feedback:{count:feedback.length,helpful:feedback.filter(f=>f.rating==='helpful').length,unhelpful:feedback.filter(f=>f.rating==='unhelpful').length,open:feedback.filter(f=>f.status!=='resolved').length},model:{calls:usage.length,failed:usage.filter(u=>u.status==='failed').length,inputTokens:usage.reduce((n,u)=>n+(u.inputTokens||0),0),outputTokens:usage.reduce((n,u)=>n+(u.outputTokens||0),0),unknownCost:usage.filter(u=>u.costMicros===null).length,costMicros:usage.reduce((n,u)=>n+(u.costMicros||0),0)},inventory:insights(state,end).filter(p=>p.restock||p.slow).map(p=>({name:p.name,qty:p.qty,unit:p.unit,restock:p.restock,slow:p.slow})),coverage:state.coverage};
}
