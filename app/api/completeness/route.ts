import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {targetGaps} from '@/lib/target-gaps';
import {jakartaDate,effectiveMembership} from '@/lib/domain';

type Key='members'|'attendance'|'journals'|'documentation'|'targets'|'followups'|'imports';
type Issue={id:string;title:string;detail:string;href:string};
type Result={key:Key;title:string;items:Issue[];partial:boolean;unavailable:boolean;error?:string};
const sections:{key:Key;title:string;permission:string}[]=[
  {key:'members',title:'Data Anggota',permission:'person.read'},
  {key:'attendance',title:'Presensi',permission:'attendance.read'},
  {key:'journals',title:'Jurnal',permission:'journal.read'},
  {key:'documentation',title:'Dokumentasi',permission:'agenda.read'},
  {key:'targets',title:'Target & Progres',permission:'target.read'},
  {key:'followups',title:'Tindak Lanjut',permission:'decision.write'},
  {key:'imports',title:'Import',permission:'import.manage'}
];
const issue=(id:string,title:string,detail:string,href:string):Issue=>({id,title,detail,href});
function fail(message:string,status:number){return NextResponse.json({error:message},{status,headers:{'Cache-Control':'private, no-store'}})}
const MAX_EVENTS=700;
async function readSection(s:any,key:Key,today:string):Promise<Result>{
  const section=sections.find(x=>x.key===key)!;
  const {data:allowed,error:permissionError}=await s.rpc('has_app_permission',{p_permission:section.permission});
  if(permissionError)throw Error(permissionError.message);
  if(!allowed)return {key,title:section.title,items:[],partial:false,unavailable:true};
  let items:Issue[]=[];let partial=false;
  switch(key){
    case 'members':{
      const cap=900;
      const {data,error}=await s.from('members')
        .select('id,name,member_memberships(id,active,valid_from,valid_to,ended_on,level_id,class_id,categories(slug,name))')
        .eq('status','ACTIVE').order('name').limit(cap);
      if(error)throw Error(error.message);
      partial=(data?.length||0)===cap;
      for(const member of data||[]){
        for(const membership of member.member_memberships||[]){
          if(!effectiveMembership(membership,today))continue;
          const category=Array.isArray(membership.categories)?membership.categories[0]:membership.categories;
          if(!['caberawit','muda-mudi'].includes(category?.slug)||membership.level_id&&membership.class_id)continue;
          const missing=[!membership.level_id?'jenjang':null,!membership.class_id?'kelas':null].filter(Boolean).join(' dan ');
          items.push(issue(String(member.id)+':'+String(membership.id),member.name,
            (category?.name||'Anggota')+' · '+missing+' belum ditentukan','/database/'+encodeURIComponent(member.id)));
        }
      }
      break;
    }
    case 'attendance':{
      const cap=1200;
      // Read only unfinished records; do not load every participant in every meeting.
      const {data,error}=await s.from('attendance_records')
        .select('event_id,attendance_events!inner(id,title,event_date,state)')
        .is('status',null)
        .lte('attendance_events.event_date',today)
        .neq('attendance_events.state','CANCELLED')
        .order('created_at',{ascending:false}).limit(cap);
      if(error)throw Error(error.message);
      partial=(data?.length||0)===cap;
      const events=new Map<string,{id:string;title:string;date:string;count:number}>();
      for(const r of data||[]){
        const event=Array.isArray(r.attendance_events)?r.attendance_events[0]:r.attendance_events;
        if(!event?.id)continue;
        const existing=events.get(event.id);
        if(existing)existing.count++;
        else events.set(event.id,{id:event.id,title:event.title||'Pertemuan',date:event.event_date||'',count:1});
      }
      items=Array.from(events.values()).sort((a,b)=>b.date.localeCompare(a.date)).map(x=>issue(x.id,x.title,
        x.date+' · '+x.count+' peserta belum diabsen','/presensi/buat?event_id='+encodeURIComponent(x.id)));
      break;
    }
    case 'journals':{
      const cap=200;
      const [draft,agendas]=await Promise.all([
        s.from('journals').select('id,title,journal_date').eq('state','DRAFT').order('journal_date',{ascending:false}).limit(cap),
        s.from('agenda').select('id,title,starts_at,journals(id,state)')
          .eq('journal_required',true).lte('starts_at',new Date().toISOString()).neq('status','CANCELLED')
          .order('starts_at',{ascending:false}).limit(cap)
      ]);
      if(draft.error||agendas.error)throw Error((draft.error||agendas.error).message);
      partial=(draft.data?.length||0)===cap||(agendas.data?.length||0)===cap;
      const missing=(agendas.data||[]).filter((x:any)=>!x.journals?.some((j:any)=>j.state!=='ARCHIVED'));
      items=[
        ...missing.map((a:any)=>issue('agenda:'+a.id,a.title,'Jurnal kegiatan wajib belum dibuat',
          '/jurnal/buat?agenda_id='+encodeURIComponent(a.id))),
        ...(draft.data||[]).map((j:any)=>issue(j.id,j.title,j.journal_date+' · jurnal masih draft',
          '/jurnal/buat?journal_id='+encodeURIComponent(j.id)))
      ];
      break;
    }
    case 'documentation':{
      const cap=200;
      const {data,error}=await s.from('agenda')
        .select('id,title,starts_at,journals(id,state,assessment,journal_attachments(id))')
        .eq('documentation_required',true).lte('starts_at',new Date().toISOString()).neq('status','CANCELLED')
        .order('starts_at',{ascending:false}).limit(cap);
      if(error)throw Error(error.message);
      partial=(data?.length||0)===cap;
      items=(data||[]).filter((a:any)=>!(a.journals||[]).some((j:any)=>j.state!=='ARCHIVED'&&
        ((j.journal_attachments||[]).length>0||Boolean(String(j.assessment?.documentation||'').trim()))))
        .map((a:any)=>issue(a.id,a.title,'Dokumentasi kegiatan wajib belum dilengkapi',
          '/jurnal/buat?'+((a.journals||[]).some((j:any)=>j.state!=='ARCHIVED')
            ?'journal_id='+encodeURIComponent(a.journals.find((j:any)=>j.state!=='ARCHIVED').id)
            :'agenda_id='+encodeURIComponent(a.id))));
      break;
    }
    case 'targets':{
      const gaps=await targetGaps(s,today);
      items=gaps.map(x=>issue(x.id,x.title,x.missing+' dari '+x.eligible+' peserta belum dinilai',x.href));
      break;
    }
    case 'followups':{
      const cap=150;
      const {data,error}=await s.from('meeting_decisions')
        .select('id,decision,deadline,journal_id').lt('deadline',today)
        .neq('status','COMPLETED').neq('status','CANCELLED').order('deadline').limit(cap);
      if(error)throw Error(error.message);
      partial=(data?.length||0)===cap;
      items=(data||[]).map((x:any)=>issue(x.id,x.decision,
        'Lewat tenggat '+x.deadline,x.journal_id
          ?'/jurnal/buat?journal_id='+encodeURIComponent(x.journal_id):'/jurnal'));
      break;
    }
    case 'imports':{
      const cap=150;
      const {data,error}=await s.from('import_jobs')
        .select('id,file_name,resource_type,status,error_rows,created_at')
        .in('status',['FAILED','PARTIAL']).order('created_at',{ascending:false}).limit(cap);
      if(error)throw Error(error.message);
      partial=(data?.length||0)===cap;
      items=(data||[]).map((x:any)=>issue(x.id,x.file_name||x.resource_type,
        x.status+' · '+Number(x.error_rows||0)+' baris bermasalah','/impor'));
      break;
    }
  }
  return {key,title:section.title,items,partial,unavailable:false};
}
export async function GET(req:NextRequest){
  try{
    const s=await db();
    const {data:user,error:authError}=await s.rpc('get_current_app_user');
    if(authError||!user?.length)return fail('Masuk ke akun Simpul untuk memeriksa kelengkapan.',401);
    const group=req.nextUrl.searchParams.get('group');
    if(group&&!sections.some(x=>x.key===group))return fail('Jenis pemeriksaan tidak tersedia.',400);
    const today=jakartaDate();
    if(group){
      try{return NextResponse.json(await readSection(s,group as Key,today),{headers:{'Cache-Control':'private, no-store'}});}
      catch(error){return fail(error instanceof Error?error.message:'Pemeriksaan gagal dimuat.',500);}
    }
    // Backwards-compatible aggregate response, isolating failed sections.
    const results=await Promise.all(sections.map(async section=>{
      try{return await readSection(s,section.key,today);}
      catch(error):Promise<Result>{return {key:section.key,title:section.title,items:[],partial:false,unavailable:false,
        error:error instanceof Error?error.message:'Pemeriksaan gagal dimuat.'};}
    }));
    const summary={members:0,attendance:0,journals:0,documentation:0,targets:0,followups:0,imports:0,total:0};
    for(const group of results)if(!group.error&&!group.unavailable){summary[group.key]=group.items.length;summary.total+=group.items.length;}
    return NextResponse.json({summary,groups:results,complete:results.every(x=>!x.error&&!x.partial),warnings:results.filter(x=>x.error).map(x=>({key:x.key,error:x.error}))},
      {headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return fail(error instanceof Error?error.message:'Gagal memeriksa kelengkapan.',500);}
}
