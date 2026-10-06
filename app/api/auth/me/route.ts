import {NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {readScopesForRole,writeScopesForRole,type Audience} from '@/lib/access';

export async function GET(){
  const supabase=await db();
  const {data,error}=await supabase.rpc('get_current_app_user');
  if(error||!data?.length)return NextResponse.json({id:null,username:'publik',display_name:'Viewer publik',role:'VIEWER',public:true,active:true,read_scopes:readScopesForRole('VIEWER'),write_scopes:[],permissions:{}},{headers:{'Cache-Control':'private, max-age=10'}});
  const me=data[0];
  const [scopes,perms]=await Promise.all([
    supabase.from('user_audience_scopes').select('audience,can_read,can_write').eq('user_id',me.id),
    supabase.from('user_permissions').select('permission,allowed').eq('user_id',me.id)
  ]);
  const explicit=scopes.data||[];
  const read_scopes:Audience[]=explicit.length?explicit.filter((x:any)=>x.can_read).map((x:any)=>x.audience):readScopesForRole(me.role);
  const write_scopes:Audience[]=explicit.length?explicit.filter((x:any)=>x.can_write).map((x:any)=>x.audience):writeScopesForRole(me.role);
  return NextResponse.json({...me,read_scopes,write_scopes,permissions:Object.fromEntries((perms.data||[]).map((x:any)=>[x.permission,x.allowed]))},{headers:{'Cache-Control':'private, max-age=10'}});
}
