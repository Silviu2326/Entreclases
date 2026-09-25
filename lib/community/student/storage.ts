"use client";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
const PREFIX = "entreclases:student";
export function storageKey(scope:{demo:boolean;userId:string},tool:string){return `${PREFIX}:${scope.demo?"demo":"real"}:${scope.userId}:${tool}`;}
export function readStore<T>(key:string,fallback:T):T {try{return JSON.parse(window.localStorage.getItem(key)??"null")??fallback;}catch{return fallback;}}
export function writeStore<T>(key:string,value:T){try{window.localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
export type SyncStatus = "loading" | "local" | "saving" | "synced" | "error" | "conflict" | "full";
type Snapshot = {value:unknown;ready:boolean;status:SyncStatus};
type Entry = {snapshot:Snapshot;listeners:Set<()=>void>;loaded:boolean;busy:boolean;dirty:boolean;revision:number;generation:number;timer?:ReturnType<typeof setTimeout>};
const stores=new Map<string,Entry>();
function entry(key:string,initial:unknown){let e=stores.get(key);if(!e){e={snapshot:{value:initial,ready:false,status:"loading"},listeners:new Set(),loaded:false,busy:false,dirty:false,revision:0,generation:0};stores.set(key,e);}return e;}
function publish(e:Entry,patch:Partial<Snapshot>){e.snapshot={...e.snapshot,...patch};e.listeners.forEach(fn=>fn());}
const scope=(key:string)=>/^entreclases:student:real:([^:]+):([^:]+)$/.exec(key);
function persist(key:string,e:Entry){const ok=writeStore(key,e.snapshot.value)&&writeStore(key+":sync",{revision:e.revision,dirty:e.dirty});if(!ok)publish(e,{status:"full"});return ok;}
async function clientFor(key:string){const m=scope(key);if(!m)return null;const {getAuthClient}=await import("../../auth/client");const client=getAuthClient();const {data}=await client.auth.getSession();if(data.session?.user.id!==m[1])throw new Error("ACCOUNT_CHANGED");return {client,userId:m[1],tool:m[2]};}
async function save(key:string,e:Entry){
 if(e.busy||!e.dirty||!scope(key)||e.snapshot.status==="conflict")return;
 e.busy=true;const generation=e.generation;const value=e.snapshot.value;publish(e,{status:"saving"});
 try{const context=await clientFor(key);if(!context)return;const {data,error}=await context.client.rpc("universe_student_save",{p_tool:context.tool,p_value:value,p_revision:e.revision});if(error)throw error;
  e.revision=Number(data);e.dirty=e.generation!==generation;publish(e,{status:e.dirty?"saving":"synced"});persist(key,e);
 }catch(error){const message=error&&typeof error==="object"&&"message" in error?String(error.message):"";publish(e,{status:message.includes("STUDENT_CONFLICT")?"conflict":"error"});}
 finally{e.busy=false;if(e.dirty&&e.snapshot.status==="saving")void save(key,e);}
}
async function load(key:string,e:Entry){
 if(e.busy)return;e.busy=true;e.loaded=true;
 const local=readStore(key,e.snapshot.value);const meta=readStore(key+":sync",{revision:0,dirty:false});e.revision=meta.revision;e.dirty=meta.dirty;
 publish(e,{value:local,status:scope(key)?"loading":"local",ready:!scope(key)});
 if(!scope(key)){e.busy=false;return;}
 try{const context=await clientFor(key);if(!context)return;
  const {data,error}=await context.client.from("universe_student_state").select("value,revision").eq("user_id",context.userId).eq("tool",context.tool).maybeSingle();if(error)throw error;
  if(data){if(e.dirty&&data.revision!==e.revision){publish(e,{status:"conflict",ready:true});return;}if(!e.dirty)publish(e,{value:data.value});e.revision=data.revision;publish(e,{status:e.dirty?"saving":"synced",ready:true});}
  else{e.revision=0;e.dirty=true;publish(e,{ready:true,status:"saving"});}persist(key,e);
 }catch{publish(e,{ready:true,status:"error"});}finally{e.busy=false;if(e.dirty&&e.snapshot.status==="saving")void save(key,e);}
}
export function currentStoreValue(key:string){return stores.get(key)?.snapshot.value??readStore(key,{});}
export function retryStore(key:string){const e=stores.get(key);if(e)void load(key,e);}
export function acceptCloudStore(key:string){const e=stores.get(key);if(!e||e.busy)return;e.dirty=false;writeStore(key+":sync",{revision:e.revision,dirty:false});void load(key,e);}
export function useToolStore<T>(key:string,initial:T):[T,(next:T|((current:T)=>T))=>void,boolean,SyncStatus]{
 const fallback=useRef<Snapshot>({value:initial,ready:false,status:"loading"});
 const subscribe=useCallback((fn:()=>void)=>{const e=entry(key,fallback.current.value);e.listeners.add(fn);return()=>{e.listeners.delete(fn);};},[key]);
 const getSnapshot=useCallback(()=>entry(key,fallback.current.value).snapshot,[key]);
 const snapshot=useSyncExternalStore(subscribe,getSnapshot,()=>fallback.current);
 useEffect(()=>{const e=entry(key,fallback.current.value);if(!e.loaded)void load(key,e);
  const online=()=>{if(e.snapshot.status==="error")void load(key,e);};
  const changed=(event:StorageEvent)=>{if(event.key===key&&!e.dirty&&!e.busy)void load(key,e);};
  window.addEventListener("online",online);window.addEventListener("storage",changed);return()=>{window.removeEventListener("online",online);window.removeEventListener("storage",changed);};
 },[key]);
 const update=useCallback((next:T|((current:T)=>T))=>{const e=entry(key,fallback.current.value);if(!e.snapshot.ready)return;e.generation++;e.dirty=!!scope(key);
  publish(e,{value:typeof next==="function"?(next as (v:T)=>T)(e.snapshot.value as T):next,status:scope(key)?(e.snapshot.status==="conflict"?"conflict":"saving"):"local"});persist(key,e);
  if(scope(key)){clearTimeout(e.timer);e.timer=setTimeout(()=>void save(key,e),450);}
 },[key]);
 return [snapshot.value as T,update,snapshot.ready,snapshot.status];
}
export const newId=()=>typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():Math.random().toString(36).slice(2);

export function useStoreStatus(key:string):SyncStatus {
 const subscribe=useCallback((fn:()=>void)=>{const e=stores.get(key);e?.listeners.add(fn);return()=>{e?.listeners.delete(fn);};},[key]);
 return useSyncExternalStore(subscribe,()=>stores.get(key)?.snapshot.status??"loading",()=>"loading");
}
