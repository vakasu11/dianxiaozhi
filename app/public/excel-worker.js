/* SheetJS 0.20.3 is vendored locally; workbook contents are never uploaded. */
importScripts('lib/xlsx.full.min.js');
function checkZip(bytes){
  const v=new DataView(bytes);if(v.byteLength<22||v.getUint32(0,true)!==0x04034b50)throw Error('请选择未加密的 .xlsx 文件');
  let pos=-1;for(let i=v.byteLength-22;i>=Math.max(0,v.byteLength-65557);i--)if(v.getUint32(i,true)===0x06054b50){pos=i;break;}
  if(pos<0)throw Error('Excel 压缩包不完整');const count=v.getUint16(pos+10,true),offset=v.getUint32(pos+16,true);if(count>2000||offset>=pos)throw Error('Excel 文件结构过大');
  let p=offset,total=0;for(let i=0;i<count;i++){if(p+46>pos||v.getUint32(p,true)!==0x02014b50)throw Error('Excel 压缩目录无效');total+=v.getUint32(p+24,true);if(total>32*1024*1024)throw Error('Excel 解压数据超过 32 MB，请使用精简模板');p+=46+v.getUint16(p+28,true)+v.getUint16(p+30,true)+v.getUint16(p+32,true);}
}
self.onmessage=e=>{try{
  const {buffer,sheetIndex=0}=e.data;if(buffer.byteLength>5*1024*1024)throw Error('文件不能超过 5 MB');checkZip(buffer);
  const book=XLSX.read(buffer,{type:'array',cellFormula:true,cellNF:true,bookVBA:false,sheetRows:1002});
  if(!Number.isInteger(sheetIndex)||sheetIndex<0||sheetIndex>=book.SheetNames.length)throw Error('工作表不存在');
  const sheet=book.Sheets[book.SheetNames[sheetIndex]],range=XLSX.utils.decode_range(sheet['!fullref']||sheet['!ref']||'A1');
  if(range.e.r>1000||range.e.c>39)throw Error('每次最多导入 1000 行、40 列，请先精简工作表');
  for(const [key,cell] of Object.entries(sheet)){if(key.startsWith('!'))continue;if(cell.f)throw Error(`单元格 ${key} 含公式，请先在 Excel 中粘贴为值`);if(cell.t==='n'&&cell.z&&XLSX.SSF.is_date(cell.z)){cell.v=XLSX.SSF.format('yyyy-mm-dd',cell.v,{date1904:!!book.Workbook?.WBProps?.date1904});cell.t='s';delete cell.w;delete cell.z;}}
  for(const [key,cell] of Object.entries(sheet)){if(!key.startsWith('!')&&cell.t==='n'&&/^0{2,}$/.test(cell.z||'')){cell.v=XLSX.SSF.format(cell.z,cell.v);cell.t='s';delete cell.w;delete cell.z;}}
  const table=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true,blankrows:true});if(table.length<2)throw Error('工作表需要表头和数据行');
  self.postMessage({ok:true,sheets:book.SheetNames,table:table.map(row=>row.map(v=>String(v??'')))});
}catch(error){self.postMessage({ok:false,error:error.message||'Excel 解析失败'});}};
