'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Event={id:string;title:string;event_date:string;audience:string;attendance_records?:unknown[]};

const labels:Record<string,string>={KELOMPOK:'Kelompok',MUDA_MUDI:'Muda-Mudi',CABERAWIT:'Caberawit',IBU_IBU:'Ibu-Ibu',PENGURUS:'Pengurus'};

export default function Page(){
  const[events,setEvents]=useState<Event[]>([]);
  const[filter,setFilter]=useState('SEMUA');
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');

  useEffect(()=>{
    fetch('/api/attendance').then(async r=>{if(!r.ok)throw new Error();return r.json()})
      .then(setEvents).catch(()=>setError('Data presensi belum dapat dimuat.')).finally(()=>setLoading(false));
  },[]);

  const shown=useMemo(()=>filter==='SEMUA'?events:events.filter(e=>e.audience===filter),[events,filter]);

  return <>
    <div className="pageHeader">
      <div><div className="eyebrow">Operasional</div><h1>Presensi</h1><p>Catat kehadiran dengan cepat. Presensi Kelompok mencakup Muda-Mudi, sedangkan presensi Muda-Mudi hanya menampilkan peserta berkategori Muda-Mudi.</p></div>
      <Link href="/presensi/buat" className="btn writeOnly">+ Buat Presensi</Link>
    </div>

    <div className="card">
      <div className="sectionTitle"><div><h2>Pilih kategori</h2><p>Filter daftar kegiatan presensi.</p></div></div>
      <div className="chips">
        {['SEMUA','KELOMPOK','MUDA_MUDI','CABERAWIT','IBU_IBU','PENGURUS'].map(v=><button key={v} className={filter===v?'chip active':'chip'} onClick={()=>setFilter(v)}>{v==='SEMUA'?'Semua':labels[v]}</button>)}
      </div>
    </div>

    {error&&<div className="notice error section" role="alert">{error}</div>}

    <section className="section">
      <div className="sectionTitle"><div><h2>Riwayat presensi</h2><p>{loading?'Memuat kegiatan…':shown.length+' kegiatan'}</p></div></div>
      <div className="list">
        {loading?[1,2,3].map(i=><div className="item" key={i}><div className="skeleton" style={{height:56}}/></div>):
        shown.length?shown.map(e=><div className="item row between" key={e.id}>
          <div className="row" style={{minWidth:0}}>
            <div className="avatar">P</div>
            <div style={{minWidth:0}}>
              <div className="itemTitle">{e.title}</div>
              <div className="itemMeta">{new Date(e.event_date+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})} · {labels[e.audience]||e.audience}</div>
            </div>
          </div>
          <span className="badge">{e.attendance_records?.length||0} peserta</span>
        </div>):<div className="emptyState">
          <div className="emptyIcon">✓</div>
          <h3>Belum ada presensi</h3>
          <p>Buat kegiatan pertama, pilih kategori peserta, lalu tandai Hadir, Izin, atau Alfa langsung dari HP.</p>
          <Link href="/presensi/buat" className="btn writeOnly" style={{marginTop:16}}>+ Buat Presensi</Link>
        </div>}
      </div>
    </section>
  </>;
}
