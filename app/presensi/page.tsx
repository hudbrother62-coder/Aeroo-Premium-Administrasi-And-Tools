'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {writeScopesForRole,type Audience,type Role} from '@/lib/access';

export default function Page(){
  const[allowed,setAllowed]=useState<Audience[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  useEffect(()=>{
    if(new URLSearchParams(window.location.search).get('view')==='rekap'){
      window.location.replace('/rekap?tab=presensi');
      return;
    }
    fetch('/api/auth/me',{cache:'no-store'}).then(async r=>{
      if(!r.ok)throw Error('Hak akses tidak dapat dimuat.');
      const user=await r.json();
      const scopes=Array.isArray(user.write_scopes)?user.write_scopes:writeScopesForRole(user.role as Role);
      setAllowed(user.permissions?.['attendance.write']===false?[]:scopes);
    }).catch(()=>setError('Hak akses belum dapat dimuat. Silakan muat ulang halaman.')).finally(()=>setLoading(false));
  },[]);
  return <>
    <div className="pageHeader"><div><h1>Presensi</h1><p>Pilih kegiatan untuk mencatat kehadiran. Riwayat dan koreksi ada di menu Rekap.</p></div></div>
    {error&&<div className="notice error section">{error}</div>}
    {loading?<div className="card section"><div className="skeleton" style={{height:80}}/></div>:allowed.length>0?<>
      <section className="card section">
        <div className="cardHead"><div><h2>Mulai presensi</h2><p>Setiap kegiatan yang dicatat akan otomatis masuk Riwayat Presensi.</p></div></div>
        <div className="routineAttendancePanel">
          {allowed.includes('KELOMPOK')&&<Link href="/presensi/buat?preset=kelompok" className="routineAttendanceCard"><div><strong>Pengajian Kelompok</strong><span>Senin dan Jumat</span></div><small>Absen seluruh kelompok →</small></Link>}
          {allowed.includes('CABERAWIT')&&<Link href="/presensi/buat?preset=caberawit" className="routineAttendanceCard"><div><strong>Pengajian Caberawit</strong><span>Senin–Sabtu</span></div><small>Absen per kelas dan guru →</small></Link>}
          <Link href="/presensi/buat" className="routineAttendanceCard"><div><strong>Kegiatan Lain</strong><span>Presensi di luar kegiatan rutin</span></div><small>Buka formulir →</small></Link>
        </div>
      </section>
    </>:<div className="notice section">Akun ini belum memiliki izin input presensi. Riwayat yang bisa dibaca tetap tersedia di menu Rekap.</div>}
    <div className="row section" style={{flexWrap:'wrap'}}>
      <Link className="btn secondary" href="/rekap?tab=presensi">Lihat Riwayat & Koreksi</Link>
      <Link className="btn ghost" href="/agenda">Lihat Agenda</Link>
    </div>
  </>;
}
