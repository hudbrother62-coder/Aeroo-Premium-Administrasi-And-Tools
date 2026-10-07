import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

const audiences=['KELOMPOK','CABERAWIT','MUDA_MUDI','IBU_IBU','PENGURUS'] as const;
const permissions=['person.read','person.write','agenda.read','agenda.write','attendance.read','attendance.write','journal.read','journal.write','target.read','target.write','position.read','position.write','decision.write','report.read','report.publish','import.manage','archive.manage','user.manage','settings.manage','note.read','note.write'] as const;

export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;const s=await db();const {data:me}=await s.rpc('get_current_app_user');
  if(me?.[0]?.role!=='ADMIN')return NextResponse.json({error:'Akses ditolak.'},{status:403});
  const [scopes,perms,classScope,classes]=await Promise.all([
    s.from('user_audience_scopes').select('audience,can_read,can_write').eq('user_id',id).order('audience'),
    s.from('user_permissions').select('permission,allowed').eq('user_id',id).order('permission'),
    s.from('user_class_scopes').select('class_id,can_read,can_write,classes(name,audience)').eq('user_id',id).maybeSingle(),
    s.from('classes').select('id,name,audience,active').eq('audience','CABERAWIT').eq('active',true).order('sort_order').order('name')
  ]);
  const firstError=scopes.error||perms.error||classScope.error||classes.error;
  if(firstError)return NextResponse.json({error:firstError.message},{status:400});
  return NextResponse.json({scopes:scopes.data||[],permissions:perms.data||[],class_scope:classScope.data||null,caberawit_classes:classes.data||[],audiences,available_permissions:permissions});
}

export async function PUT(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;const s=await db();const {data:me}=await s.rpc('get_current_app_user');
  if(me?.[0]?.role!=='ADMIN')return NextResponse.json({error:'Akses ditolak.'},{status:403});
  const b=await req.json();
  const scopes=Array.isArray(b.scopes)?b.scopes.filter((x:any)=>audiences.includes(x.audience)):null;
  const perms=Array.isArray(b.permissions)?b.permissions.filter((x:any)=>permissions.includes(x.permission)):null;
  if(!scopes||!perms)return NextResponse.json({error:'Payload akses tidak valid.'},{status:400});
  const normalizedScopes=scopes.map((x:any)=>({audience:x.audience,can_read:!!x.can_read,can_write:!!x.can_write}));
  const normalizedPerms=perms.map((x:any)=>({permission:x.permission,allowed:!!x.allowed}));
  const classScope=b.class_scope&&typeof b.class_scope==='object'?{
    class_id:b.class_scope.class_id||null,
    can_read:!!b.class_scope.can_read,
    can_write:!!b.class_scope.can_write
  }:null;
  const {data,error}=await s.rpc('admin_save_user_access_v2',{
    p_user_id:id,
    p_scopes:normalizedScopes,
    p_permissions:normalizedPerms,
    p_class_scope:classScope
  });
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true,...(data||{})});
}
