import {NextRequest,NextResponse} from 'next/server';
import {publicDb} from '@/lib/supabase-server';

export async function POST(req:NextRequest){
  const body=await req.json().catch(()=>({}));
  const name=typeof body.name==='string'?body.name:'';
  const agent=req.headers.get('user-agent')??'Unknown';
  const {error}=await publicDb().rpc('record_viewer_visit',{p_name:name,p_device:agent});
  return error?NextResponse.json({error:'Kunjungan belum tercatat.'},{status:503}):NextResponse.json({ok:true});
}
