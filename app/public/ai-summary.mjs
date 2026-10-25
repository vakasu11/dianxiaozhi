// Shared allowlist: never forward a complete ledger, chat history or arbitrary fields.
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const text=(v,max=80)=>typeof v==='string'?v.slice(0,max):undefined;
function pick(value,numbers=[],strings=[],booleans=[]){
  const v=object(value),out={};
  for(const k of numbers)if(v[k]===null)out[k]=null;else if(typeof v[k]==='number'&&Number.isFinite(v[k])&&Math.abs(v[k])<=Number.MAX_SAFE_INTEGER)out[k]=v[k];
  for(const k of strings){const s=text(v[k],k==='warning'?200:80);if(s!==undefined)out[k]=s;}
  for(const k of booleans)if(typeof v[k]==='boolean')out[k]=v[k];
  return out;
}
export function modelSummary(input){
  const v=object(input);
  if(v.campaign){const c=pick(v.campaign,['price'],['title','from','to']);c.text=text(v.campaign.text,5000)||'';return{unit:'分',campaign:c};}
  const out={currency:'CNY',unit:'分',scope:'简化经营账，未计税费折旧；缺失记录不代表零；只使用本次汇总。',period:pick(v.period,[],['start','end']),dataMode:text(v.dataMode,30)||'未说明',records:pick(v,['records']).records};
  const groups={profit:['revenue','cogs','gross','expense','loss','gain','total'],balance:['cash','inventory','receivable','payable','capital','retained','assets','equity','total','difference'],flow:['opening','operatingIn','operatingOut','financingIn','financingOut','investing','closing','operating','financing','net'],orderSummary:['count','average','linkedLines','totalLines'],service:['minutes','cost'],model:['calls','failed','inputTokens','outputTokens','unknownCost','costMicros'],actions:['pending','executed','reviewed']};
  for(const [k,fields] of Object.entries(groups))if(v[k])out[k]=pick(v[k],fields);
  const lists={products:x=>pick(x,['qty','minStock','value','sold'],['name','unit'],['low']),inventoryAnalysis:x=>pick(x,['qty','days','sold','average','coverageDays','suggestedQty'],['name','unit','from','warning'],['restock','slow']),trials:x=>pick(x,[],['name','status','startDate'])};
  let omitted=0;
  for(const [k,mapper] of Object.entries(lists))if(Array.isArray(v[k])){out[k]=v[k].slice(0,100).map(mapper);omitted+=Math.max(0,v[k].length-100);}
  out.omittedRows=omitted+(Number.isSafeInteger(v.omittedRows)&&v.omittedRows>0?v.omittedRows:0);
  return out;
}
