const short=(v,max)=>typeof v==='string'&&v.length<=max;
const nonnegative=v=>Number.isSafeInteger(v)&&v>=0&&v<=1e12;
export function validateBusiness(s,date,now){
  const pids=new Set(s.products.map(p=>p.id)),aids=new Set(s.actions.map(a=>a.id));
  for(const name of ['trials','campaigns','serviceRecords','feedback','modelUsage']){
    if(!Array.isArray(s[name])||s[name].length>5000)throw Error('业务扩展数据无效：'+name);
    const ids=new Set();for(const row of s[name]){if(!row||!short(row.id,100)||!row.id||ids.has(row.id))throw Error('业务标识无效');ids.add(row.id);}
  }
  for(const t of s.trials){if(!short(t.name,80)||!t.name.trim()||!short(t.source,300)||!t.source.trim()||!short(t.reason,1000)||!date(t.startDate)||t.startDate>now||!['planned','running','closed'].includes(t.status)||!nonnegative(t.cost)||!nonnegative(t.price)||(t.productId&&!pids.has(t.productId))||!short(t.note,1000)||(t.closedAt&&(!date(t.closedAt)||t.closedAt<t.startDate||t.closedAt>now)))throw Error('试销记录无效');}
  for(const c of s.campaigns){if(!pids.has(c.productId)||!short(c.title,80)||!c.title.trim()||!date(c.from)||!date(c.to)||c.from>c.to||!nonnegative(c.price)||c.price===0||!nonnegative(c.unitCost)||!short(c.costBasis,100)||!short(c.text,5000)||!c.text.trim()||!['draft','executed'].includes(c.status)||(c.status==='executed'&&!c.executedAt)||(c.executedAt&&(!date(c.executedAt)||c.executedAt<c.from||c.executedAt>c.to||c.executedAt>now)))throw Error('活动记录无效');}
  for(const r of s.serviceRecords){if(!date(r.date)||!['visit','onboarding','maintenance','other'].includes(r.type)||!Number.isSafeInteger(r.minutes)||r.minutes<0||r.minutes>1440||!nonnegative(r.cost)||!short(r.note,1000))throw Error('服务投入记录无效');}
  for(const f of s.feedback){if(!date(f.date)||!['data','advice','experience','other'].includes(f.category)||!['helpful','neutral','unhelpful'].includes(f.rating)||!['low','normal','high'].includes(f.priority)||!['open','planned','resolved'].includes(f.status)||!short(f.text,1000)||!f.text.trim()||(f.actionId&&!aids.has(f.actionId)))throw Error('反馈记录无效');}
  for(const u of s.modelUsage){if(!date(u.date)||!['success','failed'].includes(u.status)||![u.inputTokens,u.outputTokens].every(v=>v===null||nonnegative(v))||!(u.costMicros===null||nonnegative(u.costMicros))||!Number.isFinite(u.durationMs)||u.durationMs<0)throw Error('模型用量记录无效');}
  if(!s.rates||![s.rates.input,s.rates.output].every(v=>v===null||nonnegative(v)))throw Error('模型费率无效');
  for(const rows of [s.serviceRecords,s.feedback,s.modelUsage])if(rows.some(r=>r.date>now))throw Error('实际记录日期不能晚于今天');
}
