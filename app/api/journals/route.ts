import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase-server';

export async function GET(){
  const s=await db();
  const {data,error}=await s
    .from('journals')
    .select('*,activity_types(name),attendance_events(title,event_date)')
    .order('journal_date',{ascending:false});

  return error
    ? NextResponse.json({error:error.message},{status:400})
    : NextResponse.json(data);
}

export async function POST(req:NextRequest){
  const s=await db();
  const {data,error}=await s.from('journals').insert(await req.json()).select().single();

  return error
    ? NextResponse.json({error:error.message},{status:400})
    : NextResponse.json(data,{status:201});
}
