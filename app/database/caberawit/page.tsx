'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Child={id:string;name:string;guardian_name?:string;status:string;levels?:{name?:string}};

export default function Page(){
  const[data,setData]=useState<Child[]>([]);
  const[q,setQ]=useState('');
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');

  useEffect(()=>{
    fetch('/api/caberawit').then(async r=>{if(!r.ok)throw new Error();return r.json()})
      .then(setData).catch(()=>setError('Database Caberawit belum dapat dimuat.')).finally(()=>setLoading(false));
  },[]);

  const shown=useMemo(()=>data.filter(x=>{
    const term=q.trim().toLowerCase();
    if(!term)return true;
    return [x.name,x.guardian_name,x.levels?.name].filter(Boolean).some(v=>String(v).toLowerCase().includes(term));
  }),[data,q]);

  return <>
    <div className="pageHeader">
      <div><div className="eyebrow">Database</div><h1>Database Caberawit</h1><p>Kelola peserta Caberawit langsung di Aeroo dengan jenjang yang dapat ditambah sesuai kebutuhan.</p></div>
      <Link href="/database/caberawit/tambah" className="btn writeOnly">+ Tambah Caberawit</Link>
    </div>

    <div className="card">
      <div className="searchBar">
        <input className="input" placeholder="Cari nama, wali, atau jenjang…" value={q} onChange={e=>setQ(e.target.value)}/>
        <Link href="/database/caberawit/jenjang" className="btn secondary writeOnly">Kelola Jenjang</Link>
      </div>
      <div className="notice">Jenjang tidak dikunci oleh sistem. Tambahkan dan gunakan jenjang sesuai struktur pendidikan yang berlaku di kelompok.</div>
    </div>

    {error&&<div className="notice error section" role="alert">{error}</div>}

    <section className="section">
      <div className="sectionTitle"><div><h2>Peserta Caberawit</h2><p>{loading?'Memuat data…':shown.length+' peserta ditampilkan'}</p></div></div>
      <div className="list">
        {loading?[1,2,3].map(i=><div className="item" key={i}><div className="skeleton" style={{height:52}}/></div>):
        shown.length?shown.map(x=>{
          const initials=x.name.split(' ').slice(0,2).map(v=>v[0]).join('').toUpperCase();
          return <div className="item row between" key={x.id}>
            <div className="row" style={{minWidth:0}}>
              <div className="avatar">{initials||'C'}</div>
              <div style={{minWidth:0}}>
                <div className="itemTitle">{x.name}</div>
                <div className="itemMeta">{x.levels?.name||'Jenjang belum dipilih'} · Wali: {x.guardian_name||'—'}</div>
              </div>
            </div>
            <span className="badge">{x.status==='ACTIVE'?'● Aktif':'Nonaktif'}</span>
          </div>
        }):<div className="emptyState">
          <div className="emptyIcon">C</div>
          <h3>Belum ada data Caberawit</h3>
          <p>Tambahkan peserta agar presensi per jenjang, perkembangan, dan laporan Caberawit dapat digunakan.</p>
          <Link href="/database/caberawit/tambah" className="btn writeOnly" style={{marginTop:16}}>+ Tambah Caberawit</Link>
        </div>}
      </div>
    </section>
  </>;
}
