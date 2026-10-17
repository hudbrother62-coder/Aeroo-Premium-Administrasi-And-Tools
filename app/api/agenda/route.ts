import {saveAgenda} from '@/lib/agenda-save';
import {publicProjection} from '@/lib/public-read';
import { NextRequest, NextResponse } from 'next/server';import { db } from '@/lib/supabase-server';
export async function GET(req:NextRequest){
  const s=await db();
  // Kegiatan rutin memakai presensi/jurnal langsung, bukan materialisasi agenda.
  const from=req.nextUrl.searchParams.get('from'),to=req.nextUrl.searchParams.get('to');
  // Agenda informasi organisasi adalah referensi kalender, bukan event operasional.
  // Tidak membuat catatan kehadiran, jurnal atau tugas yang dianggap wajib dilaksanakan.
  let references=s.from('simpul_schedule_reference')
    .select('code,title,event_date,organizer_level,start_local,end_local,location,details')
    .order('event_date').order('start_local');
  if(from)references=references.gte('event_date',from.slice(0,10));
  if(to)references=references.lte('event_date',to.slice(0,10));
  const {data:referenceRows,error:referenceError}=await references;
  if(referenceError)return NextResponse.json({error:referenceError.message},{status:400});
  const information=(referenceRows??[]).map(ref=>({
    id:'info:'+ref.code,title:ref.title,audience:'KELOMPOK',
    starts_at:ref.event_date+'T'+(ref.start_local||'12:00:00')+'+07:00',
    ends_at:ref.end_local?ref.event_date+'T'+ref.end_local+'+07:00':null,
    location:ref.location,notes:ref.details,organizer_level:ref.organizer_level,
    info_start:ref.start_local?.slice(0,5)||null,
    info_end:ref.end_local?.slice(0,5)||null,
    is_information:true,attendance_enabled:false,journal_required:false,
    documentation_required:false,target_tracking_enabled:false,
    status:'SCHEDULED',revision:0,recurrence:'once',participant_ids:[],
    activity_type_id:null,attendance_event_id:null,journal_id:null
  }));
  const projection=await publicProjection(req,'agenda');
  if(projection){
    const publicAgendas=await projection.json();
    return NextResponse.json([...publicAgendas,...information].sort((a,b)=>a.starts_at.localeCompare(b.starts_at)),
      {headers:{'Cache-Control':'public, s-maxage=30, stale-while-revalidate=120'}});
  }
  let q=s.from('agenda').select('*,activity_types(id,name,audience)').is('routine_id',null).order('starts_at');
  if(from)q=q.gte('starts_at',from);
  if(to)q=q.lte('starts_at',to);
  const {data,error}=await q;
  if(error)return NextResponse.json({error:error.message},{status:400});
  const rows=data??[];
  if(!rows.length)return NextResponse.json(information);
  const ids=rows.map(row=>row.id);
  const [attendance,journals]=await Promise.all([
    s.from('attendance_events').select('id,agenda_id').in('agenda_id',ids).order('created_at',{ascending:false}),
    s.from('journals').select('id,agenda_id').in('agenda_id',ids).order('created_at',{ascending:false})
  ]);
  const attendanceByAgenda=new Map<string,string>();
  const journalsByAgenda=new Map<string,string>();
  for(const e of attendance.data??[])if(e.agenda_id&&!attendanceByAgenda.has(e.agenda_id))attendanceByAgenda.set(e.agenda_id,e.id);
  for(const j of journals.data??[])if(j.agenda_id&&!journalsByAgenda.has(j.agenda_id))journalsByAgenda.set(j.agenda_id,j.id);
  return NextResponse.json([...rows.map(row=>({...row,attendance_event_id:attendanceByAgenda.get(row.id)||null,journal_id:journalsByAgenda.get(row.id)||null})),...information].sort((a,b)=>a.starts_at.localeCompare(b.starts_at)));
}
export async function POST(req:NextRequest){return saveAgenda(req,null)}
