'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';

type Member={id:string;name:string;gender?:string;phone?:string;levels?:{name?:string};classes?:{name?:string};member_categories?:Array<{categories?:{name?:string;slug?:string}}>};
type ClassRow={id:string;name:string;audience:string;levels?:{name?:string}};

const tabs=[['ALL','Keseluruhan'],['CABERAWIT','Caberawit'],['MUDA_MUDI','Muda-Mudi'],['PENGURUS','Pengurus']] as const;

export default function DatabasePage(){
  const[segment,setSegment]=useState('ALL');
  const[q,setQ]=useState('');
  const[classId,setClassId]=useState('');
  const[data,setData]=useState<Member[]>([]);
  const[classes,setClasses]=useState<ClassRow[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');

  const load=async()=>{
    setLoading(true);setError('');
    const params=new URLSearchParams({segment});
    if(q)params.set('q',q);
    if(classId)params.set('class_id',classId);
    try{
      const [r,c]=await Promise.all([fetch('/api/members?'+params),fetch('/api/classes')]);
      if(!r.ok)throw new Error();
      setData(await r.json());setClasses(await c.json());
    }catch{setError('Database belum dapat dimuat.')}
    finally{setLoading(false)}
  };
  useEffect(()=>{void load()},[segment,classId]);

  const classOptions=useMemo(()=>classes.filter(c=>segment==='ALL'||c.audience===segment),[classes,segment]);

  return <>
    <div className="pageHeader"><div><h1>Database</h1></div><Link className="btn writeOnly" href="/database/tambah">+ Tambah Data</Link></div>
    <div className="tabBar">{tabs.map(([v,l])=><button key={v} className={segment===v?'tab active':'tab'} onClick={()=>{setSegment(v);setClassId('')}}>{l}</button>)}</div>
    <div className="toolbar card">
      <input className="input" placeholder="Cari nama…" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void load()}}/>
      {(segment==='CABERAWIT'||segment==='MUDA_MUDI')&&<select className="select" value={classId} onChange={e=>setClassId(e.target.value)}>
        <option value="">Semua kelas</option>{classOptions.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </select>}
      <button className="btn secondary" onClick={()=>void load()}>Cari</button>
    </div>
    {error&&<div className="notice error section">{error}</div>}
    <div className="tableWrap section">
      <table className="table">
        <thead><tr><th>Nama</th><th>Kategori</th><th>Jenjang</th><th>Kelas</th><th>HP</th></tr></thead>
        <tbody>
          {loading?<tr><td colSpan={5}>Memuat data…</td></tr>:data.map(x=><tr key={x.id}>
            <td><strong>{x.name}</strong></td>
            <td>{x.member_categories?.map(c=>c.categories?.name).filter(Boolean).join(', ')||'-'}</td>
            <td>{x.levels?.name||'-'}</td><td>{x.classes?.name||'-'}</td><td>{x.phone||'-'}</td>
          </tr>)}
          {!loading&&!data.length&&<tr><td colSpan={5}>Belum ada data.</td></tr>}
        </tbody>
      </table>
    </div>
  </>;
}
