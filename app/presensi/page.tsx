import Link from 'next/link';
export default function Page(){return <main className="attendancePage"><h1>Presensi</h1><nav className="attendanceNav"><Link href="/presensi/buat">Isi Presensi</Link><Link href="/presensi/riwayat">Riwayat</Link><Link href="/presensi/rekap">Rekap</Link></nav></main>}
