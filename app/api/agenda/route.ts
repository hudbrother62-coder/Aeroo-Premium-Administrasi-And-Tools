import {saveAgenda} from '@/lib/agenda-save';
import {publicProjection} from '@/lib/public-read';
import { NextRequest, NextResponse } from 'next/server';import { db } from '@/lib/supabase-server';
export async function GET(req:NextRequest){
  const s=await db();
  // Instansiasi jadwal rutin sesuai rentang yang dibuka, tanpa duplikasi.
  const requestedFrom=req.nextUrl.searchParams.get('from');
  const requestedTo=req.nextUrl.searchParams.get('to');
  if(requestedFrom&&requestedTo&&/^\\d{4}-\\d{2}-\\d{2}/.test(requestedFrom)&&/^\\d{4}-\\d{2}-\\d{2}/.test(requestedTo)){
    const dateFrom=requestedFrom.slice(0,10),dateTo=requestedTo.slice(0,10);
    const span=(Date.parse(dateTo+'T00:00:00Z')-Date.parse(dateFrom+'T00:00:00Z'))/86400000;
    if(Number.isFinite(span)&&span>=0&&span<=62){
      const {error:routineError}=await s.rpc('ensure_simpul_routine_agenda',{p_from:dateFrom,p_to:dateTo});
      if(routineError)return NextResponse.json({error:'Agenda rutin belum dapat disiapkan: '+routineError.message},{status:500});
    }
  }
  const projection=await publicProjection(req,'agenda');
  if(projection)return projection;
  const from=req.nextUrl.searchParams.get('from'),to=req.nextUrl.searchParams.get('to');
  let q=s.from('agenda').select('*,activity_types(id,name,audience)').order('starts_at');
  if(from)q=q.gte('starts_at',from);
  if(to)q=q.lte('starts_at',to);
  const {data,error}=await q;
  if(error)return NextResponse.json({error:error.message},{status:400});
  const rows=data??[];
  if(!rows.length)return NextResponse.json([]);
  const ids=rows.map(row=>row.id);
  const [attendance,journals]=await Promise.all([
    s.from('attendance_events').select('id,agenda_id').in('agenda_id',ids).order('created_at',{ascending:false}),
    s.from('journals').select('id,agenda_id').in('agenda_id',ids).order('created_at',{ascending:false})
  ]);
  const attendanceByAgenda=new Map<string,string>();
  const journalsByAgenda=new Map<string,string>();
  for(const e of attendance.data??[])if(e.agenda_id&&!attendanceByAgenda.has(e.agenda_id))attendanceByAgenda.set(e.agenda_id,e.id);
  for(const j of journals.data??[])if(j.agenda_id&&!journalsByAgenda.has(j.agenda_id))journalsByAgenda.set(j.agenda_id,j.id);
  return NextResponse.json(rows.map(row=>({...row,attendance_event_id:attendanceByAgenda.get(row.id)||null,journal_id:journalsByAgenda.get(row.id)||null})));
}
export async function POST(req:NextRequest){return saveAgenda(req,null)}
