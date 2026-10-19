import {addTrial,createCampaign,addService} from './business.mjs';
import {blank,addProduct,addEvent,today} from './domain.mjs';
export function demo(){
  let s=blank();s.store='惠民便利店 · 演示';s.demo=true;
  for(const p of [{sku:'DR001',name:'矿泉水 550ml',unit:'瓶',category:'饮料',cost:100,price:200,minStock:24},{sku:'FD002',name:'苏打饼干',unit:'袋',category:'零食',cost:300,price:500,minStock:8},{sku:'DR003',name:'纯牛奶 250ml',unit:'盒',category:'乳品',cost:200,price:350,minStock:12}])s=addProduct(s,p);
  const [water,cookie,milk]=s.products;const end=today();const day=n=>{const d=new Date(end+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
  const add=e=>s=addEvent(s,e);
  add({type:'capital',date:day(6),amount:300000});
  for(const [p,qty] of [[water,100],[cookie,60],[milk,80]])add({type:'purchase',date:day(6),productId:p.id,qty,amount:qty*p.cost,payment:'cash'});
  for(let n=6;n>=0;n--){for(const [p,qty] of [[water,10+(n%3)],[cookie,4],[milk,7]])add({type:'sale',date:day(n),productId:p.id,qty,amount:qty*p.price,payment:n===2?'credit':'cash',orderId:'DEMO-'+day(n)+'-'+(p.id===milk.id?'B':'A'),orderTime:p.id===milk.id?'18:20':'10:30'});}
  add({type:'expense',date:end,amount:12000,note:'演示：本周水电费用'});
  s.coverage={from:day(6),to:end,confirmedAt:end};s=addTrial(s,{productId:milk.id,source:'演示：店主候选记录示例，非真实访谈',reason:'演示如何记录小量试销',cost:milk.cost,price:milk.price,startDate:day(6)});s=createCampaign(s,{productId:water.id,title:'演示：周末饮水活动',from:end,to:end,price:180});s=addService(s,{date:end,type:'maintenance',minutes:30,cost:0,note:'演示：整理商品与流水'});return s;
}
