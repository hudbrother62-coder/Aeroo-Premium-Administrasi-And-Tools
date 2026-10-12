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
    .select('*,classes(id,name),levels(id,name),activity_types(id,name),attendance_records(id,status,member_id,class_id_snapshot,level_id_snapshot)')
    .order('event_date',{ascending:false});
  if(from)q=q.gte('event_date',from);
  if(to)q=q.lte('event_date',to);
  if(audience)q=q.eq('audience',audience);


  const{data,error}=await q;
  if(error)return NextResponse.json({error:error.message},{status:400});
  const rows=(data??[]).map(event=>classId?{...event,attendance_records:(event.attendance_records??[]).filter((record:{class_id_snapshot:string|null})=>record.class_id_snapshot===classId||(!record.class_id_snapshot&&event.class_id===classId))}:event)
    .filter(event=>!classId||event.class_id===classId||(event.attendance_records??[]).length>0);
  return NextResponse.json(rows);
}

export async function POST(req:NextRequest){
 try{const s=await db();const event=await req.json();if(event.records)return NextResponse.json({error:'Gunakan penyimpanan per peserta.'},{status:400});if(!event.agenda_id&&!['KELOMPOK','CABERAWIT'].includes(event.audience))return NextResponse.json({error:'Kategori ini memerlukan agenda sebelum presensi.'},{status:400});const {data,error}=await s.rpc('ensure_attendance',{p_event:event});return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data,{status:201});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal membuka presensi.'},{status:400})}
}
