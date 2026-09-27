import {NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export async function GET(){
  const s=await db();
  const start=new Date();start.setDate(1);
  const from=`${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-01`;
  const [members,events,journals,levels,categories]=await Promise.all([
    s.from('members').select('id,level_id,member_categories(categories(id,name))').eq('status','ACTIVE'),
    s.from('attendance_events').select('id,event_date,attendance_records(member_id,status)').gte('event_date',from),
    s.from('journals').select('id',{count:'exact',head:true}).gte('journal_date',from),
    s.from('levels').select('id,name').order('sort_order'),
    s.from('categories').select('id,name')
  ]);
  const error=members.error||events.error||journals.error||levels.error||categories.error;
  if(error)return NextResponse.json({error:error.message},{status:400});
  const rows=members.data??[];
  const byId=new Map(rows.map(m=>[m.id,m]));
  const attendance={meetings:(events.data??[]).length,present:0,excused:0,absent:0};
  const levelCounts=new Map((levels.data??[]).map(l=>[l.id,{...l,count:0,present:0,total:0}]));
  rows.forEach(m=>{if(m.level_id&&levelCounts.has(m.level_id))levelCounts.get(m.level_id)!.count++});
  for(const e of events.data??[])for(const r of e.attendance_records??[]){
    if(r.status==='H')attendance.present++;
    if(r.status==='I')attendance.excused++;
    if(r.status==='A')attendance.absent++;
    const member=r.member_id?byId.get(r.member_id):null;
    if(member?.level_id&&levelCounts.has(member.level_id)){
      const cell=levelCounts.get(member.level_id)!;cell.total++;if(r.status==='H')cell.present++;
    }
  }
  return NextResponse.json({members:rows.length,attendance,journals:journals.count??0,
    categories:(categories.data??[]).map(c=>({name:c.name,count:rows.filter(m=>m.member_categories?.some((mc:any)=>mc.categories?.id===c.id)).length})),
    levels:Array.from(levelCounts.values())});
}
