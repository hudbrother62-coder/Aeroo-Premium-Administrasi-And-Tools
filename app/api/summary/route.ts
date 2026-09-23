import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

type AttendanceStatus='H'|'I'|'A';

export async function GET(req:NextRequest){
  const s=await db();
  const month=req.nextUrl.searchParams.get('month')||new Date().toISOString().slice(0,7);
  const year=Number(month.slice(0,4)),mon=Number(month.slice(5,7)),days=new Date(year,mon,0).getDate();
  const from=month+'-01',to=month+'-'+String(days).padStart(2,'0');

  const[members,events,journals]=await Promise.all([
    s.from('members').select('id,name,classes(name),levels(name),member_categories(categories(slug,name))').eq('status','ACTIVE').order('name'),
    s.from('attendance_events').select('id,event_date,attendance_records(member_id,status)').gte('event_date',from).lte('event_date',to),
    s.from('journals').select('id,member_id,journal_kind').gte('journal_date',from).lte('journal_date',to)
  ]);
  if(members.error||events.error||journals.error)return NextResponse.json({error:(members.error||events.error||journals.error)?.message},{status:400});

  const has=(m:any,slug:string)=>m.member_categories?.some((c:any)=>c.categories?.slug===slug);
  const rows=(members.data??[]).map((m:any)=>({id:m.id,name:m.name,categories:m.member_categories?.map((c:any)=>c.categories?.name).filter(Boolean)??[],class_name:m.classes?.name??'',level_name:m.levels?.name??'',H:0,I:0,A:0,percentage:0,journals:0}));
  const map=new Map(rows.map(x=>[x.id,x]));
  const attendance:{H:number;I:number;A:number;meetings:number}={H:0,I:0,A:0,meetings:events.data?.length??0};

  for(const e of events.data??[])for(const r of e.attendance_records??[]){
    if(r.status!=='H'&&r.status!=='I'&&r.status!=='A')continue;
    const status=r.status as AttendanceStatus;
    attendance[status]++;
    const p=map.get(r.member_id);
    if(p)p[status]++;
  }
  for(const j of journals.data??[]){if(j.member_id&&map.has(j.member_id))map.get(j.member_id)!.journals++}
  for(const p of rows){const total=p.H+p.I+p.A;p.percentage=total?Math.round(p.H/total*1000)/10:0}

  return NextResponse.json({
    month,
    counts:{
      total:members.data?.length??0,
      caberawit:(members.data??[]).filter((x:any)=>has(x,'caberawit')).length,
      muda_mudi:(members.data??[]).filter((x:any)=>has(x,'muda-mudi')).length,
      pengurus:(members.data??[]).filter((x:any)=>has(x,'pengurus')).length,
      ibu_ibu:(members.data??[]).filter((x:any)=>has(x,'ibu-ibu')).length
    },
    attendance,journals:journals.data?.length??0,individuals:rows
  });
}
