import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export async function GET(req:NextRequest){
  const versionId=req.nextUrl.searchParams.get('version_id')||'';
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(versionId))return NextResponse.json({error:'Versi tidak valid.'},{status:400});
  const s=await db();
  const {data,error}=await s.from('target_versions').select('id,source_structure').eq('id',versionId).maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:400});
  if(!data)return NextResponse.json({error:'Versi tidak ditemukan.'},{status:404});
  const groups=data.source_structure?.source_group_rows||{};
  return NextResponse.json({version_id:data.id,group_rows:groups});
}
