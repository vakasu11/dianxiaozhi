import {storageStatus,requestPersistence} from './device.mjs';
const $=s=>document.querySelector(s);
export function devicePanel(c){
  const {state,mode,storage,esc}=c,last=storage.getItem('last-export.'+mode);
  return `<section class="card"><h2>本机保存</h2><p id="device-summary">${state.products.length} 个商品，${state.events.length} 条流水；${last?'上次发起导出 '+esc(last.slice(0,10)):'尚未导出备份'}。</p><p class="muted">门店、商品、流水、聊天及行动都保存在当前浏览器，不自动云同步。主动使用 AI 时，本次问题和必要汇总会发送给后端及智谱。同一台手机里的不同浏览器也不会共享记录。</p><p id="device-persistence" class="muted">正在检查本地保存状态…</p><button id="request-persistence" class="button subtle">申请持久保存</button><p class="filter-note">浏览器可能拒绝此申请。即使取得许可，手动清理浏览器或更换设备仍需依靠文件备份恢复。</p></section>`;
}
export function attachDeviceControls(notify){
  storageStatus().then(s=>{if(!$('#device-persistence'))return;$('#device-persistence').textContent=s.persisted?'已取得持久保存许可':'浏览器可能在存储紧张时清理本地记录';$('#request-persistence').disabled=!s.supported||s.persisted;});
  $('#request-persistence').onclick=async()=>{const retained=await requestPersistence();$('#device-persistence').textContent=retained?'已取得持久保存许可':'浏览器未授予许可，请定期导出备份';notify(retained?'已取得持久保存许可；仍建议导出文件备份':'浏览器未授予许可，现有数据保持不变');};
}
export function renderHelp(c){
  const {esc}=c;
  $('#content').innerHTML=`<section class="card connection-card"><h2>在手机上开始使用</h2><ol class="setup-list"><li>用固定的浏览器打开本工具，首次打开进入空白的“我的门店”。</li><li>在“门店与数据”填写店名；在“商品与库存”建立商品，再录入采购与销售。</li><li>先联网打开一次，左下角显示“离线资源已就绪”后，断网也可录入及查看报表。</li><li>通过浏览器菜单添加到主屏幕。iPhone 通常可通过 Safari 分享菜单添加；不同浏览器入口略有不同。</li><li>定期在“门店与数据”导出 JSON 备份，并确认文件已保存到手机的“文件”或“下载”中。</li></ol><div class="action-row"><a class="button primary" href="#settings">门店与数据</a><a class="button subtle" href="#products">建立商品档案</a></div></section><section class="card connection-card"><h2>本地数据与恢复</h2><p>当前地址：<span class="site-address">${esc(location.origin+new URL('./',import.meta.url).pathname)}</span></p><p>记录仅保存在当前设备、浏览器和应用地址下。安装入口、普通浏览器窗口是否共享记录，需以实际设备行为为准；请在准备使用的入口建立门店。</p><p>换手机或换浏览器时，先导出备份，再在新设备选择相同数据模式恢复。网页升级保留已保存记录；清理浏览器会删除本地记录。</p><p>本地经营问答可查询账本。未勾选使用模型时不发送经营汇总；启用模型需在线并单独确认发送范围。</p></section><section class="card connection-card"><h2>适用范围</h2><p>当前为整数计件商品、单门店本地试用版。退款、批次临期和完整会计账尚未覆盖；先选择少量适合的商品试用，并用原有账本核对。</p><p>本地网页不提供自动云同步或跨设备找回。网页发布平台会接收正常网页访问请求，经营账本不会自动上传；主动使用 AI 时，本次问题与裁剪后的经营汇总会经后端发送给智谱。</p></section>`;
}
