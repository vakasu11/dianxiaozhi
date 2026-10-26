// Shared workspace presentation. All amounts and warnings come from the ledger.
const paths={
  store:'M3 10h18M4 10v10h16V10M3 10l2-6h14l2 6M9 20v-7h6v7',
  home:'m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8',
  box:'m3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10M7 5l9 4',
  list:'M8 5h13M8 12h13M8 19h13M3 5h.1M3 12h.1M3 19h.1',
  chart:'M4 3v17h17M8 14l4-5 4 3 5-7',
  wallet:'M3 6h17v15H3zM3 6V3h15v3M15 11h6v5h-6z',
  settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  plus:'M12 5v14M5 12h14',
  arrow:'M5 12h14m-5-5 5 5-5 5',
  alert:'m12 3 10 18H2zM12 9v5M12 17h.1',
  chat:'M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 0 1-1-5 9 9 0 0 1 18 0zM8 10h8M8 14h5',
  check:'m5 12 4 4L19 6',
  file:'M5 3h9l5 5v13H5zM14 3v6h5M9 13h6M9 17h6',
};
export const uiIcon=(name,cls='')=>`<svg class="ui-icon ${cls}" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.file}"/></svg>`;
export const workspaceGroups=[
  {id:'dashboard',label:'门店首页',icon:'home',routes:['dashboard']},
  {id:'products',label:'商品库存',icon:'box',routes:['products','stocktake'],tabs:[['products','商品与库存'],['stocktake','库存盘点']]},
  {id:'activity',label:'经营流水',icon:'list',routes:['activity']},
  {id:'operations',label:'经营帮手',icon:'chart',routes:['operations','assistant','orders','selection','marketing','reports'],tabs:[['operations','建议与复盘'],['assistant','经营问答'],['orders','订单分析'],['selection','选品试销'],['marketing','活动文案'],['reports','经营报告']]},
  {id:'profit',label:'看懂账目',icon:'wallet',routes:['profit','balance','cashflow']},
  {id:'settings',label:'门店与数据',icon:'settings',routes:['settings','imports','help','feedback'],tabs:[['settings','门店与备份'],['imports','数据导入'],['help','手机使用'],['feedback','试用反馈']]},
];
export const groupForRoute=route=>workspaceGroups.find(group=>group.routes.includes(route))||workspaceGroups[0];
export function renderContextNav(route){
  const group=groupForRoute(route);
  return group.tabs?`<nav class="workspace-tabs" aria-label="${group.label}中的功能">${group.tabs.map(([id,label])=>`<a href="#${id}" ${id===route?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`:'';
}
export function decorateWorkspaceNavigation(){
  document.querySelectorAll('[data-workspace-icon]').forEach(el=>{el.innerHTML=uiIcon(el.dataset.workspaceIcon);});
}
export function dashboardView({state,r,low,start,end,cash,esc,eventTable,daily,pending}){
  const bs=r.balance,hasProducts=state.products.some(p=>p.active),hasRecords=r.period.length>0;
  const days=[...daily.entries()];
  return `<section class="store-actions" aria-label="常用功能">
    <button class="store-action action-sale" id="quick-sale"><span class="action-icon">${uiIcon('plus')}</span><span><strong>记销售</strong><small>${hasProducts?'卖出商品，顺手记一笔':'先建商品，再记录销售'}</small></span>${uiIcon('arrow','action-arrow')}</button>
    <button class="store-action action-income" id="quick-income"><span class="action-icon">${uiIcon('chart')}</span><span><strong>看收入</strong><small>收入、成本，一起看清</small></span>${uiIcon('arrow','action-arrow')}</button>
    <a class="store-action action-stock" href="#products"><span class="action-icon">${uiIcon('box')}</span><span><strong>查库存</strong><small>还有多少货，随时核对</small></span>${uiIcon('arrow','action-arrow')}</a>
    <a class="store-action action-restock" href="#operations"><span class="action-icon">${uiIcon('alert')}</span><span><strong>补货提醒</strong><small>${low.length?`${low.length} 个商品库存偏低`:'按商品预警线检查'}</small></span>${uiIcon('arrow','action-arrow')}</a>
  </section>
  ${!hasProducts?`<section class="setup-prompt"><div><strong>先把常卖的商品加进来</strong><p>填好商品、售价和期初数量，就能开始记销售、查库存。</p></div><button id="first-product" class="button primary">添加第一个商品</button></section>`:''}
  <section class="income-panel" id="income-overview" tabindex="-1" aria-labelledby="income-title">
    <div class="income-summary"><div class="section-title"><span class="section-icon">${uiIcon('chart')}</span><h2 id="income-title">这段时间的生意</h2></div><p class="summary-period">${esc(start)} 至 ${esc(end)}</p>
      <div class="revenue-total"><span>卖了多少钱<span class="accounting-label">营业收入</span></span><strong>${cash(r.profit.revenue)}</strong><small>来自本期已录入的销售</small></div>
      <div class="income-secondary"><div class="profit-stat"><span>本期利润</span><strong class="${r.profit.total<0?'negative-value':''}">${cash(r.profit.total)}</strong><small>未计税费及折旧</small></div><div class="cash-stat"><span>手头资金</span><strong class="${bs.cash<0?'negative-value':''}">${cash(bs.cash)}</strong><small>含现金及收款账户</small></div></div>
      <a class="summary-report-link" href="#profit">看收入和利润明细 ${uiIcon('arrow')}</a>
    </div>
    <div class="income-chart"><div class="panel-head"><h2>收入与成本走势</h2><span class="muted">单位：元</span></div>
      ${hasRecords?`<div id="trend-chart" class="chart" role="img" aria-label="${esc(start)} 至 ${esc(end)}的营业收入与销售成本，收入${cash(r.profit.revenue)}。每日数值可在下方明细查看。"></div>`:`<div class="chart-empty">${uiIcon('chart')}<strong>记下第一笔，这里就有走势</strong><p>图表会随销售、采购等记录更新。</p><button id="empty-chart-record" class="button subtle">记一笔业务</button></div>`}
      <p class="chart-explainer">${hasRecords?'仅显示有经营记录的日期，未记录的日期不补零。':'目前没有所选期间的经营记录。'}</p>
    </div>
    ${hasRecords?`<details class="chart-data"><summary>查看每日收入与成本明细</summary><div class="table-wrap"><table><caption class="sr-only">收入与成本走势的每日数据，单位为人民币元</caption><thead><tr><th scope="col">日期</th><th scope="col" class="numeric">营业收入</th><th scope="col" class="numeric">销售成本</th></tr></thead><tbody>${days.map(([date,d])=>`<tr><th scope="row">${esc(date)}</th><td class="numeric">${cash(d.revenue)}</td><td class="numeric">${cash(d.cogs)}</td></tr>`).join('')}</tbody></table></div></details>`:''}
  </section>
  <section class="attention-strip" aria-label="需要关注的事">
    <a class="stock-attention" href="#products"><span class="attention-icon">${uiIcon(low.length?'alert':'check')}</span><span><strong>${low.length?`${low.length} 个商品，该留意库存了`:'库存预警，随时查看'}</strong><small>${low.length?low.slice(0,3).map(p=>`${esc(p.name)}剩余 ${p.qty}${esc(p.unit)}`).join('；'):(hasProducts?'目前没有商品触及设定预警线。':'添加商品后，可为每个商品设置预警数量。')}</small></span>${uiIcon('arrow')}</a>
    <a class="task-attention" href="#operations"><span class="attention-icon">${uiIcon('check')}</span><span><strong>${pending?`${pending} 项经营行动待跟进`:'补货之前，先看记录是否完整'}</strong><small>${state.coverage?`已确认完整销售期间：${esc(state.coverage.from)} 至 ${esc(state.coverage.to)}`:'确认完整销售期间后，才能计算参考补货数量。'}</small></span>${uiIcon('arrow')}</a>
  </section>
  <div class="dashboard-bottom"><section class="card recent-records"><div class="panel-head"><div><h2>最近记了什么</h2><p class="muted">本期 ${r.period.length} 条业务，显示最近 5 条</p></div><a href="#activity" class="text-button">全部流水 ${uiIcon('arrow')}</a></div>${eventTable(r.period.slice(-5).reverse())}</section>
    <aside class="dashboard-helper"><span class="helper-icon">${uiIcon('chat')}</span><h2>有数字看不明白？</h2><p>试着问：“本期赚了多少钱？”<br>或“哪些商品需要补货？”</p><a class="button subtle" href="#assistant">问问经营助手 ${uiIcon('arrow')}</a><div class="balance-reminder"><span>待收款 <strong>${cash(bs.receivable)}</strong></span><span>待付款 <strong>${cash(bs.payable)}</strong></span></div></aside></div>`;
}
