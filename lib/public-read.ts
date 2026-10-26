import {NextRequest,NextResponse} from 'next/server';
import {db} from './supabase-server';
import {buildDashboardAnalytics} from './dashboard-analytics';
import {jakartaDate,effectiveMembership,projectMember,slugByAudience,summarizeAttendance,summarizeProgress} from './domain';
export async function publicRows(resource:string){const s=await db();const {data,error}=await s.rpc('viewer_data',{p_resource:resource});if(error)throw new Error(error.message);return Array.isArray(data)?data:[];}
export function filterPublic(rows:any[],req:NextRequest,resource:string){const q=req.nextUrl.searchParams;return rows.filter(r=>{
 const date=resource==='attendance'?r.event_date:resource==='journals'?r.journal_date:resource==='agenda'?r.starts_at:null;
 if(date&&q.get('from')&&(resource==='agenda'?Date.parse(date)<Date.parse(q.get('from')!):date<q.get('from')!))return false;if(date&&q.get('to')&&(resource==='agenda'?Date.parse(date)>Date.parse(q.get('to')!):date>q.get('to')!))return false;
 if(q.get('audience')&&r.audience!==q.get('audience'))return false;
 if(resource!=='members'&&q.get('class_id')&&r.class_id!==q.get('class_id'))return false;
 if(resource!=='members'&&q.get('level_id')&&r.level_id!==q.get('level_id'))return false;
 if(resource==='attendance'&&q.get('history')==='1'&&(r.state==='CANCELLED'||!Array.isArray(r.attendance_records)||!r.attendance_records.some((a:any)=>['H','I','A'].includes(a.status))))return false;
 if(resource==='journals'&&((q.get('state')&&r.state!==q.get('state'))||(!q.get('state')&&r.state==='ARCHIVED')||(q.get('month')&&!r.journal_date?.startsWith(q.get('month')))))return false;
 if(q.get('kind')&&r.journal_kind!==q.get('kind'))return false;
 if(q.get('member_id')&&r.member_id!==q.get('member_id'))return false;
 if(q.get('version_id')&&(q.get('version_id')==='__unversioned__'?r.version_id!==null:r.version_id!==q.get('version_id')))return false;
 if(resource==='members'){if(q.get('archived')==='1')return false;if(q.get('q')&&!r.name.toLowerCase().includes(q.get('q')!.toLowerCase()))return false;const slug=q.get('segment')==='KELOMPOK'?undefined:slugByAudience[q.get('segment')||''];if(q.get('segment')==='KELOMPOK'&&r.member_memberships?.some((m:any)=>effectiveMembership(m)&&m.categories?.slug==='caberawit'))return false;if((slug||q.get('class_id')||q.get('level_id'))&&!r.member_memberships?.some((m:any)=>effectiveMembership(m)&&(!slug||m.categories?.slug===slug)&&(!q.get('class_id')||m.class_id===q.get('class_id'))&&(!q.get('level_id')||m.level_id===q.get('level_id'))))return false;if(q.get('office'))return false;}
 return true;
 });}
export async function publicProjection(req:NextRequest,resource:string){const s=await db();const{data:role}=await s.rpc('current_app_role');if(role&&role!=='VIEWER')return null;return NextResponse.json(filterPublic(await publicRows(resource),req,resource),{headers:{'Cache-Control':'public, s-maxage=30, stale-while-revalidate=120'}});}
export async function publicRecap(req:NextRequest){
 const params=req.nextUrl.searchParams;
 const month=params.get('month')||jakartaDate().slice(0,7);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Bulan tidak valid.');
 const asUuid=(key:string)=>{const value=params.get(key)||null;if(value&&!/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value))throw Error('Parameter '+key+' tidak valid.');return value;};
 const s=await db();
 const {data,error}=await s.rpc('attendance_recap_scoped',{
   p_month:month,
   p_audience:params.get('audience')||null,
   p_level_id:asUuid('level_id'),
   p_class_id:asUuid('class_id'),
   p_event_id:asUuid('event_id'),
 });
 if(error)throw new Error(error.message);
 return data;
}
export async function publicTargetOverview(req:NextRequest){
 const month=req.nextUrl.searchParams.get('month')||jakartaDate().slice(0,7);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Bulan tidak valid');
 const versions=await publicRows('versions');
 const version=req.nextUrl.searchParams.get('version_id')||versions[0]?.id||'__unversioned__';
 const targets=(await readRows('targets')).filter((t:any)=>version==='__unversioned__'?!t.version_id:t.version_id===version);
 const [classes,members,journals]=await Promise.all([publicRows('classes'),readRows('members'),readRows('journals')]);
 const records=journals.filter((j:any)=>j.state==='COMPLETED'&&j.journal_date?.startsWith(month)&&['CABERAWIT_CLASS','MUDA_MUDI_CLASS'].includes(j.journal_kind));
 const summaries=classes.filter((c:any)=>c.active!==false&&['CABERAWIT','MUDA_MUDI'].includes(c.audience)).map((c:any)=>{
   const membershipRows=members.flatMap((p:any)=>(p.member_memberships||[]).filter((m:any)=>m.effective&&m.class_id===c.id));
   const memberCount=new Set(membershipRows.map((m:any)=>m.member_id).filter(Boolean)).size||members.filter((p:any)=>(p.member_memberships||[]).some((m:any)=>m.effective&&m.class_id===c.id)).length;
   const levelIds=new Set(membershipRows.map((m:any)=>m.level_id).filter(Boolean));
   if(c.level_id)levelIds.add(c.level_id);
   const assigned=targets.filter((t:any)=>(!t.class_id||t.class_id===c.id)&&(!t.level_id||levelIds.has(t.level_id))&&(!t.target_month||t.target_month.slice(0,7)===month));
   const assignedIds=new Set(assigned.map((t:any)=>t.id));
   const meetings=records.filter((j:any)=>j.class_id===c.id);
   const confirmed=new Set<string>(),indications=new Set<string>();
   for(const j of meetings){
     const direct=j.assessment?.class_assessment?.target_id;
     if(direct&&assignedIds.has(direct))indications.add(direct);
     for(const m of j.assessment?.ai_target_analysis?.matches||[]){
       if(!assignedIds.has(m.target_id))continue;
       if(m.relation==='DIAJARKAN')confirmed.add(m.target_id);
       else if(m.relation==='INDIKASI')indications.add(m.target_id);
     }
   }
   const analyzed=meetings.filter((j:any)=>!!j.assessment?.ai_target_analysis).length;
   return {id:c.id,name:c.name,count:memberCount,percentage:assigned.length&&analyzed?Math.round(confirmed.size/assigned.length*100):null,
     targets:assigned.length,observed:confirmed.size,indications:indications.size,journals:meetings.length,analyzed};
 });
 return {version_id:version,targets,individual:[],classes:summaries};
}

export async function readRows(resource:string){
 const s=await db();const{data:role}=await s.rpc('current_app_role');if(!role||role==='VIEWER')return publicRows(resource);
 const queries:Record<string,[string,string]>={members:['members','*,classes!members_class_id_fkey(name),levels(name),member_categories(categories(name,slug)),member_memberships(*,categories(id,name,slug),classes(name),levels(name))'],attendance:['attendance_events','*,attendance_records(*),classes(name)'],journals:['journals','*'],targets:['learning_targets','*,levels(name),classes(name)'],progress:['journal_progress','*,journals!inner(state,journal_date,event_id,attendance_events(state,attendance_records(participant_key,status)))']};
 if(!queries[resource])throw Error('Sumber tidak valid');const[table,select]=queries[resource];let q=s.from(table).select(select);if(resource==='members')q=q.eq('status','ACTIVE');if(resource==='targets')q=q.eq('active',true);if(resource==='progress')q=q.eq('journals.state','COMPLETED');const{data,error}=await q;if(error)throw Error(error.message);if(resource==='members')return (data||[]).map((p:any)=>projectMember(p));if(resource==='progress')return (data||[]).filter((r:any)=>{const j=Array.isArray(r.journals)?r.journals[0]:r.journals;const e=Array.isArray(j.attendance_events)?j.attendance_events[0]:j.attendance_events;return !j.event_id||(e?.state!=='CANCELLED'&&e?.attendance_records?.some((a:any)=>a.participant_key===r.participant_key&&a.status==='H'))}).map((r:any)=>({...r,member_id:r.member_id||r.participant_key}));return data||[];
}
export async function dataSummary(req:NextRequest){
 const month=req.nextUrl.searchParams.get('month')||jakartaDate().slice(0,7);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Bulan tidak valid');
 const span=req.nextUrl.searchParams.get('span')==='6'?6:1;
 const monthRange=Array.from({length:span},(_,i)=>{
   const d=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))-span+i,1));
   return d.toISOString().slice(0,7);
 });
 const start=monthRange[0]+'-01';
 const end=month+'-'+new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
 const s=await db();
 // Reuse the same bounded, permission-checked source as the live attendance recap.
 // Do not retrieve every historical attendance record (which can be truncated by PostgREST).
 const [people,journals,recapMonths]=await Promise.all([
   readRows('members'),readRows('journals'),
   Promise.all(monthRange.map(async m=>{
     const {data,error}=await s.rpc('attendance_recap_scoped',{
       p_month:m,p_audience:null,p_level_id:null,p_class_id:null,p_event_id:null
     });
     if(error)throw Error('Rekap '+m+' tidak dapat dimuat: '+error.message);
     if(!data?.summary||!Array.isArray(data?.individuals))throw Error('Rekap '+m+' belum tersedia.');
     return data;
   }))
 ]);
 const map=new Map<string,any>();
 for(const p of people)map.set(p.id,{
   id:p.id,name:p.name,class_name:p.classes?.name||'',level_name:p.levels?.name||'',
   categories:p.member_categories?.map((c:any)=>c.categories?.name).filter(Boolean)||[],
   H:0,I:0,A:0,pending:0,journals:0
 });
 const totals={H:0,I:0,A:0,pending:0,meetings:0};
 for(const recap of recapMonths){
   for(const key of ['H','I','A','pending','meetings'] as const)totals[key]+=Number(recap.summary[key]||0);
   for(const p of recap.individuals){
     if(!map.has(p.id))map.set(p.id,{
       id:p.id,name:p.name,class_name:p.class_name||'',level_name:p.level_name||'',
       categories:[],H:0,I:0,A:0,pending:0,journals:0,archived:true
     });
     const item=map.get(p.id);
     for(const key of ['H','I','A','pending'] as const)item[key]+=Number(p[key]||0);
   }
 }
 const js=journals.filter((j:any)=>j.state==='COMPLETED'&&j.journal_date>=start&&j.journal_date<=end);
 for(const j of js)if(j.member_id&&map.has(j.member_id))map.get(j.member_id).journals++;
 const has=(p:any,slug:string)=>p.member_categories?.some((c:any)=>c.categories?.slug===slug);
 const individuals=[...map.values()].map(p=>({...p,percentage:p.H+p.I+p.A?Math.round(p.H/(p.H+p.I+p.A)*1000)/10:null}));
 return {
   month,span,
   counts:{total:people.length,caberawit:people.filter(p=>has(p,'caberawit')).length,
     muda_mudi:people.filter(p=>has(p,'muda-mudi')).length,
     ibu_ibu:people.filter(p=>has(p,'ibu-ibu')).length,
     pengurus:people.filter(p=>has(p,'pengurus')).length},
   attendance:{...totals,total:totals.H+totals.I+totals.A,
     percentage:totals.H+totals.I+totals.A?Math.round(totals.H/(totals.H+totals.I+totals.A)*1000)/10:null},
   journals:js.length,individuals
 };
}

export async function publicDashboard(req:NextRequest){
 const month=req.nextUrl.searchParams.get('month')||jakartaDate().slice(0,7);
 const span=([1,3,6].includes(Number(req.nextUrl.searchParams.get('span')))?Number(req.nextUrl.searchParams.get('span')):1) as 1|3|6;
 const levelId=req.nextUrl.searchParams.get('level_id')||'';
 const [members,events,journals,levels,classes,targets,progress,cats]=await Promise.all([
  publicRows('members'),publicRows('attendance'),publicRows('journals'),publicRows('levels'),publicRows('classes'),publicRows('targets'),publicRows('progress'),publicRows('categories')
 ]);
 const analytics=buildDashboardAnalytics({people:members,events,journals,levels,classes,targets,progress,month,span,levelId});
 return {...analytics,categories:cats.map(c=>({name:c.name,count:members.filter(m=>m.member_categories?.some((x:any)=>x.category_id===c.id)).length})),monthly:analytics.trend.map(b=>({month:b.label,meetings:b.meetings,present:b.present,journals:0}))};
}
