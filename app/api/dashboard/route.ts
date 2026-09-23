import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

type AttendanceStatus='H'|'I'|'A';
function monthKey(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}

export async function GET(req:NextRequest){
  try{
    const s=await db();
    const levelId=req.nextUrl.searchParams.get('level_id');

    const start=new Date();
    start.setDate(1);
    start.setMonth(start.getMonth()-5);
    const startDate=monthKey(start)+'-01';

    const [members,events]=await Promise.all([
      s.from('members').select('id,status,level_id,member_categories(categories(slug))').eq('status','ACTIVE'),
      s.from('attendance_events').select('event_date,attendance_records(status,member_id)').gte('event_date',startDate).order('event_date')
    ]);

    if(members.error)throw members.error;
    if(events.error)throw events.error;

    const rows=members.data??[];
    const has=(x:any,slug:string)=>x.member_categories?.some((c:any)=>c.categories?.slug===slug);
    const selectedIds=levelId?new Set(rows.filter((x:any)=>x.level_id===levelId).map((x:any)=>x.id)):null;

    const trend:Record<string,{H:number;I:number;A:number}>={};
    for(let i=0;i<6;i++){
      const d=new Date(start.getFullYear(),start.getMonth()+i,1);
      trend[monthKey(d)]={H:0,I:0,A:0};
    }

    for(const e of events.data??[]){
      const k=String(e.event_date).slice(0,7);
      if(!trend[k])continue;
      for(const r of e.attendance_records??[]){
        if(selectedIds&&!selectedIds.has((r as any).member_id))continue;
        if(r.status==='H'||r.status==='I'||r.status==='A'){
          const status=r.status as AttendanceStatus;
          trend[k][status]++;
        }
      }
    }

    const nowKey=monthKey(new Date());
    const fmt=new Intl.DateTimeFormat('id-ID',{month:'short'});
    return NextResponse.json({
      total:rows.length,
      caberawit:rows.filter(x=>has(x,'caberawit')).length,
      mudaMudi:rows.filter(x=>has(x,'muda-mudi')).length,
      pengurus:rows.filter(x=>has(x,'pengurus')).length,
      month:trend[nowKey]??{H:0,I:0,A:0},
      trend:Object.entries(trend).map(([k,v])=>({label:fmt.format(new Date(k+'-01T00:00:00')),...v}))
    });
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Dashboard error'},{status:500});
  }
}
