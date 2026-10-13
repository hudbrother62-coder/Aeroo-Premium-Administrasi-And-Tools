import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
import AttendanceRecap from '@/components/AttendanceRecap';
export default async function Page({searchParams}:{searchParams:Promise<{event_id?:string}>}){
 const {event_id}=await searchParams;
 return <main className="attendancePage"><div className="pageHeader"><div><Link href="/presensi"><ArrowLeft size={16}/> Presensi</Link><h1>Rekap Presensi</h1></div></div><AttendanceRecap embedded focusEventId={event_id||''}/></main>;
}
