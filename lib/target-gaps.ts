import 'server-only';

type Gap={
  id:string;
  title:string;
  target_month:string|null;
  eligible:number;
  assessed:number;
  missing:number;
  href:string;
};

function effective(m:any,today:string){
  return !!m.active &&
    (!m.valid_from||m.valid_from<=today) &&
    (!m.valid_to||m.valid_to>=today) &&
    (!m.ended_on||m.ended_on>today);
}

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
      .select('id,name,member_memberships(id,active,valid_from,valid_to,ended_on,level_id,class_id)')
      .eq('status','ACTIVE')
  ]);
  if(targetError||memberError)throw Error((targetError||memberError)?.message||'Target tidak dapat dianalisis.');
  if(!targets?.length)return [];

  const ids=targets.map((t:any)=>t.id);
  const {data:progress,error:progressError}=await s
    .from('journal_progress')
    .select('target_id,participant_key,member_id,journals!inner(state)')
    .in('target_id',ids)
    .eq('journals.state','COMPLETED');
  if(progressError)throw Error(progressError.message);

  const assessedByTarget=new Map<string,Set<string>>();
  for(const p of progress||[]){
    const key=p.target_id;
    const person=p.participant_key||p.member_id;
    if(!key||!person)continue;
    if(!assessedByTarget.has(key))assessedByTarget.set(key,new Set());
    assessedByTarget.get(key)!.add(person);
  }

  const gaps:Gap[]=[];
  for(const t of targets){
    const eligible=(members||[]).filter((m:any)=>
      (m.member_memberships||[]).some((mm:any)=>
        effective(mm,today) &&
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
