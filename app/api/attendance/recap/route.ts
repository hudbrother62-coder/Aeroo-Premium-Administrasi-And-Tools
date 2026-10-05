import {NextRequest,NextResponse} from 'next/server';
import {publicRecap} from '@/lib/public-read';
export async function GET(req:NextRequest){try{return NextResponse.json(await publicRecap(req))}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Data tidak dapat dimuat.'},{status:400})}}
