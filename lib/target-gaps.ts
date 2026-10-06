import 'server-only';
import {effectiveMembership,latestProgressRows} from './domain';

type Gap={
  id:string;
  title:string;
  target_month:string|null;
  eligible:number;
  assessed:number;
  missing:number;
  href:string;
};

export async function targetGaps(s:any,today:string):Promise<Gap[]>{
  const month=today.slice(0,7)+'-01';

  const {data:versions,error:versionError}=await s
    .from('target_versions')
    .select('id,published_at,created_at')
    .order('published_at',{ascending:false,nullsFirst:false})
    .order('created_at',{ascending:false})
    .limit(1);
  if(versionError)throw Error(versionError.message);

  const versionId=versions?.[0]?.id??null;
  let targetQuery=s
    .from('learning_targets')
    .select('id,title,target_month,level_id,class_id,version_id')
    .eq('active',true)
    .eq('target_month',month)
    .order('sort_order');

  targetQuery=versionId
    ? targetQuery.eq('version_id',versionId)
    : targetQuery.is('version_id',null);

  const [{data:targets,error:targetError},{data:members,error:memberError}]=await Promise.all([
    targetQuery,
    s.from('members')
      .select('id,name,member_memberships(id,active,valid_from,valid_to,ended_on,level_id,class_id,categories(slug))')
      .eq('status','ACTIVE')
  ]);
  if(targetError||memberError)throw Error((targetError||memberError)?.message||'Target tidak dapat dianalisis.');
  if(!targets?.length)return [];

  const ids=targets.map((t:any)=>t.id);
  const {data:progress,error:progressError}=await s
    .from('journal_progress')
    .select('target_id,participant_key,member_id,progress_value,created_at,journals!inner(state,journal_date,event_id,attendance_events(state,attendance_records(participant_key,status)))')
    .in('target_id',ids)
    .eq('journals.state','COMPLETED');
  if(progressError)throw Error(progressError.message);

  const assessedByTarget=new Map<string,Set<string>>();
  const seen=new Set<string>();
  for(const p of latestProgressRows<any>(progress||[])){
    const j=Array.isArray(p.journals)?p.journals[0]:p.journals;
    const e=Array.isArray(j?.attendance_events)?j.attendance_events[0]:j?.attendance_events;
    if(j?.state!=='COMPLETED'||(j.event_id&&(e?.state==='CANCELLED'||!e?.attendance_records?.some((r:any)=>r.participant_key===(p.participant_key||p.member_id)&&r.status==='H'))))continue;
    const key=p.target_id;
    const person=p.participant_key||p.member_id;
    if(!key||!person)continue;
    const identity=key+':'+person;if(seen.has(identity))continue;seen.add(identity);
    if(p.progress_value===null||p.progress_value===undefined||!Number.isFinite(Number(p.progress_value)))continue;
    if(!assessedByTarget.has(key))assessedByTarget.set(key,new Set());
    assessedByTarget.get(key)!.add(person);
  }

  const gaps:Gap[]=[];
  for(const t of targets){
    const eligible=(members||[]).filter((m:any)=>
      (m.member_memberships||[]).some((mm:any)=>
        effectiveMembership(mm,today) && ['caberawit','muda-mudi'].includes(mm.categories?.slug) &&
        (!t.level_id||mm.level_id===t.level_id) &&
        (!t.class_id||mm.class_id===t.class_id)
      )
    );
    const assessed=assessedByTarget.get(t.id)||new Set<string>();
    const missing=eligible.filter((m:any)=>!assessed.has(m.id)).length;
    if(missing>0){
      gaps.push({
        id:t.id,
        title:t.title,
        target_month:t.target_month,
        eligible:eligible.length,
        assessed:eligible.length-missing,
        missing,
        href:'/target'
      });
    }
  }
  return gaps;
}
