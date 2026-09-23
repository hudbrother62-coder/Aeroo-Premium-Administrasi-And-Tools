import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export async function GET(req:NextRequest){
  const s=await db();
  const level=req.nextUrl.searchParams.get('level_id');
  const classId=req.nextUrl.searchParams.get('class_id');
  const versionId=req.nextUrl.searchParams.get('version_id');

  let q=s.from('learning_targets')
    .select('*,levels(id,name),classes(id,name,audience),target_versions(id,title,version,period_start,period_end,published_at)')
    .eq('active',true).order('sort_order').order('title');
  if(level)q=q.eq('level_id',level);
  if(classId)q=q.eq('class_id',classId);
  if(versionId)q=q.eq('version_id',versionId);

  const{data,error}=await q;
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data??[]);
}

export async function POST(req:NextRequest){
  const s=await db();
  const b=await req.json();
  const{data,error}=await s.from('learning_targets').insert({
    level_id:b.level_id,
    class_id:b.class_id||null,
    version_id:b.version_id||null,
    code:b.code||null,
    title:String(b.title??'').trim(),
    description:b.description||null,
    target_value:b.target_value===null||b.target_value===''?null:Number(b.target_value),
    target_unit:b.target_unit||null,
    sort_order:Number(b.sort_order??0),
    active:true
  }).select().single();
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data,{status:201});
}
