import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceGroups,groupForRoute,renderContextNav,dashboardView} from '../public/workspace-ui.mjs';
import {blank,reports,stockList,money,today} from '../public/domain.mjs';
import {demo} from '../public/demo.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function view(state){const end=today(),start=end.slice(0,7)+'-01',r=reports(state,start,end),daily=new Map();for(const e of r.period){if(!daily.has(e.date))daily.set(e.date,{revenue:0,cogs:0});const d=daily.get(e.date);d.revenue+=e.delta.revenue;d.cogs+=e.delta.cogs;}return {html:dashboardView({state,r,low:stockList(state,end).filter(p=>p.low),start,end,cash:n=>'¥'+money(n),esc,eventTable:()=>'',daily,pending:0}),r};}
test('六个主板块覆盖全部原有深链接，二级页面各有唯一归属',()=>{
  const original=['dashboard','products','stocktake','activity','imports','operations','orders','selection','marketing','reports','assistant','profit','balance','cashflow','feedback','settings','help'];
  assert.equal(workspaceGroups.length,6);
  assert.deepEqual(workspaceGroups.flatMap(g=>g.routes).sort(),original.sort());
  for(const route of original)assert.ok(groupForRoute(route).routes.includes(route));
  assert.equal(groupForRoute('stocktake').id,'products');
  assert.equal(groupForRoute('assistant').id,'operations');
  assert.equal(groupForRoute('balance').id,'profit');
  assert.match(renderContextNav('stocktake'),/href="#stocktake" aria-current="page"/);
  assert.equal((renderContextNav('assistant').match(/aria-current="page"/g)||[]).length,1);
});
test('首页使用同一账本的金额，逐日明细可核对，商品文本会转义',()=>{
  const state=demo();state.products[0].name='<img src=x onerror=alert(1)>';
  const {html,r}=view(state);
  for(const n of [r.profit.revenue,r.profit.total,r.balance.cash])assert.ok(html.includes('¥'+money(n)));
  assert.match(html,/查看每日收入与成本明细/);
  assert.match(html,/&lt;img/);
  assert.doesNotMatch(html,/<img src=x/);
  assert.match(html,/未记录的日期不补零/);
  assert.match(html,/href="#operations"/);
});
test('空门店显示建档和录入入口，不渲染虚构趋势',()=>{
  const {html}=view(blank());
  assert.match(html,/添加第一个商品/);
  assert.match(html,/记下第一笔/);
  assert.doesNotMatch(html,/id="trend-chart"/);
  assert.doesNotMatch(html,/查看每日收入与成本明细/);
});
