import {NextRequest,NextResponse} from 'next/server';
import {publicDashboard} from '@/lib/public-read';
export async function GET(req:NextRequest){try{return NextResponse.json(await publicDashboard(req))}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Ringkasan belum tersedia.'},{status:400})}}
