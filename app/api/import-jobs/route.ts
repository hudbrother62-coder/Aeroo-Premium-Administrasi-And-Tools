import {NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export async function GET(){
  const s=await db();
  const {data:user}=await s.rpc('get_current_app_user');
  if(!user?.length)return NextResponse.json({error:'Akses ditolak.'},{status:401});
  const {data,error}=await s.from('import_jobs').select('*').order('created_at',{ascending:false}).limit(50);
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data||[]);
}
