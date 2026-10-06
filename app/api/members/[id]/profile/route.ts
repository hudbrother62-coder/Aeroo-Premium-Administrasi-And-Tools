import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const s=await db();
  const [person,attendance,journals,progress,positions]=await Promise.all([
    s.from('members').select('*,member_memberships(*,categories(id,name,slug),classes(id,name),levels(id,name))').eq('id',id).single(),
    s.from('attendance_records').select('id,status,notes,updated_at,event_id,attendance_events(id,title,event_date,audience,classes(name),levels(name))').eq('member_id',id).order('updated_at',{ascending:false}).limit(100),
    s.from('journals').select('id,title,journal_date,journal_kind,state,summary,notes').eq('member_id',id).order('journal_date',{ascending:false}).limit(100),
    s.from('journal_progress').select('id,target_id,progress_value,progress_note,assessment,follow_up,created_at,learning_targets(title,target_month)').eq('member_id',id).order('created_at',{ascending:false}).limit(100),
    s.from('organizational_positions').select('*').eq('member_id',id).order('valid_from',{ascending:false})
  ]);
  if(person.error)return NextResponse.json({error:'Anggota tidak ditemukan.'},{status:404});
  const other=[attendance,journals,progress,positions].find(x=>x.error)?.error;
  if(other)return NextResponse.json({error:other.message},{status:400});
  const rows=attendance.data||[];
  const counted=rows.filter((x:any)=>x.status!=null);
  const H=counted.filter((x:any)=>x.status==='H').length;
  const I=counted.filter((x:any)=>x.status==='I').length;
  const A=counted.filter((x:any)=>x.status==='A').length;
  return NextResponse.json({
    person:person.data,
    attendance:rows,
    attendance_summary:{H,I,A,total:counted.length,percentage:counted.length?Math.round(H/counted.length*1000)/10:null},
    journals:journals.data||[],
    progress:progress.data||[],
    positions:positions.data||[]
  });
}
