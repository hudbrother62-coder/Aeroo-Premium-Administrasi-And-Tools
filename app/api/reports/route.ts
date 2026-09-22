import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase-server';

export async function GET(req:NextRequest){
  const from=req.nextUrl.searchParams.get('from');
  const to=req.nextUrl.searchParams.get('to');
  const audience=req.nextUrl.searchParams.get('audience');

  if(!from||!to){
    return NextResponse.json({error:'from dan to wajib diisi'},{status:400});
  }

  const s=await db();
  let q=s
    .from('attendance_events')
    .select('id,title,event_date,audience,level_id,attendance_records(id,status,member_id,caberawit_id)')
    .gte('event_date',from)
    .lte('event_date',to)
    .order('event_date');

  if(audience) q=q.eq('audience',audience);

  const {data,error}=await q;
  if(error) return NextResponse.json({error:error.message},{status:400});

  const totals={H:0,I:0,A:0};
  data?.forEach(event=>{
    event.attendance_records?.forEach(record=>{
      if(record.status==='H'||record.status==='I'||record.status==='A'){
        totals[record.status]+=1;
      }
    });
  });

  return NextResponse.json({
    period:{from,to},
    events:data??[],
    summary:{meetings:data?.length??0,...totals}
  });
}
