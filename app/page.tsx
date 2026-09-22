'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Stats={kelompok:number;mudaMudi:number;caberawit:number;kegiatan:number;jurnal:number};

function Stat({label,value,icon,caption}:{label:string;value:number|string;icon:string;caption:string}){
  return <div className="card statCard">
    <div className="statTop"><span className="muted" style={{fontSize:12,fontWeight:750}}>{label}</span><span className="statIcon">{icon}</span></div>
    <strong>{value}</strong><small>{caption}</small>
  </div>;
}

export default function Dashboard(){
  const[s,setS]=useState<Stats|null>(null);
  const[err,setErr]=useState('');
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    fetch('/api/dashboard')
      .then(async r=>{if(!r.ok)throw new Error();return r.json()})
      .then(setS)
      .catch(()=>setErr('Data dashboard belum dapat dimuat. Koneksi database perlu diperiksa.'))
      .finally(()=>setLoading(false));
  },[]);

  return <>
    <section className="hero">
      <div className="eyebrow" style={{color:'rgba(255,255,255,.72)'}}>Aeroo Premium Administrasi</div>
      <h1>Semua administrasi kelompok, lebih rapi dalam satu tempat.</h1>
      <p>Kelola database anggota, Caberawit, presensi, jurnal kegiatan, rekap, dan laporan tanpa berpindah-pindah aplikasi.</p>
      <div className="heroMeta">
        <span className="heroPill">● Sistem aktif</span>
        <span className="heroPill">Mobile-first</span>
        <span className="heroPill">Laporan Excel · Word · PDF</span>
      </div>
    </section>

    {err&&<div className="notice error section" role="alert">{err}</div>}

    <section className="section">
      <div className="sectionTitle"><div><h2>Ringkasan data</h2><p>Kondisi database dan aktivitas utama.</p></div></div>
      <div className="grid">
        <Stat label="Kelompok" value={loading?'…':s?.kelompok??0} icon="K" caption="anggota aktif"/>
        <Stat label="Muda-Mudi" value={loading?'…':s?.mudaMudi??0} icon="M" caption="anggota kategori muda-mudi"/>
        <Stat label="Caberawit" value={loading?'…':s?.caberawit??0} icon="C" caption="peserta aktif"/>
        <Stat label="Kegiatan" value={loading?'…':s?.kegiatan??0} icon="A" caption="agenda/presensi tercatat"/>
      </div>
    </section>

    <section className="section">
      <div className="sectionTitle"><div><h2>Akses cepat</h2><p>Menu yang paling sering dipakai saat kegiatan.</p></div></div>
      <div className="quickGrid">
        <Link href="/database/kelompok" className="quickAction"><span className="quickIcon">01</span><div><strong>Database Kelompok</strong><small>Anggota, kategori, dan status</small></div></Link>
        <Link href="/database/caberawit" className="quickAction"><span className="quickIcon">02</span><div><strong>Database Caberawit</strong><small>Peserta dan jenjang</small></div></Link>
        <Link href="/presensi" className="quickAction"><span className="quickIcon">03</span><div><strong>Mulai Presensi</strong><small>Kelompok, muda-mudi, Caberawit</small></div></Link>
        <Link href="/jurnal" className="quickAction"><span className="quickIcon">04</span><div><strong>Jurnal Kegiatan</strong><small>Materi, hasil, kendala, tindak lanjut</small></div></Link>
      </div>
    </section>

    <div className="two section">
      <section className="card">
        <div className="sectionTitle">
          <div><h2>Kehadiran & rekap</h2><p>Pantau aktivitas dari satu halaman rekap.</p></div>
          <Link href="/rekap" className="btn secondary">Buka Rekap</Link>
        </div>
        <div className="notice">Rekap dapat difilter berdasarkan periode, kategori, dan jenjang. Rentang tanggal tetap fleksibel untuk laporan harian maupun beberapa bulan.</div>
      </section>
      <section className="card">
        <div className="sectionTitle"><div><h2>Jurnal tersimpan</h2><p>Dokumentasi kegiatan kelompok.</p></div></div>
        <div style={{display:'flex',alignItems:'end',gap:10}}>
          <strong style={{fontSize:38,lineHeight:1,letterSpacing:'-.04em'}}>{loading?'…':s?.jurnal??0}</strong>
          <span className="muted" style={{fontSize:12,paddingBottom:3}}>jurnal kegiatan</span>
        </div>
        <Link href="/jurnal" className="btn ghost" style={{marginTop:18,width:'100%'}}>Lihat Jurnal</Link>
      </section>
    </div>
  </>;
}
