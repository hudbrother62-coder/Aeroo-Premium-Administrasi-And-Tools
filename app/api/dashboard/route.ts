import {NextRequest,NextResponse} from 'next/server';
import {dataSummary,readRows} from '@/lib/public-read';
import {jakartaDate,effectiveMembership} from '@/lib/domain';
import {db} from '@/lib/supabase-server';

export async function GET(req:NextRequest){
  try{
    req.nextUrl.searchParams.set('month',jakartaDate().slice(0,7));
    const [summary,people,events,journals]=await Promise.all([dataSummary(req),readRows('members'),readRows('attendance'),readRows('journals')]);
    const s=await db();const today=jakartaDate();
    const[{data:levels},{data:me},{data:decisions},{data:imports}]=await Promise.all([
      s.from('levels').select('id,name').order('sort_order'),
      s.rpc('get_current_app_user'),
      s.from('meeting_decisions').select('id,decision,deadline,status,journal_id').lt('deadline',today).neq('status','COMPLETED').neq('status','CANCELLED').order('deadline').limit(8),
      s.from('import_jobs').select('id,status').in('status',['FAILED','PARTIAL']).limit(20)
    ]);
    const month=today.slice(0,7);
    const monthEvents=events.filter(e=>e.event_date.startsWith(month)&&e.state!=='CANCELLED');
    const rows=monthEvents.flatMap(e=>e.attendance_records);
    const categories=new Map<string,number>();
    for(const p of people)for(const c of p.member_categories||[]){const name=c.categories?.name;if(name&&!['Kelompok','Pengurus'].includes(name))categories.set(name,(categories.get(name)||0)+1)}
    const open=events.filter(e=>e.state!=='CANCELLED'&&e.event_date<=today&&e.attendance_records?.some((r:any)=>r.status===null));
    const incompleteMembers=people.filter(p=>{
      const active=(p.member_memberships||[]).filter((m:any)=>effectiveMembership(m));
      if(!active.length)return true;
      return active.some((m:any)=>['caberawit','muda-mudi'].includes(m.categories?.slug)&&(!m.level_id||!m.class_id));
    });
    const draft=journals.filter(j=>j.state==='DRAFT');
    return NextResponse.json({
      role:me?.[0]?.role||'VIEWER',
      todayEvents:events.filter(e=>e.event_date===today&&e.state!=='CANCELLED').map(e=>({id:e.id,title:e.title,audience:e.audience})),
      unfinishedAttendance:open.map(e=>({id:e.id,title:e.title})),
      draftJournals:draft.map(j=>({id:j.id,title:j.title})),
      overdueDecisions:(decisions||[]).map((d:any)=>({id:d.id,title:d.decision,journal_id:d.journal_id,deadline:d.deadline})),
      completeness:{members:incompleteMembers.length,attendance:open.length,journals:draft.length,followups:(decisions||[]).length,imports:(imports||[]).length},
      members:people.length,categories:[...categories].map(([name,count])=>({name,count})),
      attendance:{meetings:summary.attendance.meetings,present:summary.attendance.H,excused:summary.attendance.I,absent:summary.attendance.A,pending:summary.attendance.pending},
      journals:summary.journals,
      levels:(levels||[]).map(l=>({id:l.id,name:l.name,count:people.filter(p=>p.member_memberships?.some((m:any)=>effectiveMembership(m)&&m.level_id===l.id)).length,present:rows.filter(r=>r.level_id_snapshot===l.id&&r.status==='H').length,total:rows.filter(r=>r.level_id_snapshot===l.id&&r.status!==null).length}))
    });
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Ringkasan tidak dapat dimuat'},{status:400})}
}
