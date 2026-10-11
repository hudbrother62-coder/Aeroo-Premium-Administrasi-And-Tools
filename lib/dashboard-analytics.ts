import {effectiveMembership} from './domain';

type Row=Record<string,any>;
export type DashboardLevel={id:string;name:string;count:number;present:number;total:number;percentage:number|null};
export type DashboardBucket={label:string;meetings:number;present:number;total:number;percentage:number|null};
export type DashboardGroup={id:string;name:string;count:number;present:number;total:number;percentage:number|null};
export type DashboardAnalytics={
  month:string;span:1|3|6;selectedLevel:string;
  levels:DashboardLevel[];
  members:number;attendance:{meetings:number;present:number;excused:number;absent:number;pending:number;total:number;percentage:number|null};
  journals:number;targets:{count:number;assessed:number;percentage:number|null};
  trend:DashboardBucket[];distribution:DashboardGroup[];comparison:DashboardGroup[];
  targetByLevel:Array<{id:string;name:string;percentage:number|null;assessed:number}>;
};

export function isValidDashboardMonth(month:string){return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);}
function ratio(present:number,total:number){return total?Math.round(present/total*1000)/10:null;}
function stat(rows:Row[]){
  const present=rows.filter(r=>r.status==='H').length;
  const excused=rows.filter(r=>r.status==='I').length;
  const absent=rows.filter(r=>r.status==='A').length;
  const total=present+excused+absent;
  return {present,excused,absent,pending:rows.length-total,total,percentage:ratio(present,total)};
}
export function matchingRecords(event:Row,levelId:string){
  const rows:Array<Row>=event.attendance_records||[];
  return !levelId?rows:rows.filter(r=>r.level_id_snapshot===levelId||(!r.level_id_snapshot&&event.level_id===levelId));
}
export function matchesDashboardLevel(person:Row,levelId:string){
  if(!levelId)return true;
  const memberships:Array<Row>=(person.member_memberships||[]).filter((m:Row)=>effectiveMembership(m));
  return memberships.length?memberships.some(m=>m.level_id===levelId):person.level_id===levelId;
}
function eventInLevel(event:Row,levelId:string){
  return !levelId||event.level_id===levelId||matchingRecords(event,levelId).length>0;
}
function memberClass(person:Row,levelId:string){
  const memberships:Array<Row>=(person.member_memberships||[]).filter((m:Row)=>effectiveMembership(m)&&(!levelId||m.level_id===levelId)&&m.class_id);
  const best=memberships[0];
  return {id:String(best?.class_id||person.class_id||''),name:String(best?.classes?.name||person.classes?.name||'Tanpa kelas')};
}
function previousMonths(month:string,span:number){
  const year=Number(month.slice(0,4)),m=Number(month.slice(5,7));
  return Array.from({length:span},(_,i)=>new Date(Date.UTC(year,m-span+i,1)).toISOString().slice(0,7));
}
function compareGroup(id:string,name:string,people:Row[],rows:Row[]):DashboardGroup{
  const s=stat(rows);return {id,name,count:new Set(people.map(p=>p.id)).size,present:s.present,total:s.total,percentage:s.percentage};
}
export function buildDashboardAnalytics(input:{
  people:Row[];events:Row[];journals:Row[];levels:Row[];
  targets?:Row[];progress?:Row[];month:string;span:1|3|6;levelId?:string;
}):DashboardAnalytics{
  const {people,events,journals,month,span}=input;
  if(!isValidDashboardMonth(month))throw new Error('Bulan tidak valid.');
  const selectedLevel=input.levelId||'';
  const levels=(input.levels||[]).filter(l=>l.active!==false).map(l=>({id:String(l.id),name:String(l.name)}));
  if(selectedLevel&&!levels.some(l=>l.id===selectedLevel))throw new Error('Jenjang tidak ditemukan.');
  const months=previousMonths(month,span),first=months[0];
  const availableEvents=events.filter(e=>e.state!=='CANCELLED');
  const periodEvents=availableEvents.filter(e=>e.event_date?.slice(0,7)>=first&&e.event_date?.slice(0,7)<=month);
  const scopedEvents=periodEvents.filter(e=>eventInLevel(e,selectedLevel));
  const entries=scopedEvents.flatMap(e=>matchingRecords(e,selectedLevel));
  const attendance=stat(entries);
  const members=people.filter(p=>matchesDashboardLevel(p,selectedLevel));
  const periodJournals=journals.filter(j=>j.state==='COMPLETED'&&j.journal_date?.slice(0,7)>=first&&j.journal_date?.slice(0,7)<=month);
  const eventIndex=new Map(availableEvents.map(e=>[e.id,e]));
  const classIds=new Set(members.flatMap(p=>(p.member_memberships||[]).filter((m:Row)=>effectiveMembership(m)&&(!selectedLevel||m.level_id===selectedLevel)).map((m:Row)=>m.class_id).filter(Boolean)));
  const scopedJournals=selectedLevel?periodJournals.filter(j=>{
    const event=eventIndex.get(j.event_id);
    return event?eventInLevel(event,selectedLevel):Boolean(j.class_id&&classIds.has(j.class_id));
  }):periodJournals.filter(j=>!j.event_id||eventIndex.has(j.event_id));

  const allRows=(arr:Row[],levelId:string)=>arr.flatMap(e=>matchingRecords(e,levelId));
  const levelStats=levels.map(l=>{
    const scope=periodEvents.filter(e=>eventInLevel(e,l.id));
    const s=stat(allRows(scope,l.id));
    return {id:l.id,name:l.name,count:people.filter(p=>matchesDashboardLevel(p,l.id)).length,present:s.present,total:s.total,percentage:s.percentage};
  });
  const classKeys=new Map<string,{name:string;people:Row[]}>();
  for(const p of members){
    const c=memberClass(p,selectedLevel);const key=c.id||'__unassigned__';
    if(!classKeys.has(key))classKeys.set(key,{name:c.name,people:[]});
    classKeys.get(key)!.people.push(p);
  }
  const classes=[...classKeys].map(([id,c])=>{
    const rows=entries.filter(r=>(r.class_id_snapshot||'__unassigned__')===id);
    return compareGroup(id,c.name,c.people,rows);
  }).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'id'));
  const unassigned=people.filter(p=>!levels.some(l=>matchesDashboardLevel(p,l.id)));
  const distribution=selectedLevel?classes:([
    ...levelStats.map(l=>({id:l.id,name:l.name,count:l.count,present:l.present,total:l.total,percentage:l.percentage})),
    ...(unassigned.length?[{id:'__other__',name:'Tanpa jenjang',count:unassigned.length,present:0,total:0,percentage:null}]:[])
  ]).filter(x=>x.count>0||x.total>0);
  const comparison=selectedLevel?classes:levelStats.map(l=>({id:l.id,name:l.name,count:l.count,present:l.present,total:l.total,percentage:l.percentage}));
  const buckets:DashboardBucket[]=[];
  if(span===1){
    const year=Number(month.slice(0,4)),m=Number(month.slice(5,7));
    const days=new Date(Date.UTC(year,m,0)).getUTCDate();
    for(let day=1;day<=days;day+=7){
      const from=month+'-'+String(day).padStart(2,'0'),to=month+'-'+String(Math.min(days,day+6)).padStart(2,'0');
      const group=scopedEvents.filter(e=>e.event_date>=from&&e.event_date<=to);
      const s=stat(group.flatMap(e=>matchingRecords(e,selectedLevel)));
      buckets.push({label:day+'–'+Math.min(days,day+6),meetings:group.length,present:s.present,total:s.total,percentage:s.percentage});
    }
  }else{
    for(const key of months){
      const group=scopedEvents.filter(e=>e.event_date?.startsWith(key));
      const s=stat(group.flatMap(e=>matchingRecords(e,selectedLevel)));
      buckets.push({label:new Intl.DateTimeFormat('id-ID',{month:'short',timeZone:'UTC'}).format(new Date(key+'-01T00:00:00Z')),meetings:group.length,present:s.present,total:s.total,percentage:s.percentage});
    }
  }
  const permittedTargets=(input.targets||[]).filter(t=>t.active!==false&&(!selectedLevel||t.level_id===selectedLevel)&&(!t.target_month||t.target_month.slice(0,7)<=month));
  const targetMap=new Map(permittedTargets.map(t=>[t.id,t]));
  const memberSet=new Set(members.map(p=>p.id));
  const latest=new Map<string,Row>();
  for(const row of input.progress||[]){
    if(!targetMap.has(row.target_id)||!memberSet.has(row.member_id||row.participant_key)||row.progress_value===null)continue;
    const key=(row.member_id||row.participant_key)+':'+row.target_id;
    const old=latest.get(key);
    if(!old||String(row.created_at||'')>String(old.created_at||''))latest.set(key,row);
  }
  const score=(values:Row[])=>values.length?Math.round(values.reduce((n,r)=>n+Math.max(0,Math.min(100,Number(r.progress_value)||0)),0)/values.length*10)/10:null;
  const scored=[...latest.values()];
  const targetByLevel=levels.map(l=>{
    const values=scored.filter(r=>targetMap.get(r.target_id)?.level_id===l.id);
    return {id:l.id,name:l.name,percentage:score(values),assessed:values.length};
  });
  return {
    month,span,selectedLevel,levels:levelStats,
    members:members.length,
    attendance:{meetings:scopedEvents.length,...attendance},
    journals:scopedJournals.length,
    targets:{count:permittedTargets.length,assessed:scored.length,percentage:score(scored)},
    trend:buckets,distribution,comparison,targetByLevel
  };
}
