'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';

type Role='ADMIN'|'DEWAN_GURU'|'KELOMPOK'|'VIEWER';
type Stats={role:Role;kelompok:number;mudaMudi:number;caberawit:number;kegiatan:number;jurnal:number};

function Stat({label,value,icon,caption}:{label:string;value:number|string;icon:string;caption:string}){
  return <div className="card statCard"><div className="statTop"><span className="muted" style={{fontSize:12,fontWeight:750}}>{label}</span><span className="statIcon">{icon}</span></div><strong>{value}</strong><small>{caption}</small></div>
}

export default function Dashboard(){
  const[s,setS]=useState<Stats|null>(null);const[err,setErr]=useState('');const[loading,setLoading]=useState(true);
  useEffect(()=>{fetch('/api/dashboard').then(async r=>{if(!r.ok)throw new Error();return r.json()}).then(setS).catch(()=>setErr('Data dashboard belum dapat dimuat.')).finally(()=>setLoading(false))},[]);
  const showKelompok=!s||s.role!=='DEWAN_GURU';
  const showCaberawit=!s||s.role!=='KELOMPOK';
  const quick=useMemo(()=>{
    const role=s?.role;
    const rows:{href:string;label:string;desc:string;no:string}[]=[];
    if(role!=='DEWAN_GURU')rows.push({href:'/database/kelompok',label:'Database Kelompok',desc:'Anggota, kategori, dan status',no:'01'});
    if(role!=='KELOMPOK')rows.push({href:'/database/caberawit',label:'Database Caberawit',desc:'Peserta dan jenjang',no:'02'});
    rows.push({href:'/presensi',label:'Presensi',desc:'Catat H/I/A sesuai akses role',no:'03'});
    rows.push({href:'/jurnal',label:'Jurnal Kegiatan',desc:'Materi, hasil, kendala, tindak lanjut',no:'04'});
    return rows;
  },[s?.role]);

  return <>
    <section className="hero"><div className="eyebrow" style={{color:'rgba(255,255,255,.72)'}}>Aeroo Premium Administrasi</div><h1>Administrasi kelompok, Caberawit, dan kegiatan dalam satu sistem.</h1><p>Menu dan data yang terlihat otomatis mengikuti akses akun yang sedang digunakan.</p><div className="heroMeta"><span className="heroPill">● Sistem aktif</span><span className="heroPill">Akses berbasis peran</span><span className="heroPill">Mobile-first</span></div></section>
    {err&&<div className="notice error section" role="alert">{err}</div>}
    <section className="section"><div className="sectionTitle"><div><h2>Ringkasan data</h2><p>Data yang tampil sudah mengikuti hak akses akun.</p></div></div><div className="grid">
      {showKelompok&&<Stat label="Kelompok" value={loading?'…':s?.kelompok??0} icon="K" caption="anggota aktif"/>}
      <Stat label="Muda-Mudi" value={loading?'…':s?.mudaMudi??0} icon="M" caption="anggota muda-mudi"/>
      {showCaberawit&&<Stat label="Caberawit" value={loading?'…':s?.caberawit??0} icon="C" caption="peserta aktif"/>}
      <Stat label="Kegiatan" value={loading?'…':s?.kegiatan??0} icon="A" caption="kegiatan yang dapat diakses"/>
    </div></section>
    <section className="section"><div className="sectionTitle"><div><h2>Akses cepat</h2><p>Menu utama sesuai role akun.</p></div></div><div className="quickGrid">{quick.map(x=><Link href={x.href} className="quickAction" key={x.href}><span className="quickIcon">{x.no}</span><div><strong>{x.label}</strong><small>{x.desc}</small></div></Link>)}</div></section>
    <div className="two section"><section className="card"><div className="sectionTitle"><div><h2>Kehadiran & rekap</h2><p>Pantau aktivitas dari satu halaman rekap.</p></div><Link href="/rekap" className="btn secondary">Buka Rekap</Link></div><div className="notice">Rekap hanya menampilkan data yang memang diizinkan untuk role akun ini.</div></section><section className="card"><div className="sectionTitle"><div><h2>Jurnal tersimpan</h2><p>Dokumentasi kegiatan yang dapat diakses.</p></div></div><div style={{display:'flex',alignItems:'end',gap:10}}><strong style={{fontSize:38,lineHeight:1,letterSpacing:'-.04em'}}>{loading?'…':s?.jurnal??0}</strong><span className="muted" style={{fontSize:12,paddingBottom:3}}>jurnal kegiatan</span></div><Link href="/jurnal" className="btn ghost" style={{marginTop:18,width:'100%'}}>Lihat Jurnal</Link></section></div>
  </>;
}
