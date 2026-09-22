import {NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export async function GET(){
  const s=await db();
  const{data,error}=await s.from('login_history').select('id,username,success,user_agent,created_at').order('created_at',{ascending:false}).limit(100);
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data??[]);
}
