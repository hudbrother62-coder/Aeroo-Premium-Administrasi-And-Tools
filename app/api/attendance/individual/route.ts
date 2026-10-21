
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {monthsEnding} from '@/lib/attendance-trends';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const audiences=new Set(['KELOMPOK','CABERAWIT','MUDA_MUDI','IBU_IBU','PENGURUS']);
export async function GET(req:NextRequest){
 try{
  const q=req.nextUrl.searchParams;
  const person=q.get('person_id')||'',month=q.get('month')||'',span=Number(q.get('span')||1);
  const audience=q.get('audience')||'',classId=q.get('class_id')||'',levelId=q.get('level_id')||'';
  if(!uuid.test(person)||![1,3,6].includes(span)||!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month)
    ||(audience&&!audiences.has(audience))||(classId&&!uuid.test(classId))||(levelId&&!uuid.test(levelId)))
    return NextResponse.json({error:'Filter individu tidak valid.'},{status:400});
  const months=monthsEnding(month,span as 1|3|6);
  const first=months[0]+'-01',last=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
  const s=await db();
  const [{data:role,error:roleError},{data:permission,error:permissionError}]=await Promise.all([
   s.rpc('current_app_role'),s.rpc('has_app_permission',{p_permission:'attendance.read'})
  ]);
  // Keterangan izin adalah catatan internal; viewer hanya menerima agregat, bukan catatan pribadi.
  if(roleError||permissionError||!role||role==='VIEWER'||!permission)return NextResponse.json({reasons:[]});
  let query=s.from('attendance_records')
   .select('id,status,notes,class_id_snapshot,level_id_snapshot,attendance_events!inner(id,title,event_date,audience,class_id,level_id,state)')
   .or(`participant_key.eq.${person},member_id.eq.${person}`)
   .eq('status','I')
   .gte('attendance_events.event_date',first)
   .lte('attendance_events.event_date',last)
   .neq('attendance_events.state','CANCELLED')
   .order('created_at',{ascending:false}).limit(500);
  const {data,error}=await query;
  if(error)return NextResponse.json({error:'Keterangan izin gagal dimuat.'},{status:400});
  const candidates=(data||[]).flatMap((record:any)=>{
   const event=Array.isArray(record.attendance_events)?record.attendance_events[0]:record.attendance_events;
   if(!event||!record.notes?.trim())return [];
   if(audience&&event.audience!==audience)return [];
   if(classId&&record.class_id_snapshot!==classId&&!(record.class_id_snapshot==null&&event.class_id===classId))return [];
   if(levelId&&record.level_id_snapshot!==levelId&&!(record.level_id_snapshot==null&&event.level_id===levelId))return [];
   return [{id:record.id,date:event.event_date,title:event.title,reason:record.notes.trim(),audience:event.audience,class_id:event.class_id}];
  });
  const allowed=new Map<string,boolean>();
  for(const row of candidates){
   const key=row.audience+':'+(row.class_id||'');
   if(!allowed.has(key)){
    const {data:can,error:scopeError}=await s.rpc('can_read_scoped_audience',{p_audience:row.audience,p_class_id:row.class_id||null});
    allowed.set(key,!scopeError&&can===true);
   }
  }
  const reasons=candidates.filter(row=>allowed.get(row.audience+':'+(row.class_id||'')))
   .map(({id,date,title,reason})=>({id,date,title,reason})).sort((a,b)=>b.date.localeCompare(a.date));
  return NextResponse.json({reasons},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Riwayat individu tidak tersedia.'},{status:400})}
}
