import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

function jakartaDate(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
function key(...parts:Array<string|number|null|undefined>){return parts.filter(v=>v!==null&&v!==undefined).join(':')}

export async function GET(){
  const s=await db();
  const {data:user,error:uErr}=await s.rpc('get_current_app_user');
  const me=user?.[0];
  if(uErr||!me)return NextResponse.json({error:'Masuk untuk melihat notifikasi.'},{status:401});
  const today=jakartaDate();
  const now=new Date();
  const soon=new Date(now.getTime()+36*60*60*1000).toISOString();
  const [agenda,events,journals,decisions,imports,reads]=await Promise.all([
    s.from('agenda').select('id,title,starts_at,status').gte('starts_at',now.toISOString()).lte('starts_at',soon).neq('status','CANCELLED').order('starts_at').limit(20),
    s.from('attendance_events').select('id,title,event_date,state,attendance_records(status)').gte('event_date',today).limit(30),
    s.from('journals').select('id,title,journal_date,journal_kind,state').eq('state','DRAFT').order('journal_date',{ascending:false}).limit(30),
    s.from('meeting_decisions').select('id,decision,deadline,status,journal_id').lt('deadline',today).neq('status','COMPLETED').neq('status','CANCELLED').order('deadline').limit(30),
    s.from('import_jobs').select('id,resource_type,file_name,status,error_rows,created_at').in('status',['FAILED','PARTIAL']).order('created_at',{ascending:false}).limit(20),
    s.from('notification_reads').select('notification_key').eq('user_id',me.id)
  ]);
  const readSet=new Set((reads.data||[]).map((x:any)=>x.notification_key));
  const items:any[]=[];
  for(const a of agenda.data||[]){
    const k=key('agenda',a.id,a.starts_at);
    items.push({key:k,kind:'AGENDA',title:'Agenda segera dimulai',detail:a.title,href:'/agenda?event='+a.id,created_at:a.starts_at,read:readSet.has(k)});
  }
  for(const e of events.data||[]){
    const rows=(e as any).attendance_records||[];
    if(rows.some((r:any)=>r.status==null)){
      const k=key('attendance',e.id,e.event_date);
      items.push({key:k,kind:'PRESENSI',title:'Presensi belum lengkap',detail:e.title,href:'/presensi/buat?event_id='+e.id,created_at:e.event_date,read:readSet.has(k)});
    }
  }
  for(const j of journals.data||[]){
    const k=key('journal',j.id,j.state);
    items.push({key:k,kind:'JURNAL',title:'Jurnal belum selesai',detail:j.title,href:'/jurnal/buat?journal_id='+j.id,created_at:j.journal_date,read:readSet.has(k)});
  }
  for(const d of decisions.data||[]){
    const k=key('decision',d.id,d.deadline);
    items.push({key:k,kind:'TINDAK_LANJUT',title:'Tindak lanjut terlambat',detail:d.decision,href:'/jurnal/buat?journal_id='+d.journal_id,created_at:d.deadline,read:readSet.has(k)});
  }
  for(const j of imports.data||[]){
    const k=key('import',j.id,j.status);
    items.push({key:k,kind:'IMPORT',title:j.status==='FAILED'?'Import gagal':'Import perlu diperiksa',detail:j.file_name||j.resource_type,href:'/impor',created_at:j.created_at,read:readSet.has(k)});
  }
  items.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  return NextResponse.json({items,unread:items.filter(x=>!x.read).length});
}

export async function POST(req:NextRequest){
  const s=await db();
  const {data:user}=await s.rpc('get_current_app_user');
  const me=user?.[0];
  if(!me)return NextResponse.json({error:'Akses ditolak.'},{status:401});
  const body=await req.json();
  const keys=Array.isArray(body.keys)?body.keys.filter((x:any)=>typeof x==='string'&&x.length<=250):[];
  if(!keys.length)return NextResponse.json({ok:true});
  const rows=keys.map((notification_key:string)=>({user_id:me.id,notification_key}));
  const {error}=await s.from('notification_reads').upsert(rows,{onConflict:'user_id,notification_key'});
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json({ok:true});
}
