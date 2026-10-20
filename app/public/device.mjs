// GitHub Pages projects share an origin. Scope records to this application's path.
export function scopedStorage(storage,path='/'){
  const prefix=path==='/'?'':`dianxiaozhi:${path}:`;
  return {key:k=>prefix+k,getItem:k=>storage.getItem(prefix+k),setItem:(k,v)=>storage.setItem(prefix+k,v)};
}
export async function storageStatus(manager=globalThis.navigator?.storage){
  if(!manager)return {supported:false,persisted:false,usage:null,quota:null};
  const [persisted,estimate]=await Promise.all([manager.persisted?.().catch(()=>false)??false,manager.estimate?.().catch(()=>({}))??{}]);
  return {supported:typeof manager.persist==='function',persisted:Boolean(persisted),usage:estimate.usage??null,quota:estimate.quota??null};
}
export async function requestPersistence(manager=globalThis.navigator?.storage){
  if(!manager?.persist)return false;try{return await manager.persist();}catch{return false;}
}
