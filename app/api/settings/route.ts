import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export async function GET(){
  const s=await db();
  const{data,error}=await s.from('app_settings').select('key,value');
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json(Object.fromEntries((data??[]).map(x=>[x.key,x.value])));
}

export async function PATCH(req:NextRequest){
  const s=await db();
  const body=await req.json();
  const rows=Object.entries(body).map(([key,value])=>({key,value,updated_at:new Date().toISOString()}));
  const{error}=await s.from('app_settings').upsert(rows,{onConflict:'key'});
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json({ok:true});
}
