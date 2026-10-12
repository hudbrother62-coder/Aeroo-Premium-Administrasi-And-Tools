import 'server-only';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
export const DEFAULT_GROQ_MODEL='openai/gpt-oss-20b';
export const GROQ_MODELS=[
  {id:'openai/gpt-oss-20b',label:'GPT-OSS 20B (cepat, rekomendasi)'},
  {id:'openai/gpt-oss-120b',label:'GPT-OSS 120B (analisis lebih mendalam)'}
] as const;
export function validModel(input:string){return GROQ_MODELS.some(m=>m.id===input);}
function masterKey(){
  const secret=process.env.SIMPUL_AI_CREDENTIAL_KEY;
  if(!secret||!/^[a-f0-9]{64}$/i.test(secret))throw Error('Kunci penyimpanan AI server belum dikonfigurasi.');
  return Buffer.from(secret,'hex');
}
export function sealSecret(plain:string){
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',masterKey(),iv);
  const encrypted=Buffer.concat([cipher.update(plain,'utf8'),cipher.final()]);
  return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');
}
export function unsealSecret(ciphertext:string){
  const [version,iv,tag,payload]=ciphertext.split('.');
  if(version!=='v1'||!iv||!tag||!payload)throw Error('Format kredensial AI tidak valid.');
  const decipher=createDecipheriv('aes-256-gcm',masterKey(),Buffer.from(iv,'base64url'));
  decipher.setAuthTag(Buffer.from(tag,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(payload,'base64url')),decipher.final()]).toString('utf8');
}
export type StoredGroq={ciphertext?:string;model?:string;updated_at?:string;enabled?:boolean};
export async function readGroq(s:any):Promise<StoredGroq>{
  const {data,error}=await s.from('app_settings').select('value').eq('key','groq_provider').maybeSingle();
  if(error)throw Error('Pengaturan Groq tidak dapat dibaca: '+error.message);
  return data?.value||{};
}
export function publicGroqState(item:StoredGroq){
  return {configured:Boolean(item.ciphertext),enabled:item.enabled!==false,model:validModel(item.model||'')?item.model:DEFAULT_GROQ_MODEL,updated_at:item.updated_at||null};
}
export async function groqCompletion(apiKey:string,model:string,messages:Array<{role:'system'|'user';content:string}>){
  const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+apiKey},
    body:JSON.stringify({model,messages,temperature:0,response_format:{type:'json_object'},max_completion_tokens:1800}),
    cache:'no-store',signal:AbortSignal.timeout(27000)
  });
  if(!response.ok){
    if(response.status===401||response.status===403)throw Error('API key Groq tidak valid atau belum diberi akses.');
    if(response.status===429)throw Error('Batas penggunaan Groq tercapai. Coba lagi nanti.');
    throw Error('Groq gagal merespons (HTTP '+response.status+').');
  }
  const data=await response.json();
  const raw=String(data?.choices?.[0]?.message?.content||'');
  if(!raw||raw.length>50000)throw Error('Respons Groq kosong atau tidak valid.');
  try{return JSON.parse(raw)}
  catch{throw Error('Groq belum menghasilkan JSON yang bisa dibaca. Ulangi analisis.')}
}
