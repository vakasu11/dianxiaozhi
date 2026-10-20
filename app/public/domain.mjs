import {validateBusiness} from './business-schema.mjs';
export const VERSION = 4;
export const TYPES = {capital:'现金投入', opening:'初始商品投入', purchase:'采购入库', sale:'销售出库', loss:'库存报损', stocktake:'库存盘点', expense:'经营费用', collect:'收回应收款', repay:'支付应付款', withdraw:'业主提款'};
export const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const uid = () => crypto.randomUUID();
export const money = cents => ((cents||0)/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
export const amount = value => { const n=Number(value); if(!Number.isFinite(n)||n<0||n>1e8||Math.abs(n*100-Math.round(n*100))>1e-5) throw Error('金额须为不超过一亿元的非负数，最多两位小数'); return Math.round(n*100); };
const integer = (n,min=0) => Number.isSafeInteger(n)&&n>=min&&n<=1e10;
export function validDate(s){ if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d=new Date(s+'T00:00:00Z'); return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s&&s>='2000-01-01'&&s<='2100-12-31'; }
export function blank(){ return {version:VERSION,revision:0,store:'我的门店',products:[],events:[],chat:[],imports:[],actions:[],coverage:null,trials:[],campaigns:[],serviceRecords:[],feedback:[],modelUsage:[],rates:{input:null,output:null}}; }
export function migrate(input){
  if(input?.version===1){const s=structuredClone(input);s.version=2;s.imports=[];s.actions=[];s.coverage=null;s.products=s.products.map(p=>({...p,leadDays:2,safetyDays:3,packSize:1}));return migrate(s);}
  if(input?.version===2){const s={...structuredClone(input),version:3,trials:[],campaigns:[],serviceRecords:[],feedback:[],modelUsage:[],rates:{input:null,output:null}};return migrate(s);}
  if(input?.version===3)return migrate({...structuredClone(input),version:VERSION});
  const s=validate(input);if(s.actions.some(a=>a.status==='reviewed'&&a.review?.outcome==='待观察')){const next=structuredClone(s);for(const a of next.actions)if(a.status==='reviewed'&&a.review?.outcome==='待观察')a.status='executed';return next;}return s;
}
export function addProduct(state,input){
  const p={id:input.id||uid(),sku:String(input.sku||'').trim(),name:String(input.name||'').trim(),unit:String(input.unit||'件').trim(),category:String(input.category||'其他').trim(),price:input.price,cost:input.cost,minStock:Number(input.minStock??5),leadDays:Number(input.leadDays??2),safetyDays:Number(input.safetyDays??3),packSize:Number(input.packSize??1),active:true};
  if(!p.sku||!p.name||!p.unit||p.sku.length>40||p.name.length>80||p.unit.length>10||p.category.length>30) throw Error('请填写有效的商品编码、名称和单位');
  if(state.products.some(x=>x.sku.toLowerCase()===p.sku.toLowerCase()||x.id===p.id)) throw Error('商品编码已存在');
  if(!integer(p.price)||!integer(p.cost)||!integer(p.minStock)) throw Error('价格、成本或预警数量无效');
  if(!integer(p.leadDays)||p.leadDays>365||!integer(p.safetyDays)||p.safetyDays>365||!integer(p.packSize,1)||p.packSize>100000)throw Error('供货/安全天数应为 0–365 的整数，补货包装数为 1–100000');
  const next=structuredClone(state); next.products.push(p); return next;
}
function countDifference(stock,qty,referenceCost){
  if(!integer(qty))throw Error('实盘数量须为非负整数');
  if(!integer(referenceCost))throw Error('盘点估值依据无效');
  const difference=qty-stock.qty;
  const rounded=(value,n,denominator)=>Number((BigInt(value)*BigInt(n)+BigInt(denominator)/2n)/BigInt(denominator));
  const valueDelta=difference<0?(qty===0?-stock.value:-rounded(stock.value,-difference,stock.qty)):difference>0?(stock.qty?rounded(stock.value,difference,stock.qty):difference*referenceCost):0;
  if(!integer(Math.abs(valueDelta))||!integer(stock.value+valueDelta))throw Error('盘点金额过大');
  return {qty,difference,valueDelta,gain:Math.max(0,valueDelta),loss:Math.max(0,-valueDelta)};
}
export function previewStocktake(state,input){
  if(!validDate(input.date)||input.date>today())throw Error('请填写有效日期，不能录入未来业务');
  if(state.events.some(e=>e.date>input.date))throw Error('请按日期顺序盘点，不能在已有流水之前调整库存');
  const product=state.products.find(p=>p.id===input.productId&&p.active);if(!product)throw Error('请选择正常经营的商品');
  const stock=ledger(state).stock[product.id],referenceCost=stock.qty?0:product.cost;
  return {revision:state.revision,date:input.date,productId:product.id,bookQty:stock.qty,bookValue:stock.value,referenceCost,costBasis:stock.qty?'当前库存平均成本':'商品参考进价',...countDifference(stock,input.qty,referenceCost)};
}
export function confirmStocktake(state,preview,note){
  if(!preview||state.revision!==preview.revision)throw Error('预览后数据已改变，请重新核对盘点差异');
  const current=previewStocktake(state,preview);
  if(['bookQty','bookValue','referenceCost','qty','gain','loss'].some(k=>current[k]!==preview[k]))throw Error('盘点依据已改变，请重新预览');
  return addEvent(state,{type:'stocktake',date:preview.date,productId:preview.productId,qty:preview.qty,note});
}
export function ledger(state,until='2100-12-31'){
  const stock=Object.fromEntries(state.products.map(p=>[p.id,{qty:0,value:0}]));
  const b={cash:0,inventory:0,receivable:0,payable:0,capital:0,revenue:0,cogs:0,expense:0,loss:0,gain:0};
  const rows=[];
  for(const e of [...state.events].sort((a,b)=>a.date.localeCompare(b.date)||a.seq-b.seq)){
    if(e.date>until) continue;
    if(!validDate(e.date)||!Object.hasOwn(TYPES,e.type)||!integer(e.amount??0,['loss','stocktake'].includes(e.type)?0:1)||!integer(e.seq,1)) throw Error('流水格式错误');
    const delta=Object.fromEntries(Object.keys(b).map(k=>[k,0])); const s=stock[e.productId]; let cashGroup=null;
    if(['opening','purchase','sale','loss'].includes(e.type)&&(!s||!integer(e.qty,1))) throw Error('商品或数量无效');
    const cash=e.payment!=='credit';
    if(['sale','purchase'].includes(e.type)&&!['cash','credit'].includes(e.payment)) throw Error('结算方式无效');
    const post=(k,v)=>{delta[k]+=v;};
    switch(e.type){
      case 'capital': post('cash',e.amount);post('capital',e.amount);cashGroup='financing';break;
      case 'opening': s.qty+=e.qty;s.value+=e.amount;post('inventory',e.amount);post('capital',e.amount);break;
      case 'purchase': s.qty+=e.qty;s.value+=e.amount;post('inventory',e.amount);post(cash?'cash':'payable',cash?-e.amount:e.amount);cashGroup='operating';break;
      case 'sale':
      case 'loss': {
        if(e.qty>s.qty) throw Error('库存不足，不能销售或报损');
        const cost=e.qty===s.qty?s.value:Math.round(s.value*e.qty/s.qty);
        s.qty-=e.qty;s.value-=cost;post('inventory',-cost);
        if(e.type==='sale'){post('cogs',cost);post('revenue',e.amount);post(cash?'cash':'receivable',e.amount);cashGroup='operating';}
        else post('loss',cost);
        break;
      }
      case 'stocktake': {
        if(!s||!integer(e.bookQty)||!integer(e.bookValue)||e.bookQty!==s.qty||e.bookValue!==s.value||typeof e.note!=='string'||!e.note.trim()||e.note.length>200)throw Error('盘点账面依据或原因无效');
        const change=countDifference(s,e.qty,e.referenceCost);
        if(e.amount!==change.gain)throw Error('盘点估值与数量差异不一致');
        s.qty=e.qty;s.value+=change.valueDelta;post('inventory',change.valueDelta);post('gain',change.gain);post('loss',change.loss);break;
      }
      case 'expense': post('expense',e.amount);post('cash',-e.amount);cashGroup='operating';break;
      case 'collect': if(e.amount>b.receivable) throw Error('收款金额超过应收余额');post('receivable',-e.amount);post('cash',e.amount);cashGroup='operating';break;
      case 'repay': if(e.amount>b.payable) throw Error('付款金额超过应付余额');post('payable',-e.amount);post('cash',-e.amount);cashGroup='operating';break;
      case 'withdraw':post('capital',-e.amount);post('cash',-e.amount);cashGroup='financing';break;
    }
    for(const k of Object.keys(b)){b[k]+=delta[k];if(!Number.isSafeInteger(b[k])) throw Error('累计金额过大');}
    if(b.cash<0) throw Error('现金余额不足，请先记录资金投入，或将采购记为赊购');
    rows.push({...e,delta,cashGroup});
  }
  return {balances:b,stock,rows};
}
export function addEvent(state,input){
  if(input.type==='stocktake'&&!integer(input.qty))throw Error('实盘数量须为非负整数');
  if(!validDate(input.date)||input.date>today()) throw Error('请填写有效日期，不能录入未来业务');
  const latest=state.events.reduce((d,e)=>e.date>d?e.date:d,'2000-01-01');
  if(input.date<latest) throw Error(`请按日期顺序录入，最近一笔日期为 ${latest}；补录历史数据请先撤销后续流水`);
  if(!Object.hasOwn(TYPES,input.type)) throw Error('未知业务类型');
  const next=structuredClone(state);
  const event={id:uid(),seq:Math.max(0,...state.events.map(e=>e.seq))+1,type:input.type,date:input.date,amount:input.amount??0,qty:Number(input.qty||0),productId:input.productId||null,payment:input.payment||'cash',note:String(input.note||'').trim().slice(0,200)};
  for(const k of ['externalRef','importBatchId','actionId'])if(input[k])event[k]=input[k];
  for(const k of ['orderId','orderTime'])if(String(input[k]||'').trim())event[k]=String(input[k]).trim();
  if(event.orderId||event.orderTime){if(event.type!=='sale'||!event.orderId||event.orderId.length>80||event.orderTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(event.orderTime))throw Error('订单编号或成交时间无效，时间格式为 HH:mm');const rows=state.events.filter(e=>e.type==='sale'&&e.date===event.date&&e.orderId===event.orderId);if(rows.some(e=>e.payment!==event.payment||e.orderTime&&event.orderTime&&e.orderTime!==event.orderTime))throw Error('同一订单的日期内结算方式及成交时间应一致');}
  if(event.productId&&!state.products.find(p=>p.id===event.productId&&p.active)) throw Error('商品已停用或不存在');
  if(event.type==='stocktake'){
    if(!event.note)throw Error('请填写盘点原因或核对说明');
    const p=previewStocktake(state,event);Object.assign(event,{bookQty:p.bookQty,bookValue:p.bookValue,referenceCost:p.referenceCost,amount:p.gain});
  }
  if(event.type==='opening'&&state.events.some(e=>e.productId===event.productId)) throw Error('该商品已有流水，后续增加库存请使用采购入库');
  if(!['loss','stocktake'].includes(event.type)&&!integer(event.amount,1)) throw Error('金额必须大于零');
  next.events.push(event);ledger(next);return next;
}
export function reports(state,start,end){
  if(!validDate(start)||!validDate(end)||start>end) throw Error('请选择有效的起止日期');
  const l=ledger(state,end),before=l.rows.filter(e=>e.date<start),period=l.rows.filter(e=>e.date>=start);
  const sum=(rows,key)=>rows.reduce((s,e)=>s+e.delta[key],0);
  const revenue=sum(period,'revenue'),cogs=sum(period,'cogs'),expense=sum(period,'expense'),loss=sum(period,'loss'),gain=sum(period,'gain');
  const profit=revenue-cogs-expense-loss+gain,b=l.balances,retained=b.revenue-b.cogs-b.expense-b.loss+b.gain;
  const assets=b.cash+b.inventory+b.receivable, equity=b.capital+retained;
  const flow={opening:sum(before,'cash'),operatingIn:0,operatingOut:0,financingIn:0,financingOut:0,investing:0,closing:b.cash};
  for(const e of period){ const n=e.delta.cash; if(e.cashGroup==='operating') flow[n>=0?'operatingIn':'operatingOut']+=Math.abs(n); if(e.cashGroup==='financing') flow[n>=0?'financingIn':'financingOut']+=Math.abs(n); }
  flow.operating=flow.operatingIn-flow.operatingOut;flow.financing=flow.financingIn-flow.financingOut;flow.net=flow.operating+flow.financing;
  return {start,end,ledger:l,period,profit:{revenue,cogs,gross:revenue-cogs,expense,loss,gain,total:profit},balance:{...b,retained,assets,equity,total:b.payable+equity,difference:assets-b.payable-equity},flow,units:period.filter(e=>e.type==='sale').reduce((n,e)=>n+e.qty,0)};
}
export function stockList(state,end=today()){
  const l=ledger(state,end);return state.products.map(p=>({...p,...l.stock[p.id],low:p.active&&l.stock[p.id].qty<=p.minStock}));
}
export function reportRows(r,tab){
  if(tab==='profit') return [['营业收入',r.profit.revenue],['减：销售成本（移动加权平均）',r.profit.cogs],['毛利',r.profit.gross],['减：经营费用',r.profit.expense],['减：库存损失（含报损与盘亏）',r.profit.loss],['加：库存盘盈收益',r.profit.gain],['本期利润（未计税费及折旧）',r.profit.total]];
  if(tab==='balance')return [['现金及收款账户',r.balance.cash],['应收款',r.balance.receivable],['商品存货',r.balance.inventory],['资产总计',r.balance.assets],['应付款',r.balance.payable],['业主净投入',r.balance.capital],['累计未分配利润',r.balance.retained],['所有者权益合计',r.balance.equity],['负债与所有者权益总计',r.balance.total],['平衡差额',r.balance.difference]];
  return [['期初现金余额',r.flow.opening],['经营活动现金流入',r.flow.operatingIn],['经营活动现金流出',-r.flow.operatingOut],['经营活动现金净额',r.flow.operating],['投资活动现金净额（本版未支持）',0],['筹资活动现金流入',r.flow.financingIn],['筹资活动现金流出',-r.flow.financingOut],['筹资活动现金净额',r.flow.financing],['现金净增加额',r.flow.net],['期末现金余额',r.flow.closing]];
}
export function snapshot(state,start,end){
  const r=reports(state,start,end);
  return {period:{start,end},currency:'CNY',unit:'分',dataMode:state.demo?'模拟演示':'本地录入',scope:'简化经营账，未计税费、固定资产及折旧；销售记录是单商品业务，非完整订单；不推断客流',records:r.period.length,profit:r.profit,balance:r.balance,flow:r.flow,products:stockList(state,end).filter(p=>p.active).map(p=>({name:p.name,unit:p.unit,qty:p.qty,minStock:p.minStock,value:p.value,low:p.low,sold:r.period.filter(e=>e.type==='sale'&&e.productId===p.id).reduce((n,e)=>n+e.qty,0)}))};
}
export function localAnswer(question,data){
  const q=question.trim(),p=data.profit,b=data.balance,f=data.flow,prefix=`统计范围：${data.period.start} 至 ${data.period.end}（${data.dataMode}）。\n`;
  if(/税|预测|天气|客流|会员|明天|下周|下个月|去年/.test(q))return prefix+'当前记录不能支持这个问题。此版尚无税务、客流、会员、天气或预测数据；你可以查询当前期间的销售、利润、库存、应收应付和现金流。';
  if(/订单|客单|连带|组合|时段/.test(q)&&data.orderSummary){const o=data.orderSummary;return prefix+(o.count?`已记录订单 ${o.count} 单，已记录订单客单 ¥${money(o.average)}。有编号销售明细 ${o.linkedLines} / ${o.totalLines} 条；未编号明细不进入订单指标。订单数不等于到店人数。更多时段和组合请查看“订单与商品分析”。`:'本期没有提供订单编号的销售明细，不能计算订单数与客单。请在记销售或导入时补充编号。');}
  if(/服务|工时|模型费用/.test(q)&&data.service)return prefix+`团队服务 ${data.service.minutes} 分钟，已记录费用 ¥${money(data.service.cost)}；模型已知估算费用 ¥${(data.model.costMicros/1e6).toFixed(4)}，另有 ${data.model.unknownCost} 次调用费用待核实。这些团队投入不自动计入门店财务。`;
  if(/试销|选品/.test(q)&&data.trials)return prefix+`已登记 ${data.trials.length} 条候选或试销。${data.trials.map(t=>t.name+'（'+({planned:'待建档',running:'试销中',closed:'已结束'}[t.status])+'）').join('；')}。7/14/30 天结果请在“选品与试销”核对完整记录和周期，不推测未知新品表现。`;
  if(/行动|执行|复盘/.test(q)&&data.actions)return prefix+`目前有 ${data.actions.pending} 项已采纳待执行、${data.actions.executed} 项已执行待复盘、${data.actions.reviewed} 项已复盘。请在“经营建议与复盘”查看原始依据和实际执行情况；我不会通过聊天自动修改库存。`;
  if(/积压|滞销|低销量/.test(q)&&data.inventoryAnalysis){const list=data.inventoryAnalysis.filter(p=>p.slow);return prefix+(list.length?list.map(p=>`${p.name}：库存 ${p.qty} ${p.unit}，完整观察 ${p.days} 天，销量 ${p.sold}；${p.coverageDays===null?'零销量，需核对陈列与商品状态':'按已录速度预计可售 '+p.coverageDays.toFixed(1)+' 天'}。`).join('\n')+'\n这是低销量观察，不能用预计可售天数当作实际库龄。':'当前没有达到低销量观察条件的商品。此规则需要至少 30 天完整销售记录；周期或数据不足时不能认定为滞销。');}
  if(/补货/.test(q)&&data.inventoryAnalysis){const list=data.inventoryAnalysis.filter(p=>p.restock);return prefix+(list.length?list.map(p=>`${p.name}：库存 ${p.qty} ${p.unit}，${p.suggestedQty===null?'完整记录不足或无可用日均销量，补货数量需人工核对':`参考补货 ${p.suggestedQty} ${p.unit}（按 ${p.days} 天完整记录、供货天数和包装数计算）`}。`).join('\n')+'\n这是历史速度与阈值形成的参考，未计未知在途采购；请在下单前核对。':'没有商品触及当前补货规则。');}
  if(/库存|补货|缺货|商品|卖得|销量|好卖/.test(q)){
    const product=data.products.find(p=>q.includes(p.name));
    if(product)return prefix+`${product.name}：库存 ${product.qty} ${product.unit}，本期销量 ${product.sold} ${product.unit}，库存成本 ¥${money(product.value)}。${product.low?'库存已达到设定预警线，请结合供货周期人工确认补货量。':'库存高于设定预警线。'}`;
    if(/销量|好卖|卖得/.test(q)){const ranked=[...data.products].filter(p=>p.sold>0).sort((a,b)=>b.sold-a.sold).slice(0,5);return prefix+(ranked.length?ranked.map(p=>`${p.name}：${p.sold} ${p.unit}`).join('\n')+'\n按件数展示，不同计量单位的商品不宜直接比较。':'本期暂无商品销售记录。');}
    const low=data.products.filter(p=>p.low);return prefix+(low.length?`有 ${low.length} 个商品达到库存预警线：\n`+low.map(p=>`${p.name}：现有 ${p.qty} ${p.unit}，预警线 ${p.minStock} ${p.unit}`).join('\n')+'\n依据是你设置的库存阈值；尚未纳入供货周期或预测需求。':'当前没有商品触及已设置的库存预警线。');
  }
  if(/应收|应付|欠款|赊/.test(q))return prefix+`截至期末：应收款 ¥${money(b.receivable)}，应付款 ¥${money(b.payable)}。收回应收款增加现金，不重复增加营业收入；支付应付款减少现金，不重复确认销售成本。`;
  if(/资产|负债|平衡/.test(q))return prefix+`截至 ${data.period.end}：资产 ¥${money(b.assets)} = 负债 ¥${money(b.payable)} + 所有者权益 ¥${money(b.equity)}。平衡差额 ¥${money(b.difference)}。仅覆盖本工具记录的简化经营账。`;
  if(/现金|资金|余额|现金流/.test(q))return prefix+`期初现金 ¥${money(f.opening)}，经营净流入 ¥${money(f.operating)}，筹资净流入 ¥${money(f.financing)}，期末现金 ¥${money(f.closing)}。\n现金变化与利润不同：采购、赊销、回款及业主投入都会影响两者的关系。`;
  if(/利润|赚|毛利|收入|营业额|销售|报表|经营|总结/.test(q))return prefix+`营业收入 ¥${money(p.revenue)}，销售成本 ¥${money(p.cogs)}，毛利 ¥${money(p.gross)}。扣除经营费用 ¥${money(p.expense)} 和库存损失 ¥${money(p.loss)}，加上库存盘盈收益 ¥${money(p.gain)} 后，本期利润 ¥${money(p.total)}。\n依据：所选期间的 ${data.records} 条流水，销售成本采用移动加权平均法；盘点不计销售或现金，尚未计税费和折旧。`;
  return prefix+'我目前支持查询本店的销售、利润、库存预警、资产负债、应收应付和现金流。可以问“本期赚了多少钱？”或“哪些商品需要补货？”。当前为本地数据问答，未调用大模型。';
}
export function validate(state){
  if(!state||state.version!==VERSION||!integer(state.revision)||typeof state.store!=='string'||state.store.length>60||!Array.isArray(state.products)||!Array.isArray(state.events)||!Array.isArray(state.chat)||state.products.length>5000||state.events.length>30000||state.chat.length>100)throw Error('备份结构或版本不支持');
  const test=blank();
  for(const p of state.products){if(typeof p.id!=='string'||!p.id||typeof p.active!=='boolean')throw Error('商品格式错误');test.products=addProduct(test,p).products;}
  const ids=new Set(),seqs=new Set();let prior='2000-01-01',seq=0;
  for(const e of state.events){if(typeof e.id!=='string'||ids.has(e.id)||seqs.has(e.seq)||e.date<prior||e.seq<=seq||!validDate(e.date)||e.date>today()||typeof e.note!=='string'||e.note.length>200)throw Error('流水顺序或标识无效');ids.add(e.id);seqs.add(e.seq);prior=e.date;seq=e.seq;}
  for(const c of state.chat){if(!c||!['user','assistant'].includes(c.role)||typeof c.text!=='string'||c.text.length>16000)throw Error('聊天记录无效');}
  if(!Array.isArray(state.imports)||state.imports.length>2000||!Array.isArray(state.actions)||state.actions.length>10000)throw Error('导入或行动记录结构无效');
  const productIds=new Set(state.products.map(p=>p.id)),eventIds=new Set(state.events.map(e=>e.id)),refs=new Set();
  for(const e of state.events){if(e.externalRef){if(typeof e.externalRef!=='string'||e.externalRef.length>250||refs.has(e.externalRef))throw Error('外部流水号重复或无效');refs.add(e.externalRef);}for(const k of ['importBatchId','actionId'])if(e[k]!==undefined&&(typeof e[k]!=='string'||e[k].length>100))throw Error('流水关联无效');}
  const batches=new Set();
  for(const b of state.imports){if(!b||typeof b.id!=='string'||batches.has(b.id)||!['products','events'].includes(b.kind)||typeof b.name!=='string'||b.name.length>150||typeof b.source!=='string'||b.source.length>60||typeof b.fingerprint!=='string'||b.fingerprint.length!==64||!Array.isArray(b.productIds)||!Array.isArray(b.eventIds)||typeof b.undone!=='boolean')throw Error('导入历史无效');batches.add(b.id);if(!b.undone&&(b.productIds.some(id=>!productIds.has(id))||b.eventIds.some(id=>!eventIds.has(id))))throw Error('导入历史关联缺失');}
  if(state.coverage!==null&&(!state.coverage||!validDate(state.coverage.from)||!validDate(state.coverage.to)||state.coverage.from>state.coverage.to||state.coverage.to>today()))throw Error('完整销售记录期间无效');
  const actionIds=new Set();
  for(const a of state.actions){if(!a||typeof a.id!=='string'||actionIds.has(a.id)||!productIds.has(a.productId)||!['restock','slow'].includes(a.kind)||!['accepted','executed','reviewed','rejected'].includes(a.status)||!validDate(a.asof)||typeof a.note!=='string'||a.note.length>1000||!a.facts||!integer(a.facts.qty)||!integer(a.facts.value))throw Error('行动记录无效');actionIds.add(a.id);if(a.eventId&&!eventIds.has(a.eventId))throw Error('行动关联的执行流水缺失');if(['executed','reviewed'].includes(a.status)&&(!validDate(a.executedAt)||a.executedAt>today()))throw Error('行动执行日期无效');if(a.review&&(!validDate(a.review.date)||a.review.date<a.executedAt||a.review.date>today()||!['有帮助','无明显变化','有问题','待观察'].includes(a.review.outcome)||typeof a.review.note!=='string'||a.review.note.length>1000))throw Error('复盘记录无效');}
  for(const a of state.actions){if(a.status==='reviewed'&&!a.review)throw Error('已复盘行动缺少观察记录');if(a.reviews!==undefined&&(!Array.isArray(a.reviews)||a.reviews.length>100||a.reviews.some(r=>!r||!validDate(r.date)||r.date<a.executedAt||r.date>today()||!['有帮助','无明显变化','有问题','待观察'].includes(r.outcome)||typeof r.note!=='string'||r.note.length>1000)))throw Error('观察历史无效');}
  for(const e of state.events)if(e.orderId||e.orderTime){if(e.type!=='sale'||!e.orderId||typeof e.orderId!=='string'||e.orderId.length>80||e.orderTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.orderTime))throw Error('订单明细无效');}
  const orders=new Map();for(const e of state.events.filter(e=>e.orderId)){const key=e.date+'|'+e.orderId,previous=orders.get(key);if(previous&&(previous.payment!==e.payment||previous.time&&e.orderTime&&previous.time!==e.orderTime))throw Error('同一订单的结算方式与成交时间不一致');orders.set(key,{payment:e.payment,time:e.orderTime||previous?.time||''});}
  validateBusiness(state,validDate,today());ledger(state);return state;
}
