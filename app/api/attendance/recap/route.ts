import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

type AttendanceStatus='H'|'I'|'A';
const slugByAudience:Record<string,string>={CABERAWIT:'caberawit',MUDA_MUDI:'muda-mudi',IBU_IBU:'ibu-ibu',PENGURUS:'pengurus'};

export async function GET(req:NextRequest){
  const s=await db();
  const month=req.nextUrl.searchParams.get('month')||new Date().toISOString().slice(0,7);
  const audience=req.nextUrl.searchParams.get('audience')||'';
  const classId=req.nextUrl.searchParams.get('class_id')||'';
  const year=Number(month.slice(0,4)),mon=Number(month.slice(5,7));
  const days=new Date(year,mon,0).getDate();
  const from=month+'-01',to=month+'-'+String(days).padStart(2,'0');

  let memberQ=s.from('members').select('id,name,class_id,classes(name),levels(name),member_categories(categories(slug,name))').eq('status','ACTIVE').order('name');
  if(classId)memberQ=memberQ.eq('class_id',classId);
  const members=await memberQ;
  if(members.error)return NextResponse.json({error:members.error.message},{status:400});

  const slug=slugByAudience[audience];
  const people=(members.data??[]).filter((x:any)=>!slug||x.member_categories?.some((c:any)=>c.categories?.slug===slug));
  const map=new Map<string,any>(people.map((p:any)=>[p.id,{id:p.id,name:p.name,class_name:p.classes?.name??'',level_name:p.levels?.name??'',H:0,I:0,A:0,total:0,percentage:0}]));

  let eventQ=s.from('attendance_events').select('id,title,event_date,audience,class_id,attendance_records(member_id,status)').gte('event_date',from).lte('event_date',to).order('event_date');
  if(audience)eventQ=eventQ.eq('audience',audience);
  if(classId)eventQ=eventQ.eq('class_id',classId);
  const events=await eventQ;
  if(events.error)return NextResponse.json({error:events.error.message},{status:400});

  const eventDates:Record<string,number>={};
  const summary:Record<AttendanceStatus,number>={H:0,I:0,A:0};
  for(const e of events.data??[]){
    eventDates[e.event_date]=(eventDates[e.event_date]??0)+1;
    for(const r of e.attendance_records??[]){
      if(!r.member_id||!map.has(r.member_id))continue;
      if(r.status==='H'||r.status==='I'||r.status==='A'){
        const status=r.status as AttendanceStatus;
        map.get(r.member_id)[status]++;
        summary[status]++;
      }
    }
  }
  const individuals=Array.from(map.values()).map((p:any)=>{
    p.total=p.H+p.I+p.A;
    p.percentage=p.total?Math.round((p.H/p.total)*1000)/10:0;
    return p;
  });
  const calendar=Array.from({length:days},(_,i)=>{
    const date=month+'-'+String(i+1).padStart(2,'0');
    return {date,events:eventDates[date]??0,recorded:Boolean(eventDates[date])};
  });

  return NextResponse.json({month,audience,class_id:classId,summary:{...summary,meetings:(events.data??[]).length},individuals,calendar});
}
