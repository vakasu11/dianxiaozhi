import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
import {buildPages} from './build-pages.mjs';
const appRoot=fileURLToPath(new URL('../',import.meta.url));
const crcTable=Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=(i&1)?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
function crc32(buffer){let crc=0xffffffff;for(const byte of buffer)crc=crcTable[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
// ZIP built with Node only; executable POSIX mode and LF bootstrap survive Windows builds.
function zip(entries){
  const local=[],central=[];let offset=0;
  for(const [name,content] of entries){
    const file=Buffer.from(name),compressed=deflateRawSync(content),crc=crc32(content),header=Buffer.alloc(30),directory=Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(0x21,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(content.length,22);header.writeUInt16LE(file.length,26);
    directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(0x314,4);header.copy(directory,6,4,30);directory.writeUInt32LE(((name==='scf_bootstrap'?0o100755:0o100644)<<16)>>>0,38);directory.writeUInt32LE(offset,42);
    local.push(header,file,compressed);central.push(directory,file);offset+=header.length+file.length+compressed.length;
  }
  const end=Buffer.alloc(22),centralBuffer=Buffer.concat(central);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centralBuffer.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,centralBuffer,end]);
}
export async function buildCloudbase(destination){
  const target=resolve(destination),built=await buildPages(target),entries=[];
  // buildPages guarantees a new/empty target; move public assets into ZIP public/ without copying local env/data.
  for(const file of built.files){const content=file.path==='deployment.mjs'?Buffer.from('export const hosted=true;\n'):await readFile(join(target,file.path));entries.push(['public/'+file.path,content]);}
  const serverFiles=['server.mjs','cloud-security.mjs','package.json'];
  for(const name of serverFiles)entries.push([name,await readFile(join(appRoot,name))]);
  entries.push(['scf_bootstrap',Buffer.from((await readFile(join(appRoot,'deploy/scf_bootstrap'),'utf8')).replaceAll('\r\n','\n'))]);
  entries.push(['cloudbase.env.example',await readFile(join(appRoot,'deploy/cloudbase.env.example'))]);
  entries.push(['DEPLOY.md',await readFile(join(appRoot,'../docs/cloudbase-deploy.md'))]);
  const manifest=entries.map(([path,data])=>({path,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}));
  entries.push(['MANIFEST.json',Buffer.from(JSON.stringify(manifest,null,2))]);
  const data=zip(entries),archive=join(target,'dianxiaozhi-cloudbase-v0.6.2.zip');await writeFile(archive,data);await writeFile(archive+'.sha256',createHash('sha256').update(data).digest('hex')+'\n');
  return{archive,fileCount:entries.length,bytes:data.length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const target=process.argv[2]||join(appRoot,'../output','cloudbase-'+new Date().toISOString().replace(/[:.]/g,'-'));
  console.log(JSON.stringify(await buildCloudbase(target)));
}
