import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  const levelId=req.nextUrl.searchParams.get('level_id')||null;
  if(levelId&&!/^[0-9a-f-]{36}$/i.test(levelId))
    return NextResponse.json({error:'Jenjang tidak valid.'},{status:400});
  try{
    const s=await db();
    const {data,error}=await s.rpc('dashboard_task_snapshot_v1',{p_level:levelId});
    if(error)throw error;
    if(!data)throw new Error('Feed kosong.');
    return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    console.error('[dashboard] task feed failed',error);
    return NextResponse.json({error:'Tindak lanjut sementara tidak tersedia.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
