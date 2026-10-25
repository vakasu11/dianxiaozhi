import {randomBytes} from 'node:crypto';
import {inviteHash} from '../cloud-security.mjs';
const count=Number(process.argv[2]||5);
if(!Number.isSafeInteger(count)||count<1||count>20)throw Error('请输入 1 至 20 个邀请码');
const codes=Array.from({length:count},()=>randomBytes(18).toString('base64url'));
console.log('仅在本机私下保存以下内容。原始邀请码分别发给试用者，哈希与会话密钥填云函数环境变量，不要上传 GitHub。');
console.log(JSON.stringify({codes,INVITE_HASHES:codes.map(inviteHash).join(','),SESSION_SECRET:randomBytes(32).toString('hex'),DEMO_END_AT:new Date(Date.now()+28*86400000).toISOString()},null,2));
