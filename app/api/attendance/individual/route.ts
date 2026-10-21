import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {monthsEnding,mergeRecapMonths,type MonthlyRecap} from '@/lib/attendance-trends';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedAudiences=new Set(['KELOMPOK','CABERAWIT','MUDA_MUDI','IBU_IBU','PENGURUS']);
type Status='H'|'I'|'A'|null;
type DetailRow={id:string;event_id:string;date:string;title:string;audience:string;class_name:string;status:Status;notes:string;obligation:true};
const legacyIdentity=(audience:string,name:string)=>'legacy:'+audience+':'+name.trim().replace(/\s+/g,' ').toLowerCase();
export async function GET(req:NextRequest){
 try{
  const q=req.nextUrl.searchParams;
  const personId=q.get('person_id')||'',month=q.get('month')||'',span=Number(q.get('span')||3);
  const audience=q.get('audience')||'',classId=q.get('class_id')||'',levelId=q.get('level_id')||'';
  if((!uuid.test(personId)&&!(personId.startsWith('legacy:')&&personId.length<=240))||
     ![1,3,6].includes(span)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||
     (audience&&!allowedAudiences.has(audience))||(classId&&!uuid.test(classId))||(levelId&&!uuid.test(levelId)))
    return NextResponse.json({error:'Parameter rekap individu tidak valid.'},{status:400});
  const s=await db();
  const {data:role,error:roleErr}=await s.rpc('current_app_role');
  if(roleErr||!role||role==='VIEWER')return NextResponse.json({error:'Detail presensi memerlukan akses pengelola.'},{status:403});
  const {data:readAllowed,error:permErr}=await s.rpc('has_app_permission',{p_permission:'attendance.read'});
  if(permErr||!readAllowed)return NextResponse.json({error:'Tidak memiliki izin membaca presensi.'},{status:403});
  const months=monthsEnding(month,span as 1|3|6);
  // The existing scoped recap RPC is the source of authorized events and participants.
  const authorizedMonths:MonthlyRecap[]=[];
  for(const selectedMonth of months){
   const {data,error}=await s.rpc('attendance_recap_scoped',{
    p_month:selectedMonth,p_audience:audience||null,p_class_id:classId||null,
    p_level_id:levelId||null,p_event_id:null
   });
   if(error)throw Error('Rekap terverifikasi belum tersedia: '+error.message);
   authorizedMonths.push(data as MonthlyRecap);
  }
  const full=mergeRecapMonths(authorizedMonths);
  const person=full.individuals.find(row=>row.id===personId);
  if(!person)return NextResponse.json({error:'Peserta tidak ditemukan pada rekap yang diizinkan.'},{status:404});
  const eventIds=[...new Set(full.meetings.map(m=>m.id))];
  if(eventIds.length>250)return NextResponse.json({error:'Terlalu banyak pertemuan, persempit filter.'},{status:400});
  if(!eventIds.length)return NextResponse.json({person,meetings:[]},{headers:{'Cache-Control':'private, no-store'}});
  let query=s.from('attendance_records')
   .select('id,event_id,member_id,participant_key,member_name_snapshot,class_name_snapshot,level_name_snapshot,class_id_snapshot,level_id_snapshot,status,notes')
   .in('event_id',eventIds)
   .limit(1500);
  if(personId.startsWith('legacy:'))query=query.is('member_id',null);
  else query=query.or(`member_id.eq.${personId},participant_key.eq.${personId}`);
  const {data:rows,error:recordsErr}=await query;
  if(recordsErr)throw Error('Riwayat presensi tidak dapat dibaca: '+recordsErr.message);
  const eventMap=new Map(full.meetings.map(m=>[m.id,m]));
  const sorted= (rows||[]).flatMap(record=>{
   const event=eventMap.get(record.event_id);
   if(!event)return [];
   const stable=record.member_id||legacyIdentity(event.audience,record.member_name_snapshot||'');
   if(stable!==personId)return [];
   return [{
    id:record.id,event_id:record.event_id,date:event.date,title:event.title,
    audience:event.audience,class_name:record.class_name_snapshot||event.class_name||'',
    status:(record.status==='H'||record.status==='I'||record.status==='A'?record.status:null) as Status,
    notes:record.notes||'',obligation:true as const
   }];
  }).sort((a,b)=>b.date.localeCompare(a.date)||a.title.localeCompare(b.title));
  // Do not count duplicate records as separate obligations; retain one per actual event.
  const unique=new Map<string,DetailRow>();
  for(const record of sorted)if(!unique.has(record.event_id))unique.set(record.event_id,record);
  return NextResponse.json({person,meetings:[...unique.values()]},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Detail individu tidak tersedia.'},{status:400})}
}
