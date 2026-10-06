import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export async function GET(req:NextRequest){
  const s=await db();
  const resource=req.nextUrl.searchParams.get('resource')||null;
  const action=req.nextUrl.searchParams.get('action')||null;
  const {data,error}=await s.rpc('admin_list_audit_logs',{p_resource:resource,p_action:action,p_limit:200});
  if(error){
    const denied=/akses audit ditolak/i.test(error.message||'');
    return NextResponse.json({error:denied?'Akses audit hanya untuk Super Admin.':error.message},{status:denied?403:400});
  }
  return NextResponse.json(data||[],{headers:{'Cache-Control':'private, max-age=5, stale-while-revalidate=20'}});
}
