import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {publicProjection} from '@/lib/public-read';

export async function GET(req:NextRequest){
  // Calendar history uses a narrow, permission-checked database aggregate.
  // It must run before the general public projection, which reads every historical row.
  if(req.nextUrl.searchParams.get('history')==='1'){
    const params=req.nextUrl.searchParams;
    const from=params.get('from')||'',to=params.get('to')||'';
    const classId=params.get('class_id')||null;
    if(!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(from)
      ||!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(to)
      ||from.slice(0,7)!==to.slice(0,7)||from>to
      ||(classId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId)))
      return NextResponse.json({error:'Rentang tanggal atau kelas tidak valid.'},{status:400});
    try{
      const s=await db();
      const {data,error}=await s.rpc('simpul_attendance_history_month',{
        p_month:from.slice(0,7),p_audience:params.get('audience')||null,p_class_id:classId
      });
      if(error)return NextResponse.json({error:error.message},{status:400});
      const rows=Array.isArray(data)?data.filter((event:{event_date:string})=>event.event_date>=from&&event.event_date<=to):[];
      return NextResponse.json(rows,{headers:{'Cache-Control':'private, no-store'}});
    }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Riwayat tidak dapat dimuat.'},{status:500});}
  }
  const publicResult=await publicProjection(req,'attendance');if(publicResult)return publicResult;
  const s=await db();
  const from=req.nextUrl.searchParams.get('from');
  const to=req.nextUrl.searchParams.get('to');
  const audience=req.nextUrl.searchParams.get('audience');
  const classId=req.nextUrl.searchParams.get('class_id');
  const historyOnly=req.nextUrl.searchParams.get('history')==='1';

  let q=s.from('attendance_events')
    .select('*,classes(id,name),levels(id,name),activity_types(id,name),attendance_records(id,status,member_id,class_id_snapshot,level_id_snapshot)')
    .order('event_date',{ascending:false});
  if(from)q=q.gte('event_date',from);
  if(to)q=q.lte('event_date',to);
  if(audience)q=q.eq('audience',audience);


  const{data,error}=await q;
  if(error)return NextResponse.json({error:error.message},{status:400});
  const rows=(data??[]).map(event=>classId?{...event,attendance_records:(event.attendance_records??[]).filter((record:{class_id_snapshot:string|null})=>record.class_id_snapshot===classId||(!record.class_id_snapshot&&event.class_id===classId))}:event)
    .filter(event=>!classId||event.class_id===classId||(event.attendance_records??[]).length>0)
    .filter(event=>!historyOnly||(event.state!=='CANCELLED'&&(event.attendance_records??[]).some((record:{status:string|null})=>['H','I','A'].includes(record.status||''))));
  return NextResponse.json(rows);
}

// A historical Caberawit session can already be filled under a legacy session key.
// Reopen that source-of-truth record rather than creating a second marked session.
async function existingRecordedCaberawit(s:Awaited<ReturnType<typeof db>>,event:Record<string,unknown>){
  if(event.agenda_id||event.audience!=='CABERAWIT'
    ||typeof event.class_id!=='string'||typeof event.activity_type_id!=='string'
    ||typeof event.event_date!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(event.event_date)
    ||!/^[0-9a-f-]{36}$/i.test(event.class_id)
    ||!/^[0-9a-f-]{36}$/i.test(event.activity_type_id))return null;

  const [{data:scope,error:scopeError},{data:permission,error:permissionError}]=await Promise.all([
    s.rpc('can_write_scoped_audience',{p_audience:'CABERAWIT',p_class_id:event.class_id}),
    s.rpc('has_app_permission',{p_permission:'attendance.write'})
  ]);
  if(scopeError||permissionError||!scope||!permission)return null;
  const {data:rows,error}=await s.from('attendance_events')
    .select('id,attendance_records(status)')
    .eq('audience','CABERAWIT')
    .eq('class_id',event.class_id)
    .eq('activity_type_id',event.activity_type_id)
    .eq('event_date',event.event_date)
    .is('agenda_id',null)
    .neq('state','CANCELLED')
    .limit(40);
  if(error)throw new Error('Gagal memeriksa riwayat presensi. Coba lagi.');
  const prior=(rows||[]).find((row:any)=>
    (row.attendance_records||[]).some((r:any)=>['H','I','A'].includes(r.status))
  );
  if(!prior)return null;
  const {data:canEdit,error:editError}=await s.rpc('can_write_event',{p_event_id:prior.id});
  if(editError||!canEdit)return null;
  return prior.id as string;
}

export async function POST(req:NextRequest){
  try{
    const s=await db();
    const event=await req.json();
    if(event.records)return NextResponse.json({error:'Gunakan penyimpanan per peserta.'},{status:400});
    if(!event.agenda_id&&(!event.activity_type_id||!['KELOMPOK','CABERAWIT','IBU_IBU','MUDA_MUDI','PENGURUS'].includes(event.audience)))
      return NextResponse.json({error:'Kegiatan rutin wajib memilih jenis kegiatan; untuk acara lainnya pilih agenda.'},{status:400});
    const existingId=await existingRecordedCaberawit(s,event);
    if(existingId)return NextResponse.json({id:existingId,existing:true},{status:200});
    const {data,error}=await s.rpc('ensure_attendance',{p_event:event});
    return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data,{status:201});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Gagal membuka presensi.'},{status:400});
  }
}
