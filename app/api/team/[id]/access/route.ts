import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

const audiences=['KELOMPOK','CABERAWIT','MUDA_MUDI','IBU_IBU','PENGURUS'] as const;
const permissions=['person.read','person.write','attendance.read','attendance.write','journal.read','journal.write','target.read','target.write','report.read','report.publish','archive.manage','user.manage','settings.manage'] as const;

export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;const s=await db();const {data:me}=await s.rpc('get_current_app_user');
  if(me?.[0]?.role!=='ADMIN')return NextResponse.json({error:'Akses ditolak.'},{status:403});
  const [scopes,perms]=await Promise.all([
    s.from('user_audience_scopes').select('audience,can_read,can_write').eq('user_id',id).order('audience'),
    s.from('user_permissions').select('permission,allowed').eq('user_id',id).order('permission')
  ]);
  if(scopes.error||perms.error)return NextResponse.json({error:(scopes.error||perms.error)?.message},{status:400});
  return NextResponse.json({scopes:scopes.data||[],permissions:perms.data||[],audiences,available_permissions:permissions});
}

export async function PUT(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;const s=await db();const {data:me}=await s.rpc('get_current_app_user');
  if(me?.[0]?.role!=='ADMIN')return NextResponse.json({error:'Akses ditolak.'},{status:403});
  const b=await req.json();
  const scopes=Array.isArray(b.scopes)?b.scopes.filter((x:any)=>audiences.includes(x.audience)):null;
  const perms=Array.isArray(b.permissions)?b.permissions.filter((x:any)=>permissions.includes(x.permission)):null;
  if(scopes){
    const del=await s.from('user_audience_scopes').delete().eq('user_id',id);if(del.error)return NextResponse.json({error:del.error.message},{status:400});
    if(scopes.length){const ins=await s.from('user_audience_scopes').insert(scopes.map((x:any)=>({user_id:id,audience:x.audience,can_read:!!x.can_read,can_write:!!x.can_write})));if(ins.error)return NextResponse.json({error:ins.error.message},{status:400})}
  }
  if(perms){
    const del=await s.from('user_permissions').delete().eq('user_id',id);if(del.error)return NextResponse.json({error:del.error.message},{status:400});
    if(perms.length){const ins=await s.from('user_permissions').insert(perms.map((x:any)=>({user_id:id,permission:x.permission,allowed:!!x.allowed})));if(ins.error)return NextResponse.json({error:ins.error.message},{status:400})}
  }
  return NextResponse.json({ok:true});
}
