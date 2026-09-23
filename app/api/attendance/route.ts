import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {canWriteAudience} from '@/lib/access';

export async function GET(req:NextRequest){
  const s=await db();
  const from=req.nextUrl.searchParams.get('from');
  const to=req.nextUrl.searchParams.get('to');
  const audience=req.nextUrl.searchParams.get('audience');
  const classId=req.nextUrl.searchParams.get('class_id');

  let q=s.from('attendance_events')
    .select('*,classes(id,name),levels(id,name),activity_types(id,name),attendance_records(id,status,member_id)')
    .order('event_date',{ascending:false});
  if(from)q=q.gte('event_date',from);
  if(to)q=q.lte('event_date',to);
  if(audience)q=q.eq('audience',audience);
  if(classId)q=q.eq('class_id',classId);

  const{data,error}=await q;
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data??[]);
}

export async function POST(req:NextRequest){
  const s=await db();
  const{records,...event}=await req.json();
  const{data:role}=await s.rpc('current_app_role');

  if(!canWriteAudience(role,String(event.audience??''))){
    return NextResponse.json({error:'Jenis presensi ini di luar akses akun.'},{status:403});
  }

  const{data,error}=await s.from('attendance_events').insert({
    ...event,
    class_id:event.class_id||null,
    level_id:event.level_id||null,
    activity_type_id:event.activity_type_id||null
  }).select().single();
  if(error)return NextResponse.json({error:error.message},{status:400});

  if(records?.length){
    const{error:recordError}=await s.from('attendance_records').insert(
      records.map((r:Record<string,unknown>)=>({...r,event_id:data.id}))
    );
    if(recordError){
      await s.from('attendance_events').delete().eq('id',data.id);
      return NextResponse.json({error:recordError.message},{status:400});
    }
  }
  return NextResponse.json(data,{status:201});
}
