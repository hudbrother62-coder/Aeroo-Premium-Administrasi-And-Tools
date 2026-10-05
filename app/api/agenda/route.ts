import {saveAgenda} from '@/lib/agenda-save';
import {publicProjection} from '@/lib/public-read';
import { NextRequest, NextResponse } from 'next/server';import { db } from '@/lib/supabase-server';
export async function GET(req:NextRequest){const projection=await publicProjection(req,'agenda');if(projection)return projection;const s=await db();const from=req.nextUrl.searchParams.get('from');const to=req.nextUrl.searchParams.get('to');let q=s.from('agenda').select('*,activity_types(id,name,audience)').order('starts_at');if(from)q=q.gte('starts_at',from);if(to)q=q.lte('starts_at',to);const{data,error}=await q;return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data??[])}
export async function POST(req:NextRequest){return saveAgenda(req,null)}
