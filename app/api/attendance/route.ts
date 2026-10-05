import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {publicProjection} from '@/lib/public-read';

export async function GET(req:NextRequest){
  const publicResult=await publicProjection(req,'attendance');if(publicResult)return publicResult;
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
 try{const s=await db();const event=await req.json();if(event.records)return NextResponse.json({error:'Gunakan penyimpanan per peserta.'},{status:400});const {data,error}=await s.rpc('ensure_attendance',{p_event:event});return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data,{status:201});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal membuka presensi.'},{status:400})}
}
