import {NextRequest,NextResponse} from 'next/server';
import {publicDb} from '@/lib/supabase-server';

export async function GET(req:NextRequest){
  const month=req.nextUrl.searchParams.get('month')??new Date().toISOString().slice(0,7);
  const span=req.nextUrl.searchParams.get('span')==='6'?6:1;
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return NextResponse.json({error:'Bulan tidak valid.'},{status:400});
  const {data,error}=await publicDb().rpc('viewer_recap',{p_month:month+'-01',p_span:span});
  return error?NextResponse.json({error:'Rekap belum tersedia.'},{status:503}):NextResponse.json(data,{headers:{'Cache-Control':'public, max-age=60'}});
}
