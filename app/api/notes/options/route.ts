import {NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

const audiences=['KELOMPOK','CABERAWIT','MUDA_MUDI','IBU_IBU','PENGURUS'] as const;

export async function GET(){
 const s=await db();
 const {data:uid}=await s.rpc('current_app_user_id');
 if(!uid)return NextResponse.json({error:'Login diperlukan.'},{status:401});

 const [members,events,agenda,classes,journals,globalChecks]=await Promise.all([
  s.from('members').select('id,name,class_id,level_id').eq('status','ACTIVE').order('name').limit(150),
  s.from('attendance_events').select('id,title,event_date,audience,class_id,classes(name)').order('event_date',{ascending:false}).limit(100),
  s.from('agenda').select('id,title,starts_at,audience,class_id,classes(name)').neq('status','CANCELLED').order('starts_at',{ascending:false}).limit(100),
  s.from('classes').select('id,name,audience').eq('active',true).order('sort_order').order('name'),
  s.from('journals').select('id,title,journal_date,journal_kind,class_id,classes(name)').neq('state','ARCHIVED').order('journal_date',{ascending:false}).limit(100),
  Promise.all(audiences.map(async audience=>({audience,read:(await s.rpc('can_read_audience_global',{p_audience:audience})).data===true})))
 ]);
 const firstError=members.error||events.error||agenda.error||classes.error||journals.error;
 if(firstError)return NextResponse.json({error:firstError.message},{status:400});
 return NextResponse.json({
  members:members.data||[],
  events:events.data||[],
  agenda:agenda.data||[],
  classes:classes.data||[],
  journals:journals.data||[],
  audiences:globalChecks.filter(x=>x.read).map(x=>x.audience)
 },{headers:{'Cache-Control':'private, max-age=30'}});
}
