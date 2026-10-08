import {NextRequest,NextResponse} from 'next/server';
import {attendanceReport} from '@/lib/attendance-report';
export const runtime='nodejs';
export async function GET(req:NextRequest) {
  try {
    const d=await attendanceReport(req);
    return NextResponse.json({
      period:d.period, audience:d.audience, events:d.rows, details:d.details, summary:d.summary,
    },{headers:{'Cache-Control':'no-store'}});
  } catch(e) {
    const error=e as Error & {status?:number};
    return NextResponse.json({error:error.message||'Laporan tidak dapat dibuat.'},{status:error.status||400});
  }
}
