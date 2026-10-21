
import AttendanceRecap from '@/components/AttendanceRecap';
export default function IndividuPage(){
 return <main className="attendancePage">
  <header className="pageHeader"><div><h1>Rekap Individu</h1><p>Riwayat kehadiran dan perubahan performa setiap peserta berdasarkan periode pilihan.</p></div></header>
  <AttendanceRecap embedded individualOnly/>
 </main>;
}
