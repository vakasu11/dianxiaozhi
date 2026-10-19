import {addProduct,addEvent,validate,uid,today,amount,TYPES} from './domain.mjs';
export const FIELDS={
  products:[['sku','商品编码',true],['name','商品名称',true],['unit','单位',true],['category','分类'],['price','售价（元）',true],['cost','进价（元）',true],['minStock','预警数量'],['leadDays','供货天数'],['safetyDays','安全天数'],['packSize','补货包装数']],
  events:[['externalId','外部流水号',true],['date','日期',true],['type','业务类型',true],['sku','商品编码'],['qty','数量'],['amount','总金额（元）'],['payment','结算方式'],['note','备注'],['orderId','订单编号'],['orderTime','成交时间']]
};
const aliases={sku:['编码','sku'],name:['名称','品名'],unit:['计量单位'],price:['售价','单价','销售单价'],cost:['进价','参考进货单价'],amount:['金额','总金额'],externalId:['流水号','外部单号'],date:['业务日期'],type:['业务','类型']};
const clean=s=>String(s??'').trim();
export function parseCSV(text){
  if(typeof text!=='string'||text.length>5000000)throw Error('CSV 内容超过限制');text=text.replace(/^\ufeff/,'');
  const first=text.split(/\r?\n/,1)[0];const separator=first.includes('\t')?'\t':first.includes(',')?',':first.includes(';')?';':',';
  const rows=[];let row=[],cell='',quoted=false,closed=false;
  const push=()=>{row.push(cell);cell='';closed=false;};
  for(let i=0;i<text.length;i++){
    const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
    if(c==='"'){if(cell||closed)throw Error('CSV 引号位置错误');quoted=true;}
    else if(c===separator)push();else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;push();if(row.some(v=>v.trim()))rows.push(row);row=[];if(rows.length>1001)throw Error('每次最多导入 1000 行数据');}
    else {if(closed&&!/\s/.test(c))throw Error('CSV 引号后有多余内容');if(!closed)cell+=c;}
  }
  if(quoted)throw Error('CSV 引号未闭合');push();if(row.some(v=>v.trim()))rows.push(row);
  if(rows.length<2)throw Error('至少需要一行表头和一行数据');if(rows.length>1001||rows.some(r=>r.length>40))throw Error('每次最多 1000 行、40 列');
  return rows;
}
export function suggestMapping(kind,headers){return Object.fromEntries(FIELDS[kind].map(([key,label])=>{const names=[key,label,...(aliases[key]||[])].map(x=>x.replace(/[（(].*?[）)]/g,'').toLowerCase());return[key,headers.findIndex(h=>names.includes(clean(h).replace(/[（(].*?[）)]/g,'').toLowerCase()))];}));}
export function csvEncode(rows){return '\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,"'$&").replaceAll('"','""')+'"').join(',')).join('\r\n');}
export function template(kind,date=today()){
  if(kind==='products')return [FIELDS.products.map(x=>x[1]),['SAMPLE001','示例矿泉水','瓶','饮料','2.00','1.00','24','2','3','24']];
  return [FIELDS.events.map(x=>x[1]),['EXT-001',date,'初始商品投入','SAMPLE001','100','100.00','','初始商品投入；总金额为库存成本','',''],['EXT-002',date,'销售出库','SAMPLE001','2','4.00','现结','替换为实际业务','R001','10:30']];
}
function rowNumber(value,label,min=0,max=1e10){const s=clean(value);if(!/^\d+$/.test(s)||!Number.isSafeInteger(+s)||+s<min||+s>max)throw Error(`${label}应为 ${min}–${max} 的整数`);return +s;}
const defaultNumber=(value,label,fallback,min=0,max=1e10)=>clean(value)===''?fallback:rowNumber(value,label,min,max);
function dateValue(value){const s=clean(value).replaceAll('/','-');const m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:s;}
function requiredMoney(value,label){if(clean(value)==='')throw Error(`缺少${label}`);return amount(value);}
export async function prepareImport(state,{kind,source='手工表格',name='粘贴表格',table,mapping}){
  if(!FIELDS[kind]||!Array.isArray(table)||table.length<2||table.length>1001)throw Error('请选择导入类型，并提供 1–1000 行数据');
  source=clean(source);if(!source||source.length>60)throw Error('请填写不超过 60 字的来源名称');name=clean(name).slice(0,150);
  const used=[];for(const [key,label,required] of FIELDS[kind]){const n=Number(mapping[key]);if(!Number.isInteger(n)||n< -1||n>=table[0].length)throw Error(`${label}字段映射无效`);if(required&&n<0)throw Error(`请映射${label}`);if(n>=0){if(used.includes(n))throw Error('同一列不能映射到多个字段');used.push(n);}}
  const normalized=table.slice(1).map((row,index)=>({row:index+2,values:Object.fromEntries(FIELDS[kind].map(([k])=>[k,mapping[k]>=0?clean(row[mapping[k]]):'']))})).filter(r=>Object.values(r.values).some(Boolean));
  if(!normalized.length)throw Error('没有可导入的数据');
  const bytes=new TextEncoder().encode(JSON.stringify({kind,source,rows:normalized.map(r=>r.values)})),fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  let next=structuredClone(state);const batchId=uid(),rows=[],productIds=[],eventIds=[];
  const refs=new Map(state.events.filter(e=>e.externalRef).map(e=>[e.externalRef,e]));const productKeys=['sku','name','unit','category','price','cost','minStock','leadDays','safetyDays','packSize'];
  for(const row of normalized){const v=row.values;try{
    if(kind==='products'){
      const p={sku:v.sku,name:v.name,unit:v.unit,category:v.category||'其他',price:requiredMoney(v.price,'售价'),cost:requiredMoney(v.cost,'进价'),minStock:defaultNumber(v.minStock,'预警数量',5),leadDays:defaultNumber(v.leadDays,'供货天数',2,0,365),safetyDays:defaultNumber(v.safetyDays,'安全天数',3,0,365),packSize:defaultNumber(v.packSize,'补货包装数',1,1,100000)};
      if(!v.sku||!v.name||!v.unit)throw Error('商品编码、商品名称和单位不能为空');
      const old=next.products.find(x=>x.sku.toLowerCase()===p.sku.toLowerCase());
      if(old){if(!productKeys.every(k=>k==='sku'?old[k].toLowerCase()===p[k].toLowerCase():old[k]===p[k]))throw Error('商品编码已存在且资料不同，请在商品页核对修改');rows.push({...row,status:'duplicate',message:'相同商品档案，跳过'});continue;}
      next=addProduct(next,p);const item=next.products.at(-1);item.importBatchId=batchId;productIds.push(item.id);rows.push({...row,status:'ready',message:'新增商品'});
    }else{
      if(!v.externalId||v.externalId.length>100)throw Error('外部流水号必填，最多 100 字；每笔必须唯一');
      const externalRef=JSON.stringify([source,v.externalId]);
      const type=Object.keys(TYPES).find(k=>k===v.type||TYPES[k]===v.type);if(!type)throw Error('业务类型不支持');
      const isStock=['opening','purchase','sale','loss'].includes(type),product=next.products.find(p=>p.sku.toLowerCase()===v.sku.toLowerCase());
      if(isStock&&(!product||!product.active))throw Error('商品编码不存在或商品已停用，请先导入商品档案');
      let payment='cash';if(['sale','purchase'].includes(type)){if(['现结','现金','cash'].includes(v.payment))payment='cash';else if(['赊账','赊销','赊购','credit'].includes(v.payment))payment='credit';else throw Error('采购/销售的结算方式应填写现结或赊账');}
      if(v.note.length>200)throw Error('备注最多 200 字');if(type==='loss'&&v.amount&&amount(v.amount)!==0)throw Error('报损金额请留空或填 0，由库存成本计算');
      const incoming={type,date:dateValue(v.date),productId:isStock?product.id:null,qty:isStock?rowNumber(v.qty,'数量',1):0,amount:type==='loss'?0:requiredMoney(v.amount,'总金额'),payment,note:v.note,externalRef,importBatchId:batchId,orderId:v.orderId||'',orderTime:v.orderTime||''};
      if(refs.has(externalRef)){const old=refs.get(externalRef);if(!['type','date','productId','qty','amount','payment','note','orderId','orderTime'].every(k=>(old[k]??'')===(incoming[k]??'')))throw Error('此流水号已存在但业务内容不同，请核对来源和原始记录');rows.push({...row,status:'duplicate',message:'同一来源且内容相同的流水，跳过'});continue;}
      const n=addEvent(next,incoming);next=n;refs.set(externalRef,next.events.at(-1));eventIds.push(next.events.at(-1).id);rows.push({...row,status:'ready',message:TYPES[type]});
    }
  }catch(e){rows.push({...row,status:'error',message:e.message});}}
  const batch={id:batchId,kind,name,source,fingerprint,date:today(),productIds,eventIds,undone:false,productCopies:next.products.filter(p=>productIds.includes(p.id))};
  next.imports.push(batch);
  return {revision:state.revision,kind,source,name,rows,errors:rows.filter(r=>r.status==='error'),duplicates:rows.filter(r=>r.status==='duplicate').length,count:productIds.length+eventIds.length,batch,next};
}
export function applyImport(state,plan){if(state.revision!==plan.revision)throw Error('预览后数据已经改变，请重新校验');if(plan.errors.length)throw Error('请修正所有错误后再导入，本批未写入任何数据');if(!plan.count)throw Error('没有新增数据，全部是重复记录');return validate(structuredClone(plan.next));}
export function undoImport(state,id){
  const batch=state.imports.find(b=>b.id===id);if(!batch||batch.undone)throw Error('批次不存在或已撤销');
  if(state.imports.filter(b=>!b.undone).at(-1)?.id!==id)throw Error('请先撤销更新的导入批次');
  const events=new Set(batch.eventIds),products=new Set(batch.productIds),after=state.events.filter(e=>!events.has(e.id));
  if(batch.eventIds.length&&state.events.slice(-batch.eventIds.length).some(e=>!events.has(e.id)))throw Error('该批次之后已有新流水，请先处理后续流水');
  if(after.some(e=>products.has(e.productId))||state.actions.some(a=>events.has(a.eventId)||products.has(a.productId)))throw Error('该批次已被后续业务或行动记录引用，不能撤销');
  if(batch.productIds.length&&batch.productCopies.some(p=>JSON.stringify(p)!==JSON.stringify(state.products.find(x=>x.id===p.id))))throw Error('导入商品已被编辑，不能直接撤销');
  const next=structuredClone(state);next.events=after;next.products=next.products.filter(p=>!products.has(p.id));next.imports.find(b=>b.id===id).undone=true;next.coverage=null;return validate(next);
}
export function undoLastEvent(state){
  const e=state.events.at(-1);if(!e)throw Error('没有可撤销的流水');if(e.importBatchId)throw Error('这条流水来自导入批次，请到数据导入页面整批撤销');if(e.actionId||state.actions.some(a=>a.eventId===e.id))throw Error('这条流水关联执行记录，不能单独撤销');
  const next=structuredClone(state);next.events.pop();next.coverage=null;return validate(next);
}
