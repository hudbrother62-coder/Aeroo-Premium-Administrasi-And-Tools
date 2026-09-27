import {NextResponse} from 'next/server';
import {publicDb} from '@/lib/supabase-server';

export async function GET(){
  const {data,error}=await publicDb().rpc('viewer_overview');
  return error?NextResponse.json({error:'Ringkasan belum tersedia.'},{status:503}):NextResponse.json(data,{headers:{'Cache-Control':'public, max-age=60'}});
}
