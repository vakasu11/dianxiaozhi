import {previewStocktake,confirmStocktake,stockList,ledger,money,today} from './domain.mjs';

export function renderStocktake(c){
  const {$=s=>document.querySelector(s),state,esc,field,openDialog,commit}=c;
  const active=stockList(state).filter(p=>p.active),history=ledger(state).rows.filter(e=>e.type==='stocktake').reverse();
  const chosen=new URLSearchParams(location.hash.split('?')[1]||'').get('product');
  $('#content').innerHTML=`<section class="card stocktake-panel"><h2>核对实物库存</h2><p class="data-note">先补齐当天的采购、销售和报损，再数实物。盘点只调整库存差异，不生成销售或现金。</p>${active.length?`<form id="stocktake-form"><label class="field">盘点商品<select name="productId" required>${active.map(p=>`<option value="${esc(p.id)}" ${p.id===chosen?'selected':''}>${esc(p.name)}（${esc(p.sku)}）</option>`).join('')}</select></label><p id="stocktake-book" class="stocktake-book"></p><div class="fields-grid">${field('盘点日期','date',today(),'date',`required max="${today()}"`)}${field('实盘数量（基础单位）','qty','','number','required min="0" max="10000000000" step="1" inputmode="numeric"')}</div><label class="field">原因或核对说明<textarea name="note" required maxlength="200" rows="2" placeholder="例如：复点后少了 2 瓶，待核查；或实物与账面一致"></textarea></label><button class="button primary">预览盘点差异</button><p id="stocktake-error" class="error" role="alert"></p></form>`:'<p>先建立商品档案，再进行盘点。</p><a href="#products" class="button primary">建立商品</a>'}</section><section class="card"><div class="panel-head"><h2>盘点记录</h2><a class="text-button" href="#activity">查看全部流水 / 撤销</a></div>${history.length?`<div class="table-wrap"><table><thead><tr><th>日期 / 商品</th><th class="numeric">账面</th><th class="numeric">实盘</th><th>差异与损益</th><th>原因</th></tr></thead><tbody>${history.map(e=>{const p=state.products.find(p=>p.id===e.productId),diff=e.qty-e.bookQty;return `<tr><td>${esc(e.date)}<small>${esc(p?.name)}</small></td><td class="numeric">${e.bookQty} ${esc(p?.unit)}</td><td class="numeric">${e.qty} ${esc(p?.unit)}</td><td>${diff>0?'盘盈 '+diff:diff<0?'盘亏 '+(-diff):'账实一致'}<small>${diff>0?'盘盈收益 ¥'+money(e.amount):diff<0?'库存损失 ¥'+money(e.delta.loss):'不影响损益'}</small></td><td>${esc(e.note)}</td></tr>`;}).join('')}</tbody></table></div>`:'<p class="muted">尚无盘点记录。预览后确认才会写入。</p>'}<p class="filter-note">盘盈按盘点时的库存平均成本估值；原库存为零时采用当时商品参考进价，并保存该依据。盘亏按库存成本计入损失。原因未查清的差异请后续核实，本页不是正式账务审批。</p></section>`;
  if(!active.length)return;
  const form=$('#stocktake-form');
  const showBook=()=>{const p=active.find(p=>p.id===form.elements.productId.value);$('#stocktake-book').textContent=`账面 ${p.qty} ${p.unit}，库存成本 ¥${money(p.value)}。请按“${p.unit}”填写实盘数量。`;};
  form.elements.productId.onchange=()=>{form.elements.qty.value='';showBook();};showBook();
  form.onsubmit=e=>{
    e.preventDefault();$('#stocktake-error').textContent='';
    try{
      const f=new FormData(form),note=String(f.get('note')||'').trim();if(!note)throw Error('请填写盘点原因或核对说明');
      const p=active.find(p=>p.id===f.get('productId')),preview=previewStocktake(c.getState(),{productId:p.id,date:f.get('date'),qty:Number(f.get('qty'))});
      openDialog('确认盘点差异',`<p><strong>${esc(p.name)}</strong>　${esc(preview.date)}</p><dl class="count-review"><div><dt>原账面数量</dt><dd>${preview.bookQty} ${esc(p.unit)}</dd></div><div><dt>实盘数量</dt><dd>${preview.qty} ${esc(p.unit)}</dd></div><div><dt>数量差异</dt><dd>${preview.difference>0?'盘盈 '+preview.difference:preview.difference<0?'盘亏 '+(-preview.difference):'账实一致'}</dd></div><div><dt>库存成本变动</dt><dd>${preview.valueDelta>0?'+':''}${money(preview.valueDelta)} 元</dd></div><div><dt>本期损益影响</dt><dd>${preview.gain?'盘盈收益 +'+money(preview.gain):preview.loss?'库存损失 −'+money(preview.loss):'0.00'} 元</dd></div></dl><p class="form-note">估值依据：${esc(preview.costBasis)}${!preview.bookQty?' ¥'+money(preview.referenceCost)+' / '+esc(p.unit):''}。不影响现金、营业收入或销售数量。</p><p class="count-reason">说明：${esc(note)}</p>`,()=>{commit(confirmStocktake(c.getState(),preview,note));});
      $('#edit-form .primary').textContent='确认并记录盘点';
    }catch(error){$('#stocktake-error').textContent=error.message;}
  };
}
