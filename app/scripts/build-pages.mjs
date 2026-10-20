import {cp,mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,relative,extname,join} from 'node:path';
import {createHash} from 'node:crypto';
const appRoot=fileURLToPath(new URL('../',import.meta.url)),source=join(appRoot,'public');
export async function buildPages(destination){
  const target=resolve(destination);if(target===source||relative(source,target).startsWith('..')===false)throw Error('输出位置不能在 public 目录中');
  await mkdir(target,{recursive:true});if((await readdir(target)).length)throw Error('输出目录必须为空，请指定新的目录');
  const inventory=[];
  async function copy(directory,parts=[]){for(const entry of await readdir(directory,{withFileTypes:true})){const names=[...parts,entry.name],rel=names.join('/'),path=join(directory,entry.name);if(entry.isDirectory()){if(entry.name.startsWith('.'))throw Error('不发布隐藏目录');await mkdir(join(target,...names));await copy(path,names);}else{if(!['.html','.css','.mjs','.js','.svg','.png','.webmanifest','.txt'].includes(extname(entry.name))&&entry.name!=='.nojekyll')throw Error('未允许发布的文件类型：'+rel);const content=await readFile(path);if(!['.png'].includes(extname(entry.name))&&/\b[a-f0-9]{32}\.[A-Za-z0-9_-]{16,}\b/.test(content.toString()))throw Error('疑似密钥，已阻止发布：'+rel);await cp(path,join(target,...names));inventory.push({path:rel,size:content.length,sha256:createHash('sha256').update(content).digest('hex')});}}}
  await copy(source);await writeFile(join(target,'.nojekyll'),'');
  return {target,files:inventory};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const destination=process.argv[2]||join(appRoot,'../output','pages-'+new Date().toISOString().replace(/[:.]/g,'-'));
  const built=await buildPages(destination);console.log(JSON.stringify({directory:built.target,fileCount:built.files.length}));
}
