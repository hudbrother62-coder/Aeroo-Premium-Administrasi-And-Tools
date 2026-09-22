import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export async function GET(req:NextRequest){
  const s=await db();
  const audience=req.nextUrl.searchParams.get('audience');
  let q=s.from('classes').select('*,levels(id,name)').eq('active',true).order('sort_order').order('name');
  if(audience)q=q.eq('audience',audience);
  const{data,error}=await q;
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data??[]);
}

export async function POST(req:NextRequest){
  const s=await db();
  const b=await req.json();
  const{data,error}=await s.from('classes').insert({
    name:String(b.name??'').trim(),
    audience:b.audience,
    level_id:b.level_id||null,
    description:b.description||null
  }).select('*,levels(id,name)').single();
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data,{status:201});
}
