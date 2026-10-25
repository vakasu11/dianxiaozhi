import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
export const inviteHash=code=>createHash('sha256').update(code).digest('hex');
const safeEqual=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function accessControl(config,now=()=>Date.now()){
  const cloud=config.APP_MODE==='cloudbase',hashes=String(config.INVITE_HASHES||'').split(',').map(s=>s.trim()).filter(Boolean),required=cloud||hashes.length>0;
  const secret=config.SESSION_SECRET||'',end=Date.parse(config.DEMO_END_AT||''),origin=cloud?new URL(config.PUBLIC_ORIGIN||'https://invalid.local').origin:null;
  if(cloud){const u=new URL(config.PUBLIC_ORIGIN||origin);if(!config.PUBLIC_ORIGIN||origin==='https://invalid.local'||u.protocol!=='https:'||u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw Error('PUBLIC_ORIGIN 必须填写测试域名的 HTTPS 根地址');}
  if(required&&(!hashes.length||hashes.some(h=>!/^[a-f0-9]{64}$/.test(h))||secret.length<32||!Number.isFinite(end)||end>now()+31*86400000))throw Error('邀请码配置无效：需要 SHA256 哈希、32 位以上 SESSION_SECRET 和 31 天以内 DEMO_END_AT');
  const cookieName=cloud?'__Host-dxz_session':'dxz_session';
  const sign=s=>createHmac('sha256',secret).update(s).digest('base64url');
  const cookie=(token,age)=>`${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${cloud?'; Secure':''}`;
  const expired=()=>required&&now()>=end;
  const authenticate=req=>{
    if(!required)return 'local';if(expired())return null;
    try{const token=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
      const [body,mac,...extra]=token.split('.');if(extra.length||!safeEqual(sign(body),mac))return null;
      const value=JSON.parse(Buffer.from(body,'base64url'));return hashes.includes(value.sub)&&Number.isSafeInteger(value.exp)&&value.exp>now()&&value.exp<=end?value.sub:null;
    }catch{return null;}
  };
  function login(code){
    if(expired())return null;const h=inviteHash(code);if(!hashes.some(x=>safeEqual(x,h)))return null;
    const age=Math.floor(Math.min(8*3600000,end-now())/1000);if(age<=0)return null;
    const body=Buffer.from(JSON.stringify({sub:h,exp:now()+age*1000})).toString('base64url');return cookie(body+'.'+sign(body),age);
  }
  // Single-process guard only. Cloud restarts/scale-out reset counters; not a billing cap.
  const buckets=new Map();
  function limit(id,max,windowMs){const time=now(),b=buckets.get(id);if(!b||time>=b.until){buckets.set(id,{count:1,until:time+windowMs});return true;}if(b.count>=max)return false;b.count++;return true;}
  return{cloud,required,origin,expired,authenticate,login,logout:()=>cookie('',0),endsAt:required?new Date(end).toISOString():null,limit};
}
