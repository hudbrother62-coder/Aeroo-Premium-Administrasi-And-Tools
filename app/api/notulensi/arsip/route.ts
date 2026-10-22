import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
export async function GET(req:NextRequest){
 try{
  const month=req.nextUrl.searchParams.get('month');
  if(month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    return NextResponse.json({error:'Bulan tidak valid.'},{status:400});
  const s=await db();
  let query=s.from('meeting_minutes_archives')
   .select('id,title,meeting_type,meeting_month,meeting_date,date_status,requires_review,source_tab_title,source_heading,source_url,source_text,source_blocks,sections')
   .order('meeting_month',{ascending:false});
  if(month)query=query.eq('meeting_month',month);
  const {data,error}=await query;
  if(error)return NextResponse.json({error:'Arsip notulensi tidak tersedia.'},{status:400});
  return NextResponse.json(data||[],{headers:{'Cache-Control':'private, no-store'}});
 }catch{
  return NextResponse.json({error:'Gagal membaca arsip notulensi.'},{status:500});
 }
}
