import 'server-only';
import {NextRequest} from 'next/server';
import {db} from './supabase-server';
import {validDate} from './domain';

type AttendanceRecord = {
  id: string;
  status: string | null;
  participant_key: string | null;
  member_id: string | null;
  member_name_snapshot: string | null;
  class_name_snapshot: string | null;
  class_id_snapshot: string | null;
};
type AttendanceEvent = {
  id: string;
  title: string;
  event_date: string;
  audience: string;
  class_id: string | null;
  attendance_records: AttendanceRecord[] | null;
};
export type ReportDetail = {
  Tanggal: string;
  Kegiatan: string;
  Kategori: string;
  Kelas: string;
  Peserta: string;
  Status: string;
};
export type ReportEventRow = {
  Tanggal: string;
  Kegiatan: string;
  Kategori: string;
  Hadir: number;
  Izin: number;
  Alfa: number;
  'Belum absen': number;
  'Total peserta': number;
  'Kehadiran (%)': number | string;
};
export type ReportSummary = {
  meetings: number; H: number; I: number; A: number;
  pending: number; total: number; percentage: number | null;
};
const audiences = ['KELOMPOK','CABERAWIT','MUDA_MUDI','IBU_IBU','PENGURUS'];
export function checkedReportParams(from: string | null, to: string | null, audience: string | null) {
  if (!from || !to || !validDate(from) || !validDate(to) || from > to) {
    throw new Error('Rentang tanggal laporan tidak valid.');
  }
  const days = Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
  if (days > 366) throw new Error('Rentang laporan maksimal 367 hari; pecah periode untuk ekspor panjang.');
  if (audience && !audiences.includes(audience)) throw new Error('Kategori laporan tidak valid.');
  return {from, to, audience: audience || ''};
}
export function attendanceMetrics(records: Array<{status: string | null}>): Omit<ReportSummary,'meetings'> {
  const H=records.filter(r=>r.status==='H').length;
  const I=records.filter(r=>r.status==='I').length;
  const A=records.filter(r=>r.status==='A').length;
  const total=records.length;
  const pending=total-H-I-A;
  const percentage=H+I+A?Math.round(H/(H+I+A)*1000)/10:null;
  return {H,I,A,pending,total,percentage};
}
export function reportTables(events: AttendanceEvent[]) {
  const sorted=[...events].sort((a,b)=>a.event_date.localeCompare(b.event_date)||a.title.localeCompare(b.title));
  const rows: ReportEventRow[] = sorted.map(event=>{
    const m=attendanceMetrics(event.attendance_records||[]);
    return {'Tanggal':event.event_date,'Kegiatan':event.title,'Kategori':event.audience,
      'Hadir':m.H,'Izin':m.I,'Alfa':m.A,'Belum absen':m.pending,
      'Total peserta':m.total,'Kehadiran (%)':m.percentage===null?'Belum diisi':m.percentage};
  });
  const details: ReportDetail[]=sorted.flatMap(event=>(event.attendance_records||[]).map(record=>({
    'Tanggal':event.event_date,'Kegiatan':event.title,'Kategori':event.audience,
    'Kelas':record.class_name_snapshot||'-',
    'Peserta':record.member_name_snapshot||record.participant_key||'Tidak tercatat',
    'Status':record.status==='H'?'Hadir':record.status==='I'?'Izin':record.status==='A'?'Alfa':'Belum absen',
  })));
  const metrics=attendanceMetrics(sorted.flatMap(e=>e.attendance_records||[]));
  return {rows,details,summary:{meetings:sorted.length,...metrics}};
}
export async function attendanceReport(req: NextRequest) {
  const {from,to,audience}=checkedReportParams(
    req.nextUrl.searchParams.get('from'),
    req.nextUrl.searchParams.get('to'),
    req.nextUrl.searchParams.get('audience'),
  );
  const s=await db();
  const {data:role,error:roleError}=await s.rpc('current_app_role');
  if (roleError || !['ADMIN','DEWAN_GURU','KELOMPOK'].includes(role||'')) {
    const error=new Error('Laporan terperinci hanya untuk pengelola yang berwenang.');
    (error as Error & {status?:number}).status=403;
    throw error;
  }
  const events:AttendanceEvent[]=[];
  for(let offset=0;offset<100000;offset+=500){
    let query=s.from('attendance_events')
      .select('id,title,event_date,audience,class_id,attendance_records(id,status,participant_key,member_id,member_name_snapshot,class_name_snapshot,class_id_snapshot)')
      .neq('state','CANCELLED')
      .gte('event_date',from).lte('event_date',to)
      .order('event_date',{ascending:true}).order('id',{ascending:true})
      .range(offset,offset+499);
    if(audience)query=query.eq('audience',audience);
    const {data,error}=await query;
    if(error)throw new Error(error.message);
    const page=(data||[]) as AttendanceEvent[];
    events.push(...page);
    if(page.length<500)break;
    if(offset===99500)throw new Error('Laporan melebihi 100.000 kegiatan. Persempit periodenya.');
  }
  const tables=reportTables(events);
  return {period:{from,to},audience:audience||'Semua',events, ...tables};
}
