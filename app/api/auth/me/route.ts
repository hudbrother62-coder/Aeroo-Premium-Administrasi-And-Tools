import {NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {readScopesForRole,writeScopesForRole,type Audience} from '@/lib/access';

export async function GET(){
  const supabase=await db();
  const {data,error}=await supabase.rpc('get_current_app_user');
  if(error||!data?.length)return NextResponse.json({id:null,username:'publik',display_name:'Viewer publik',role:'VIEWER',public:true,active:true,read_scopes:readScopesForRole('VIEWER'),write_scopes:[],permissions:{}},{headers:{'Cache-Control':'private, max-age=10'}});
  const me=data[0];
  const [scopes,perms,classScope]=await Promise.all([
    supabase.from('user_audience_scopes').select('audience,can_read,can_write').eq('user_id',me.id),
    supabase.from('user_permissions').select('permission,allowed').eq('user_id',me.id),
    supabase.from('user_class_scopes').select('class_id,can_read,can_write,classes(name)').eq('user_id',me.id).maybeSingle()
  ]);
  const explicit=scopes.data||[];
  const read_scopes:Audience[]=explicit.length?explicit.filter((x:any)=>x.can_read).map((x:any)=>x.audience):readScopesForRole(me.role);
  const write_scopes:Audience[]=explicit.length?explicit.filter((x:any)=>x.can_write).map((x:any)=>x.audience):writeScopesForRole(me.role);
  const classAccess=classScope.data as any;
  if(classAccess?.can_read&&!read_scopes.includes('CABERAWIT'))read_scopes.push('CABERAWIT');
  if(classAccess?.can_write&&!write_scopes.includes('CABERAWIT'))write_scopes.push('CABERAWIT');
  const globalCaberawit=explicit.some((x:any)=>x.audience==='CABERAWIT'&&x.can_read);
  const caberawit_access=globalCaberawit
    ?{mode:'GLOBAL',class_id:null,class_name:null}
    :classAccess?.class_id
      ?{mode:'CLASS',class_id:classAccess.class_id,class_name:classAccess.classes?.name||null}
      :{mode:'NONE',class_id:null,class_name:null};
  return NextResponse.json({...me,read_scopes,write_scopes,caberawit_access,permissions:Object.fromEntries((perms.data||[]).map((x:any)=>[x.permission,x.allowed]))},{headers:{'Cache-Control':'private, max-age=10'}});
}
