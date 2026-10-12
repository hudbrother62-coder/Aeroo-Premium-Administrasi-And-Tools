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
 if(resource==='journals'&&((q.get('state')&&r.state!==q.get('state'))||(!q.get('state')&&r.state==='ARCHIVED')||(q.get('month')&&!r.journal_date?.startsWith(q.get('month')))))return false;
 if(q.get('kind')&&r.journal_kind!==q.get('kind'))return false;
 if(q.get('member_id')&&r.member_id!==q.get('member_id'))return false;
 if(q.get('version_id')&&(q.get('version_id')==='__unversioned__'?r.version_id!==null:r.version_id!==q.get('version_id')))return false;
 if(resource==='members'){if(q.get('archived')==='1')return false;if(q.get('q')&&!r.name.toLowerCase().includes(q.get('q')!.toLowerCase()))return false;const slug=slugByAudience[q.get('segment')||''];if(q.get('segment')==='KELOMPOK'&&r.member_memberships?.some((m:any)=>effectiveMembership(m)&&m.categories?.slug==='caberawit'))return false;if((slug||q.get('class_id')||q.get('level_id'))&&!r.member_memberships?.some((m:any)=>effectiveMembership(m)&&(!slug||m.categories?.slug===slug)&&(!q.get('class_id')||m.class_id===q.get('class_id'))&&(!q.get('level_id')||m.level_id===q.get('level_id'))))return false;if(q.get('office'))return false;}
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
 const end=new Date(Number(month.slice(0,4)),Number(month.slice(5,7))+4,1).toISOString().slice(0,10);
 const versions=await publicRows('versions');
 const version=req.nextUrl.searchParams.get('version_id')||versions[0]?.id||'__unversioned__';
 const targets=(await readRows('targets')).filter((t:any)=>{
   if(version==='__unversioned__'?!!t.version_id:t.version_id!==version)return false;
   // Target semester yang tidak memiliki tahun/bulan pasti tetap tersedia untuk penilaian individu.
   // Null bukan tanggal fiktif dan tidak dianggap sebagai target bulan berjalan.
   if(!t.target_month)return true;
   return t.target_month>=month+'-01'&&t.target_month<=end;
 });
 const [members,progress]=await Promise.all([readRows('members'),readRows('progress')]);
 const individual=members
   .filter((p:any)=>p.member_categories?.some((c:any)=>['caberawit','muda-mudi'].includes(c.categories?.slug)))
   .map((p:any)=>{
     const ids=targets.filter((t:any)=>(p.member_memberships||[]).some((mm:any)=>
       (mm.effective??(mm.active||!!mm.valid_to))&&
       mm.level_id===t.level_id&&
       (!t.class_id||mm.class_id===t.class_id)&&
       (!t.target_month||(!mm.valid_from||mm.valid_from.slice(0,7)<=t.target_month.slice(0,7))&&
         (!mm.valid_to||mm.valid_to.slice(0,7)>=t.target_month.slice(0,7)))
     )).map((t:any)=>t.id);
     const summary=summarizeProgress(ids,progress.filter((r:any)=>r.member_id===p.id));
     return {id:p.id,name:p.name,class_name:p.classes?.name,level_name:p.levels?.name,
       targets:summary.assigned,assessed:summary.assessed,percentage:summary.percentage};
   });
 const groups=new Map<string,any[]>();
 for(const p of individual){
   const name=p.class_name||p.level_name||'Tanpa kelas';
   groups.set(name,[...(groups.get(name)||[]),p]);
 }
 return {version_id:version,targets,individual,
   classes:[...groups].map(([name,ps])=>{
     const scored=ps.filter(p=>p.percentage!==null);
     return {name,count:ps.length,percentage:scored.length
       ?Math.round(scored.reduce((s,p)=>s+p.percentage,0)/scored.length):null};
   })};
}

export async function readRows(resource:string){
 const s=await db();const{data:role}=await s.rpc('current_app_role');if(!role||role==='VIEWER')return publicRows(resource);
 const queries:Record<string,[string,string]>={members:['members','*,classes!members_class_id_fkey(name),levels(name),member_categories(categories(name,slug)),member_memberships(*,categories(id,name,slug),classes(name),levels(name))'],attendance:['attendance_events','*,attendance_records(*),classes(name)'],journals:['journals','*'],targets:['learning_targets','*,levels(name),classes(name)'],progress:['journal_progress','*,journals!inner(state,journal_date,event_id,attendance_events(state,attendance_records(participant_key,status)))']};
 if(!queries[resource])throw Error('Sumber tidak valid');const[table,select]=queries[resource];let q=s.from(table).select(select);if(resource==='members')q=q.eq('status','ACTIVE');if(resource==='targets')q=q.eq('active',true);if(resource==='progress')q=q.eq('journals.state','COMPLETED');const{data,error}=await q;if(error)throw Error(error.message);if(resource==='members')return (data||[]).map((p:any)=>projectMember(p));if(resource==='progress')return (data||[]).filter((r:any)=>{const j=Array.isArray(r.journals)?r.journals[0]:r.journals;const e=Array.isArray(j.attendance_events)?j.attendance_events[0]:j.attendance_events;return !j.event_id||(e?.state!=='CANCELLED'&&e?.attendance_records?.some((a:any)=>a.participant_key===r.participant_key&&a.status==='H'))}).map((r:any)=>({...r,member_id:r.member_id||r.participant_key}));return data||[];
}
export async function dataSummary(req:NextRequest){
 const month=req.nextUrl.searchParams.get('month')||jakartaDate().slice(0,7);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Bulan tidak valid');const span=req.nextUrl.searchParams.get('span')==='6'?6:1;const start=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))-span,1)).toISOString().slice(0,10);const end=month+'-'+new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();const[people,events,journals]=await Promise.all([readRows('members'),readRows('attendance'),readRows('journals')]);
 const selected=events.filter(e=>e.event_date>=start&&e.event_date<=end&&e.state!=='CANCELLED');const entries=selected.flatMap(e=>e.attendance_records||[]);const cancelled=new Set(events.filter(e=>e.state==='CANCELLED').map(e=>e.id));const js=journals.filter(j=>!cancelled.has(j.event_id)&&j.state==='COMPLETED'&&j.journal_date>=start&&j.journal_date<=end);const map=new Map<string,any>();for(const p of people)map.set(p.id,{id:p.id,name:p.name,class_name:p.classes?.name||'',level_name:p.levels?.name||'',categories:p.member_categories?.map((c:any)=>c.categories?.name)||[],H:0,I:0,A:0,pending:0,journals:0});for(const r of entries){if(!map.has(r.participant_key))map.set(r.participant_key,{id:r.participant_key,name:r.member_name_snapshot,class_name:r.class_name_snapshot||'',level_name:r.level_name_snapshot||'',categories:[],H:0,I:0,A:0,pending:0,journals:0,archived:true});const p=map.get(r.participant_key);if(['H','I','A'].includes(r.status))p[r.status]++;else p.pending++}for(const j of js)if(map.has(j.member_id))map.get(j.member_id).journals++;
 const has=(p:any,slug:string)=>p.member_categories?.some((c:any)=>c.categories?.slug===slug);
 return {month,span,counts:{total:people.length,caberawit:people.filter(p=>has(p,'caberawit')).length,muda_mudi:people.filter(p=>has(p,'muda-mudi')).length,ibu_ibu:people.filter(p=>has(p,'ibu-ibu')).length,pengurus:people.filter(p=>has(p,'pengurus')).length},attendance:{...summarizeAttendance(entries),meetings:selected.length},journals:js.length,individuals:[...map.values()].map(p=>({...p,percentage:p.H+p.I+p.A?Math.round(p.H/(p.H+p.I+p.A)*1000)/10:null}))};
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
