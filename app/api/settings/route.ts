import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
const noStore={'Cache-Control':'private, no-store'};
export async function GET(){
  const s=await db();
  const {data,error}=await s.from('app_settings').select('key,value').in('key',['group_info','usage_manual']);
  if(error)return NextResponse.json({error:error.message},{status:400,headers:noStore});
  return NextResponse.json(Object.fromEntries((data??[]).map(x=>[x.key,x.value])),{headers:noStore});
}
export async function PATCH(req:NextRequest){
  const s=await db();
  const {data:role}=await s.rpc('current_app_role');
  if(role!=='ADMIN')return NextResponse.json({error:'Hanya admin utama yang dapat mengatur aplikasi.'},{status:403,headers:noStore});
  try{
    const body=await req.json();
    const rows=Object.entries(body).filter(([key])=>['group_info','usage_manual'].includes(key))
      .map(([key,value])=>({key,value,updated_at:new Date().toISOString()}));
    if(!rows.length)return NextResponse.json({error:'Pengaturan tidak valid.'},{status:400,headers:noStore});
    const {error}=await s.from('app_settings').upsert(rows,{onConflict:'key'});
    return error?NextResponse.json({error:error.message},{status:400,headers:noStore}):NextResponse.json({ok:true},{headers:noStore});
  }catch{return NextResponse.json({error:'Data pengaturan tidak valid.'},{status:400,headers:noStore})}
}
