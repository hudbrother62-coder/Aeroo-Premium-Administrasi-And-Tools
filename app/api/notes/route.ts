import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {noteInput} from '@/lib/rebuild';

export async function GET(req:NextRequest){
  const s=await db();const status=req.nextUrl.searchParams.get('status')||'ACTIVE';
  if(!['ACTIVE','ARCHIVED','DELETED'].includes(status))return NextResponse.json({error:'Status tidak valid.'},{status:400});
  const {data,error}=await s.rpc('list_context_notes',{p_status:status});
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data??[],{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:NextRequest){
  try{
    const s=await db();const input=noteInput(await req.json());
    const {data,error}=await s.rpc('save_context_note',{p_id:null,p_revision:0,p_body:input});
    return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data,{status:201});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal menyimpan.'},{status:400})}
}
