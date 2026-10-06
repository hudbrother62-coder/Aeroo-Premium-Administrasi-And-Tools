import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export async function GET(req:NextRequest){
  const s=await db();
  const {data:user}=await s.rpc('get_current_app_user');
  if(user?.[0]?.role!=='ADMIN')return NextResponse.json({error:'Akses ditolak.'},{status:403});
  const resource=req.nextUrl.searchParams.get('resource')||'';
  const action=req.nextUrl.searchParams.get('action')||'';
  let query=s.from('audit_logs').select('id,actor_user_id,action,resource_type,resource_id,before_data,after_data,metadata,created_at,app_users(display_name,username)').order('created_at',{ascending:false}).limit(200);
  if(resource)query=query.eq('resource_type',resource);
  if(action)query=query.eq('action',action);
  const {data,error}=await query;
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data||[]);
}
