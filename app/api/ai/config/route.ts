import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {DEFAULT_GROQ_MODEL,GROQ_MODELS,publicGroqState,readGroq,sealSecret,unsealSecret,validModel} from '@/lib/groq-admin';
export const runtime='nodejs';
const noStore={'Cache-Control':'private, no-store'};

async function adminDb(){
  const s=await db();
  const {data:role,error}=await s.rpc('current_app_role');
  if(error||role!=='ADMIN')return null;
  return s;
}
export async function GET(){
  const s=await adminDb();
  if(!s)return NextResponse.json({error:'Hanya admin utama yang dapat mengatur Groq.'},{status:403,headers:noStore});
  try{return NextResponse.json({...publicGroqState(await readGroq(s)),models:GROQ_MODELS},{headers:noStore})}
  catch(e){return NextResponse.json({error:(e as Error).message},{status:500,headers:noStore})}
}
export async function PATCH(req:NextRequest){
  const s=await adminDb();
  if(!s)return NextResponse.json({error:'Hanya admin utama yang dapat mengubah AI.'},{status:403,headers:noStore});
  try{
    const body=await req.json();
    const previous=await readGroq(s);
    const model=String(body.model||previous.model||DEFAULT_GROQ_MODEL);
    if(!validModel(model))return NextResponse.json({error:'Model Groq tidak didukung.'},{status:400,headers:noStore});
    const key=String(body.api_key||'').trim();
    if(key&&(key.length<15||key.length>260||!key.startsWith('gsk_')))return NextResponse.json({error:'Masukkan API key Groq yang diawali gsk_.'},{status:400,headers:noStore});
    const item={model,ciphertext:key?sealSecret(key):previous.ciphertext||null,
      enabled:body.enabled!==false,updated_at:new Date().toISOString()};
    const {error}=await s.from('app_settings').upsert({key:'groq_provider',value:item,updated_at:item.updated_at},{onConflict:'key'});
    if(error)throw Error(error.message);
    return NextResponse.json({...publicGroqState(item),models:GROQ_MODELS},{headers:noStore});
  }catch(e){return NextResponse.json({error:(e as Error).message},{status:400,headers:noStore})}
}
export async function POST(){
  const s=await adminDb();
  if(!s)return NextResponse.json({error:'Hanya admin utama yang dapat menguji AI.'},{status:403,headers:noStore});
  try{
    const item=await readGroq(s);
    if(!item.ciphertext)return NextResponse.json({error:'API key Groq belum disimpan.'},{status:400,headers:noStore});
    const response=await fetch('https://api.groq.com/openai/v1/models',{headers:{Authorization:'Bearer '+unsealSecret(item.ciphertext)},cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!response.ok)return NextResponse.json({error:'Tes koneksi Groq gagal: HTTP '+response.status},{status:400,headers:noStore});
    return NextResponse.json({ok:true,message:'API key Groq aktif dan dapat terhubung.'},{headers:noStore});
  }catch(e){return NextResponse.json({error:(e as Error).message},{status:400,headers:noStore})}
}
