import {NextRequest,NextResponse} from 'next/server';
import {readRows,publicDashboard} from '@/lib/public-read';
import {jakartaDate,effectiveMembership} from '@/lib/domain';
import {buildDashboardAnalytics,matchingRecords,createDashboardLookup} from '@/lib/dashboard-analytics';
import {db} from '@/lib/supabase-server';

export async function GET(req:NextRequest){
  try{
    const s=await db();
    const {data:appRole,error:roleError}=await s.rpc('current_app_role');
    if(roleError)throw new Error(roleError.message);
    if(!appRole||appRole==='VIEWER')return NextResponse.json(await publicDashboard(req),{headers:{'Cache-Control':'private, no-store'}});
    const month=req.nextUrl.searchParams.get('month')||jakartaDate().slice(0,7);
    const span=([1,3,6].includes(Number(req.nextUrl.searchParams.get('span')))?Number(req.nextUrl.searchParams.get('span')):1) as 1|3|6;
    const levelId=req.nextUrl.searchParams.get('level_id')||'';
    const [people,events,journals,targets,progress,levelsResult,classesResult,meResult,decisionResult,importResult]=await Promise.all([
      readRows('members'),readRows('attendance'),readRows('journals'),readRows('targets'),readRows('progress'),
      s.from('levels').select('id,name,sort_order,active').order('sort_order').order('name'),
      s.from('classes').select('id,name,level_id,active'),
      s.rpc('get_current_app_user'),
      s.from('meeting_decisions').select('id,decision,deadline,status,journal_id').lt('deadline',jakartaDate()).neq('status','COMPLETED').neq('status','CANCELLED').order('deadline').limit(20),
      s.from('import_jobs').select('id,status').in('status',['FAILED','PARTIAL']).limit(20)
    ]);
    if(levelsResult.error)throw new Error(levelsResult.error.message);
    if(classesResult.error)throw new Error(classesResult.error.message);
    const analytics=buildDashboardAnalytics({people,events,journals,targets,progress,levels:levelsResult.data||[],classes:classesResult.data||[],month,span,levelId});
    const today=jakartaDate();
    const lookup=createDashboardLookup(people,classesResult.data||[]);
    const relevant=(e:any)=>e.state!=='CANCELLED'&&(!levelId||e.level_id===levelId||matchingRecords(e,levelId,lookup).length>0);
    const scopedEventIds=new Set(events.filter(relevant).map(e=>e.id));
    const scopedClassIds=new Set(people.filter(p=>(p.member_memberships||[]).some((m:any)=>effectiveMembership(m)&&(!levelId||m.level_id===levelId))).flatMap(p=>(p.member_memberships||[]).map((m:any)=>m.class_id).filter(Boolean)));
    const relevantJournal=(j:any)=>!levelId||j.event_id&&scopedEventIds.has(j.event_id)||j.class_id&&scopedClassIds.has(j.class_id);
    const draft=journals.filter(j=>j.state==='DRAFT'&&relevantJournal(j));
    const open=events.filter(e=>relevant(e)&&e.event_date<=today&&matchingRecords(e,levelId,lookup).some((r:any)=>r.status===null));
    const decisions=(decisionResult.data||[]).filter((d:any)=>!levelId||journals.some(j=>j.id===d.journal_id&&relevantJournal(j)));
    const incompleteMembers=people.filter(p=>(!levelId||(p.member_memberships||[]).some((m:any)=>effectiveMembership(m)&&m.level_id===levelId))&&(p.member_memberships||[]).some((m:any)=>effectiveMembership(m)&&['caberawit','muda-mudi'].includes(m.categories?.slug)&&(!m.level_id||!m.class_id)));
    return NextResponse.json({
      ...analytics,role:meResult.data?.[0]?.role||appRole,
      todayEvents:events.filter(e=>relevant(e)&&e.event_date===today).slice(0,8).map(e=>({id:e.id,title:e.title,audience:e.audience})),
      unfinishedAttendance:open.slice(0,8).map(e=>({id:e.id,title:e.title})),
      draftJournals:draft.slice(0,8).map(j=>({id:j.id,title:j.title})),
      overdueDecisions:decisions.slice(0,8).map((d:any)=>({id:d.id,title:d.decision,journal_id:d.journal_id,deadline:d.deadline})),
      completeness:{members:incompleteMembers.length,attendance:open.length,journals:draft.length,followups:decisions.length,imports:levelId?0:(importResult.data||[]).length}
    },{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Ringkasan tidak dapat dimuat'},{status:400})}
}
