'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Member = {
  id:string; name:string; status:string;
  member_categories?:Array<{categories?:{name?:string}}>;
};

const filters=['Semua','Muda-Mudi','Ibu-Ibu','Pengurus'];

export default function Page(){
  const[data,setData]=useState<Member[]>([]);
  const[q,setQ]=useState('');
  const[active,setActive]=useState('Semua');
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');

  const load=async()=>{
    setLoading(true);setError('');
    try{
      const r=await fetch('/api/members?q='+encodeURIComponent(q));
      if(!r.ok) throw new Error();
      setData(await r.json());
    }catch{
      setError('Database Kelompok belum dapat dimuat.');
    }finally{setLoading(false)}
  };

  useEffect(()=>{void load()},[]);

  const shown=useMemo(()=>data.filter(x=>{
    if(active==='Semua')return true;
    const categories=x.member_categories?.map(c=>c.categories?.name?.toLowerCase())??[];
    return categories.includes(active.toLowerCase());
  }),[data,active]);

  return <>
    <div className="pageHeader">
      <div><div className="eyebrow">Database</div><h1>Database Kelompok</h1><p>Master anggota kelompok. Satu orang dapat memiliki beberapa kategori tanpa membuat data ganda.</p></div>
      <Link href="/database/kelompok/tambah" className="btn writeOnly">+ Tambah Anggota</Link>
    </div>

    <div className="card">
      <div className="searchBar">
        <input className="input" placeholder="Cari nama anggota…" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void load()}}/>
        <button className="btn secondary" onClick={()=>void load()}>Cari</button>
      </div>
      <div className="chips" aria-label="Filter kategori">
        {filters.map(f=><button key={f} className={active===f?'chip active':'chip'} onClick={()=>setActive(f)}>{f}</button>)}
      </div>
    </div>

    {error&&<div className="notice error section" role="alert">{error}</div>}

    <section className="section">
      <div className="sectionTitle"><div><h2>Anggota</h2><p>{loading?'Memuat data…':shown.length+' data ditampilkan'}</p></div></div>
      <div className="list">
        {loading?[1,2,3].map(i=><div className="item" key={i}><div className="skeleton" style={{height:52}}/></div>):
        shown.length?shown.map(x=>{
          const names=x.member_categories?.map(c=>c.categories?.name).filter(Boolean) as string[]|undefined;
          const initials=x.name.split(' ').slice(0,2).map(v=>v[0]).join('').toUpperCase();
          return <div className="item row between" key={x.id}>
            <div className="row" style={{minWidth:0}}>
              <div className="avatar">{initials||'A'}</div>
              <div style={{minWidth:0}}>
                <div className="itemTitle">{x.name}</div>
                <div className="itemMeta">{names?.join(' • ')||'Kelompok'}</div>
              </div>
            </div>
            <span className="badge">{x.status==='ACTIVE'?'● Aktif':'Nonaktif'}</span>
          </div>
        }):<div className="emptyState">
          <div className="emptyIcon">K</div>
          <h3>Belum ada anggota</h3>
          <p>Tambahkan anggota pertama. Data ini akan menjadi sumber peserta untuk presensi Kelompok, Muda-Mudi, Ibu-Ibu, dan Pengurus.</p>
          <Link href="/database/kelompok/tambah" className="btn writeOnly" style={{marginTop:16}}>+ Tambah Anggota</Link>
        </div>}
      </div>
    </section>
  </>;
}
