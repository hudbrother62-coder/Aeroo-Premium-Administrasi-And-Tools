import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export async function GET(req:NextRequest){
  const type=req.nextUrl.searchParams.get('type');
  const id=req.nextUrl.searchParams.get('id');
  if(!id||!type)return NextResponse.json({error:'Parameter tidak lengkap.'},{status:400});

  const s=await db();
  const {data:user}=await s.rpc('get_current_app_user');
  if(user?.[0]?.role!=='ADMIN')return NextResponse.json({error:'Akses ditolak.'},{status:403});

  if(type==='member'){
    const [member,attendance,progress,journals,positions,memberships]=await Promise.all([
      s.from('members').select('id,name,status').eq('id',id).single(),
      s.from('attendance_records').select('id',{count:'exact',head:true}).eq('member_id',id),
      s.from('journal_progress').select('id',{count:'exact',head:true}).or('member_id.eq.'+id+',participant_key.eq.'+id),
      s.from('journals').select('id',{count:'exact',head:true}).eq('member_id',id),
      s.from('organizational_positions').select('id',{count:'exact',head:true}).eq('member_id',id),
      s.from('member_memberships').select('id',{count:'exact',head:true}).eq('member_id',id)
    ]);
    const err=[member,attendance,progress,journals,positions,memberships].find((x:any)=>x.error)?.error;
    if(err)return NextResponse.json({error:err.message},{status:400});

    const dependencies=[
      {key:'attendance',label:'Presensi',count:attendance.count||0,blocking:(attendance.count||0)>0},
      {key:'progress',label:'Progres',count:progress.count||0,blocking:(progress.count||0)>0},
      {key:'journals',label:'Jurnal individu',count:journals.count||0,blocking:(journals.count||0)>0},
      {key:'positions',label:'Riwayat jabatan',count:positions.count||0,blocking:(positions.count||0)>0},
      {key:'memberships',label:'Riwayat keikutsertaan',count:memberships.count||0,blocking:false}
    ];
    return NextResponse.json({
      type,
      id,
      title:member.data?.name||'Anggota',
      archived:member.data?.status==='INACTIVE',
      can_permanent_delete:member.data?.status==='INACTIVE'&&!dependencies.some(x=>x.blocking),
      dependencies
    });
  }

  if(type==='journal'){
    const [journal,progress,revisions,decisions,attachments]=await Promise.all([
      s.from('journals').select('id,title,state,revision').eq('id',id).single(),
      s.from('journal_progress').select('id',{count:'exact',head:true}).eq('journal_id',id),
      s.from('journal_revisions').select('id',{count:'exact',head:true}).eq('journal_id',id),
      s.from('meeting_decisions').select('id',{count:'exact',head:true}).eq('journal_id',id),
      s.from('journal_attachments').select('id',{count:'exact',head:true}).eq('journal_id',id)
    ]);
    const err=[journal,progress,revisions,decisions,attachments].find((x:any)=>x.error)?.error;
    if(err)return NextResponse.json({error:err.message},{status:400});

    return NextResponse.json({
      type,
      id,
      title:journal.data?.title||'Jurnal',
      archived:journal.data?.state==='ARCHIVED',
      revision:journal.data?.revision??0,
      can_permanent_delete:false,
      dependencies:[
        {key:'progress',label:'Progres',count:progress.count||0,blocking:true},
        {key:'revisions',label:'Riwayat revisi',count:revisions.count||0,blocking:true},
        {key:'decisions',label:'Keputusan',count:decisions.count||0,blocking:true},
        {key:'attachments',label:'Dokumentasi',count:attachments.count||0,blocking:true}
      ]
    });
  }

  return NextResponse.json({error:'Jenis arsip tidak didukung.'},{status:400});
}
