import {NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {targetGaps} from '@/lib/target-gaps';

function jakartaDate(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}

export async function GET(){
  const s=await db();
  const {data:user}=await s.rpc('get_current_app_user');
  if(!user?.length)return NextResponse.json({error:'Masuk untuk melihat kelengkapan.'},{status:401});
  const today=jakartaDate();
  const {data:canTarget}=await s.rpc('has_app_permission',{p_permission:'target.read'});
  const [members,events,journals,agenda,decisions,imports]=await Promise.all([
    s.from('members').select('id,name,status,member_memberships(id,active,valid_from,valid_to,ended_on,level_id,class_id,categories(slug,name))').eq('status','ACTIVE').order('name'),
    s.from('attendance_events').select('id,title,event_date,audience,state,attendance_records(status)').lte('event_date',today).neq('state','CANCELLED').order('event_date',{ascending:false}).limit(100),
    s.from('journals').select('id,title,journal_date,journal_kind,state,agenda_id,journal_attachments(id)').in('state',['DRAFT']).order('journal_date',{ascending:false}).limit(100),
    s.from('agenda').select('id,title,starts_at,status,journal_required,documentation_required,target_tracking_enabled,journals(id,state,journal_attachments(id))').lte('starts_at',new Date().toISOString()).neq('status','CANCELLED').order('starts_at',{ascending:false}).limit(100),
    s.from('meeting_decisions').select('id,decision,deadline,status,journal_id').lt('deadline',today).neq('status','COMPLETED').neq('status','CANCELLED').order('deadline').limit(100),
    s.from('import_jobs').select('id,resource_type,file_name,status,error_rows,created_at').in('status',['FAILED','PARTIAL']).order('created_at',{ascending:false}).limit(100)
  ]);
  const err=[members,events,journals,agenda,decisions,imports].find(x=>x.error)?.error;
  if(err)return NextResponse.json({error:err.message},{status:400});

  const memberIssues:any[]=[];
  for(const m of members.data||[]){
    const active=(m as any).member_memberships?.filter((x:any)=>x.active&&(!x.valid_from||x.valid_from<=today)&&(!x.valid_to||x.valid_to>=today)&&(!x.ended_on||x.ended_on>today))||[];
    if(!active.length)memberIssues.push({id:m.id,title:m.name,detail:'Belum memiliki keikutsertaan aktif',href:'/database/tambah?id='+m.id});
    else for(const x of active){
      const slug=(x.categories as any)?.slug;
      if(['caberawit','muda-mudi'].includes(slug)&&(!x.level_id||!x.class_id)){
        memberIssues.push({id:m.id+':'+x.id,title:m.name,detail:(x.categories as any)?.name+' belum lengkap jenjang/kelas',href:'/database/tambah?id='+m.id});
      }
    }
  }

  const attendance=(events.data||[]).filter((e:any)=>((e.attendance_records||[]) as any[]).some(r=>r.status==null)).map((e:any)=>({
    id:e.id,title:e.title,detail:e.event_date+' · presensi belum lengkap',href:'/presensi/buat?event_id='+e.id
  }));
  const journalDraft=(journals.data||[]).map((j:any)=>({id:j.id,title:j.title,detail:j.journal_date+' · draft',href:'/jurnal/buat?journal_id='+j.id}));
  const journalMissing=(agenda.data||[]).filter((a:any)=>a.journal_required&&!(a.journals||[]).some((j:any)=>j.state!=='ARCHIVED')).map((a:any)=>({id:'agenda:'+a.id,title:a.title,detail:'Jurnal wajib belum dibuat',href:'/jurnal/buat?agenda_id='+a.id}));
  const journal=[...journalMissing,...journalDraft.filter((j:any)=>!journalMissing.some((m:any)=>m.href.includes(j.id)))];
  const documentation=(agenda.data||[]).filter((a:any)=>a.documentation_required&&!(a.journals||[]).some((j:any)=>(j.journal_attachments||[]).length>0)).map((a:any)=>({id:a.id,title:a.title,detail:'Dokumentasi wajib belum tersedia',href:'/jurnal/buat?agenda_id='+a.id}));
  const overdue=(decisions.data||[]).map((d:any)=>({id:d.id,title:d.decision,detail:'Deadline '+d.deadline,href:'/jurnal/buat?journal_id='+d.journal_id}));
  const importProblems=(imports.data||[]).map((j:any)=>({id:j.id,title:j.file_name||j.resource_type,detail:j.status+' · '+j.error_rows+' error',href:'/impor'}));
  const targetIssues=canTarget?await targetGaps(s,today):[];
  const targets=targetIssues.map(t=>({id:t.id,title:t.title,detail:t.missing+' dari '+t.eligible+' anggota belum dinilai',href:t.href}));

  return NextResponse.json({
    summary:{members:memberIssues.length,attendance:attendance.length,journals:journal.length,documentation:documentation.length,targets:targets.length,followups:overdue.length,imports:importProblems.length,total:memberIssues.length+attendance.length+journal.length+documentation.length+targets.length+overdue.length+importProblems.length},
    groups:[
      {key:'members',title:'Data Anggota',items:memberIssues},
      {key:'attendance',title:'Presensi',items:attendance},
      {key:'journals',title:'Jurnal',items:journal},
      {key:'documentation',title:'Dokumentasi',items:documentation},
      {key:'targets',title:'Target & Progres',items:targets},
      {key:'followups',title:'Tindak Lanjut',items:overdue},
      {key:'imports',title:'Import',items:importProblems}
    ]
  });
}
