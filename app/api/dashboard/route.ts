import {NextRequest,NextResponse} from 'next/server';
import {publicDashboard} from '@/lib/public-read';
import {db} from '@/lib/supabase-server';
import {jakartaDate} from '@/lib/domain';
import {buildDashboardAnalytics,isValidDashboardMonth} from '@/lib/dashboard-analytics';

export const dynamic='force-dynamic';

type Snapshot={role:string;people:any[];events:any[];journals:any[];targets:any[];progress:any[];levels:any[];classes:any[]};
export async function GET(req:NextRequest){
  const month=req.nextUrl.searchParams.get('month')||jakartaDate().slice(0,7);
  const span=Number(req.nextUrl.searchParams.get('span')||1);
  const levelId=req.nextUrl.searchParams.get('level_id')||'';
  if(!isValidDashboardMonth(month)||![1,3,6].includes(span)||levelId&&!/^[0-9a-f-]{36}$/i.test(levelId))
    return NextResponse.json({error:'Filter dashboard tidak valid.'},{status:400});
  try{
    const s=await db();
    const {data:role,error:roleError}=await s.rpc('current_app_role');
    if(roleError)throw roleError;
    if(!role||role==='VIEWER')
      return NextResponse.json(await publicDashboard(req),{headers:{'Cache-Control':'private, no-store'}});
    // All heavy scans are performed once in the bounded, permission-aware SQL snapshot.
    // Tasks are deliberately fetched from a separate route so their failure is nonfatal.
    const {data,error}=await s.rpc('dashboard_scope_snapshot_v1',{p_month:month,p_span:span});
    if(error)throw error;
    const snapshot=data as Snapshot|null;
    if(!snapshot||!Array.isArray(snapshot.events)||!Array.isArray(snapshot.people))throw new Error('Snapshot tidak lengkap.');
    const analytics=buildDashboardAnalytics({
      people:snapshot.people,events:snapshot.events,journals:snapshot.journals||[],
      levels:snapshot.levels||[],classes:snapshot.classes||[],
      targets:snapshot.targets||[],progress:snapshot.progress||[],
      month,span:span as 1|3|6,levelId
    });
    return NextResponse.json({...analytics,role:snapshot.role},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    console.error('[dashboard] analytics request failed',error);
    return NextResponse.json({error:'Data analisis belum bisa dimuat. Coba segarkan grafik.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
