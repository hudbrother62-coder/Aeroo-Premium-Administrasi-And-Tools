'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Journal={id:string;journal_date:string;title:string;person_in_charge?:string;summary?:string;activity_types?:{name?:string}};

export default function Page(){
  const[data,setData]=useState<Journal[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');

  useEffect(()=>{
    fetch('/api/journals').then(async r=>{if(!r.ok)throw new Error();return r.json()})
      .then(setData).catch(()=>setError('Jurnal kegiatan belum dapat dimuat.')).finally(()=>setLoading(false));
  },[]);

  return <>
    <div className="pageHeader">
      <div><div className="eyebrow">Operasional</div><h1>Jurnal Kegiatan</h1><p>Catat materi, hasil kegiatan, kendala, penanggung jawab, dan tindak lanjut dalam riwayat yang mudah dicari kembali.</p></div>
      <Link href="/jurnal/buat" className="btn">+ Buat Jurnal</Link>
    </div>

    <div className="card">
      <div className="sectionTitle"><div><h2>Dokumentasi kegiatan</h2><p>Jurnal dapat dikaitkan dengan presensi kegiatan yang sama.</p></div></div>
      <div className="notice">Gunakan jurnal untuk menyimpan konteks kegiatan, bukan hanya catatan singkat. Riwayat jurnal tetap tersedia sebagai bahan evaluasi dan laporan.</div>
    </div>

    {error&&<div className="notice error section" role="alert">{error}</div>}

    <section className="section">
      <div className="sectionTitle"><div><h2>Riwayat jurnal</h2><p>{loading?'Memuat jurnal…':data.length+' jurnal tersimpan'}</p></div></div>
      <div className="list">
        {loading?[1,2,3].map(i=><div className="item" key={i}><div className="skeleton" style={{height:82}}/></div>):
        data.length?data.map(j=><article className="item" key={j.id}>
          <div className="row between">
            <span className="badge">{new Date(j.journal_date+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</span>
            <span className="itemMeta" style={{marginTop:0}}>{j.activity_types?.name||'Kegiatan'}</span>
          </div>
          <h3 style={{fontSize:16,margin:'13px 0 5px',letterSpacing:'-.015em'}}>{j.title}</h3>
          <div className="itemMeta">{j.person_in_charge?'PJ: '+j.person_in_charge:'Belum ada penanggung jawab'}</div>
          <p style={{margin:'11px 0 0',fontSize:13,lineHeight:1.65,color:'var(--muted)'}}>{j.summary||'Belum ada ringkasan kegiatan.'}</p>
        </article>):<div className="emptyState">
          <div className="emptyIcon">J</div>
          <h3>Belum ada jurnal kegiatan</h3>
          <p>Buat jurnal pertama setelah kegiatan berlangsung agar materi, hasil, kendala, dan tindak lanjut terdokumentasi rapi.</p>
          <Link href="/jurnal/buat" className="btn" style={{marginTop:16}}>+ Buat Jurnal</Link>
        </div>}
      </div>
    </section>
  </>;
}
