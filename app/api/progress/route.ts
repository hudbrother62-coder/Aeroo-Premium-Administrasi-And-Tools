import {NextRequest,NextResponse} from 'next/server';
import {readRows} from '@/lib/public-read';
export async function GET(req:NextRequest){const rows=await readRows('progress');const id=req.nextUrl.searchParams.get('member_id');return NextResponse.json(id?rows.filter(r=>r.member_id===id):rows)}
export async function POST(){return NextResponse.json({error:'Catat progres melalui jurnal pertemuan.'},{status:410})}
