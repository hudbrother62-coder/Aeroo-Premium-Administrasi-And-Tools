import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase-server';

export async function GET(req:NextRequest){
  const s=await db();
  const from=req.nextUrl.searchParams.get('from');
  const to=req.nextUrl.searchParams.get('to');

  let q=s
    .from('attendance_events')
    .select('*,attendance_records(*)')
    .order('event_date',{ascending:false});

  if(from) q=q.gte('event_date',from);
  if(to) q=q.lte('event_date',to);

  const {data,error}=await q;
  return error
    ? NextResponse.json({error:error.message},{status:400})
    : NextResponse.json(data);
}

export async function POST(req:NextRequest){
  const s=await db();
  const {records,...event}=await req.json();

  const {data,error}=await s.from('attendance_events').insert(event).select().single();
  if(error) return NextResponse.json({error:error.message},{status:400});

  if(records?.length){
    const {error:recordError}=await s.from('attendance_records').insert(
      records.map((r:Record<string,unknown>)=>({...r,event_id:data.id}))
    );

    if(recordError){
      await s.from('attendance_events').delete().eq('id',data.id);
      return NextResponse.json({error:recordError.message},{status:400});
    }
  }

  return NextResponse.json(data,{status:201});
}
