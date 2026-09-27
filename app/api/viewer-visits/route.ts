import {NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export async function GET(){
  const s=await db();const {data:role}=await s.rpc('current_app_role');
  if(role!=='ADMIN')return NextResponse.json({error:'Akses owner diperlukan.'},{status:403});
  const {data,error}=await s.rpc('list_viewer_visits');
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data??[]);
}
