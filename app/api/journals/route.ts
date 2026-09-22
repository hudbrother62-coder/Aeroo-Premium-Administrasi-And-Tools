import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export async function GET(req:NextRequest){
  const s=await db();
  const kind=req.nextUrl.searchParams.get('kind');
  const classId=req.nextUrl.searchParams.get('class_id');
  const memberId=req.nextUrl.searchParams.get('member_id');

  let q=s.from('journals')
    .select('*,activity_types(id,name,audience),attendance_events(id,title,event_date),classes(id,name),members(id,name),journal_progress(id,member_id,target_id,progress_value,progress_note,follow_up,learning_targets(title))')
    .order('journal_date',{ascending:false});
  if(kind)q=q.eq('journal_kind',kind);
  if(classId)q=q.eq('class_id',classId);
  if(memberId)q=q.eq('member_id',memberId);

  const{data,error}=await q;
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data??[]);
}

export async function POST(req:NextRequest){
  const s=await db();
  const body=await req.json();
  const progress=body.progress;
  delete body.progress;

  const{data,error}=await s.from('journals').insert({
    ...body,
    activity_type_id:body.activity_type_id||null,
    event_id:body.event_id||null,
    class_id:body.class_id||null,
    member_id:body.member_id||null,
    started_at:body.started_at||null,
    ended_at:body.ended_at||null
  }).select().single();
  if(error)return NextResponse.json({error:error.message},{status:400});

  if(progress?.member_id&&progress?.progress_note){
    const{error:pError}=await s.from('journal_progress').insert({
      journal_id:data.id,
      member_id:progress.member_id,
      target_id:progress.target_id||null,
      progress_value:progress.progress_value===null||progress.progress_value===''?null:Number(progress.progress_value),
      progress_note:progress.progress_note,
      assessment:progress.assessment??{},
      follow_up:progress.follow_up||null
    });
    if(pError){
      await s.from('journals').delete().eq('id',data.id);
      return NextResponse.json({error:pError.message},{status:400});
    }
  }
  return NextResponse.json(data,{status:201});
}
