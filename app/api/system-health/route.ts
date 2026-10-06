import {NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export async function GET(){
  const s=await db();
  const {data:user,error:userError}=await s.rpc('get_current_app_user');
  const me=user?.[0];
  if(userError||me?.role!=='ADMIN')return NextResponse.json({error:'Akses ditolak.'},{status:403});

  const now=Date.now();
  const dayAgo=new Date(now-24*60*60*1000).toISOString();
  const weekAgo=new Date(now-7*24*60*60*1000).toISOString();

  const [imports,logins,audit,drafts,users]=await Promise.all([
    s.from('import_jobs').select('id,status',{count:'exact',head:true}).in('status',['FAILED','PARTIAL']).gte('created_at',weekAgo),
    s.from('login_history').select('id',{count:'exact',head:true}).eq('success',false).gte('created_at',dayAgo),
    s.from('audit_logs').select('id,created_at,action,resource_type').order('created_at',{ascending:false}).limit(1),
    s.from('journals').select('id',{count:'exact',head:true}).eq('state','DRAFT').lt('updated_at',weekAgo),
    s.rpc('list_app_users')
  ]);

  const firstError=[imports,logins,audit,drafts,users].find((x:any)=>x.error)?.error;
  if(firstError)return NextResponse.json({error:firstError.message},{status:500});

  const failedImports=imports.count||0;
  const failedLogins=logins.count||0;
  const staleDrafts=drafts.count||0;
  const activeUsers=(users.data||[]).filter((x:any)=>x.active).length;
  const lastAudit=audit.data?.[0]||null;

  return NextResponse.json({
    checked_at:new Date().toISOString(),
    summary:{
      database:'OK',
      active_users:activeUsers,
      failed_imports_7d:failedImports,
      failed_logins_24h:failedLogins,
      stale_drafts_7d:staleDrafts,
      audit_active:!!lastAudit
    },
    checks:[
      {key:'database',label:'Database',status:'OK',detail:'Koneksi dan query aplikasi aktif.'},
      {key:'audit',label:'Audit',status:lastAudit?'OK':'WARN',detail:lastAudit?('Aktivitas terakhir '+new Date(lastAudit.created_at).toLocaleString('id-ID')):'Belum ada audit activity.'},
      {key:'imports',label:'Import',status:failedImports?'WARN':'OK',detail:failedImports?failedImports+' import gagal/sebagian dalam 7 hari.':'Tidak ada import bermasalah dalam 7 hari.'},
      {key:'login',label:'Login',status:failedLogins>=5?'WARN':'OK',detail:failedLogins+' login gagal dalam 24 jam.'},
      {key:'drafts',label:'Draft Jurnal',status:staleDrafts?'WARN':'OK',detail:staleDrafts?staleDrafts+' draft belum diperbarui >7 hari.':'Tidak ada draft lama >7 hari.'}
    ]
  });
}
