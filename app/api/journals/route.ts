import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {publicProjection} from '@/lib/public-read';

export async function GET(req:NextRequest){
  const publicResult=await publicProjection(req,'journals');if(publicResult)return publicResult;
  const s=await db();
  const kind=req.nextUrl.searchParams.get('kind');
  const classId=req.nextUrl.searchParams.get('class_id');
  const memberId=req.nextUrl.searchParams.get('member_id');

  let q=s.from('journals')
    .select('*,activity_types(id,name,audience),attendance_events(id,title,event_date),classes(id,name),members(id,name),journal_progress(id,member_id,target_id,progress_value,progress_note,assessment,follow_up,learning_targets(title))')
    .order('journal_date',{ascending:false});
  if(kind)q=q.eq('journal_kind',kind);
  if(classId)q=q.eq('class_id',classId);
  if(memberId)q=q.eq('member_id',memberId);

  const{data,error}=await q;
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data??[]);
}

export async function POST(req:NextRequest){
 try{const s=await db();const {progress,revision,...body}=await req.json();if(!Array.isArray(progress)||progress.length>500)return NextResponse.json({error:'Daftar penilaian tidak valid.'},{status:400});const {data,error}=await s.rpc('save_journal',{p_id:null,p_revision:0,p_body:body,p_progress:progress});return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data,{status:201});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal menyimpan jurnal.'},{status:400})}
}
