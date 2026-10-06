import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

const esc=(s:string)=>s.replace(/[%_]/g,m=>'\\'+m);

export async function GET(req:NextRequest){
  const q=(req.nextUrl.searchParams.get('q')||'').trim();
  if(q.length<2)return NextResponse.json({groups:[]});
  const s=await db();
  const {data:user}=await s.rpc('get_current_app_user');
  if(!user?.length)return NextResponse.json({error:'Masuk untuk menggunakan pencarian.'},{status:401});
  const like='%'+esc(q)+'%';
  const [members,agenda,journals,notes,reports,positions]=await Promise.all([
    s.from('members').select('id,name,status').ilike('name',like).limit(8),
    s.from('agenda').select('id,title,starts_at,status,presenter,location').or(`title.ilike.${like},presenter.ilike.${like},location.ilike.${like}`).order('starts_at',{ascending:false}).limit(8),
    s.from('journals').select('id,title,journal_date,journal_kind,state').or(`title.ilike.${like},summary.ilike.${like},material.ilike.${like}`).order('journal_date',{ascending:false}).limit(8),
    s.from('personal_notes').select('id,title,updated_at,status').or(`title.ilike.${like},content.ilike.${like}`).order('updated_at',{ascending:false}).limit(8),
    s.from('report_snapshots').select('id,title,period_month,created_at').ilike('title',like).order('created_at',{ascending:false}).limit(8),
    s.from('organizational_positions').select('id,title,section,member_id,members(name)').or(`title.ilike.${like},section.ilike.${like}`).limit(8)
  ]);
  const bad=[members,agenda,journals,notes,reports,positions].find(x=>x.error);
  if(bad?.error)return NextResponse.json({error:bad.error.message},{status:400});
  const groups=[
    {type:'Anggota',items:(members.data||[]).map((x:any)=>({id:x.id,title:x.name,meta:x.status,href:'/database/'+x.id}))},
    {type:'Agenda',items:(agenda.data||[]).map((x:any)=>({id:x.id,title:x.title,meta:new Date(x.starts_at).toLocaleString('id-ID'),href:'/agenda?event='+x.id}))},
    {type:'Jurnal',items:(journals.data||[]).map((x:any)=>({id:x.id,title:x.title,meta:x.journal_date+' · '+x.journal_kind,href:'/jurnal/buat?journal_id='+x.id}))},
    {type:'Catatan',items:(notes.data||[]).map((x:any)=>({id:x.id,title:x.title,meta:'Catatan saya',href:'/catatan?note='+x.id}))},
    {type:'Laporan',items:(reports.data||[]).map((x:any)=>({id:x.id,title:x.title,meta:x.period_month,href:'/laporan?snapshot='+x.id}))},
    {type:'Pengurus',items:(positions.data||[]).map((x:any)=>({id:x.id,title:x.title,meta:(x.members as any)?.name||x.section,href:'/struktur?position='+x.id}))}
  ].filter(g=>g.items.length);
  return NextResponse.json({groups});
}
