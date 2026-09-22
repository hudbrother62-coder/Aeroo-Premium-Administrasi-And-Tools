import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase-server';

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const s=await db();
  const body=await req.json();
  const records=body.records;
  delete body.records;

  if(Object.keys(body).length){
    const {error}=await s.from('attendance_events').update(body).eq('id',id);
    if(error) return NextResponse.json({error:error.message},{status:400});
  }

  if(records){
    const {error:del}=await s.from('attendance_records').delete().eq('event_id',id);
    if(del) return NextResponse.json({error:del.message},{status:400});

    if(records.length){
      const {error:ins}=await s.from('attendance_records').insert(
        records.map((r:Record<string,unknown>)=>({...r,event_id:id}))
      );
      if(ins) return NextResponse.json({error:ins.message},{status:400});
    }
  }

  const {data,error}=await s
    .from('attendance_events')
    .select('*,attendance_records(*)')
    .eq('id',id)
    .single();

  return error
    ? NextResponse.json({error:error.message},{status:400})
    : NextResponse.json(data);
}
