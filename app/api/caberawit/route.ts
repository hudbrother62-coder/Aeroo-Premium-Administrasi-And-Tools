import {NextRequest,NextResponse} from 'next/server';
import {GET as membersGET} from '../members/route';
export async function GET(req:NextRequest){req.nextUrl.searchParams.set('segment','CABERAWIT');return membersGET(req)}
export async function POST(){return NextResponse.json({error:'Gunakan database anggota terpadu /api/members.'},{status:410})}
