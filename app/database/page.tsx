'use client';

import Link from 'next/link';
import {FormEvent,useEffect,useMemo,useState} from 'react';

type Member={id:string;name:string;gender?:string;phone?:string;levels?:{name?:string};classes?:{name?:string};member_categories?:Array<{categories?:{name?:string;slug?:string}}>};
type ClassRow={id:string;name:string;audience:string;level_id?:string;levels?:{name?:string}};
type Level={id:string;name:string};

const tabs=[['ALL','Keseluruhan'],['CABERAWIT','Caberawit'],['MUDA_MUDI','Muda-Mudi'],['PENGURUS','Pengurus']] as const;

export default function DatabasePage(){
  const[segment,setSegment]=useState('ALL');
  const[q,setQ]=useState('');
  const[classId,setClassId]=useState('');
  const[data,setData]=useState<Member[]>([]);
  const[classes,setClasses]=useState<ClassRow[]>([]);
  const[levels,setLevels]=useState<Level[]>([]);
  const[role,setRole]=useState('');
  const[showClass,setShowClass]=useState(false);
  const[classForm,setClassForm]=useState({name:'',audience:'CABERAWIT',level_id:''});
  const[savingClass,setSavingClass]=useState(false);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  const[classMessage,setClassMessage]=useState('');

  const load=async()=>{
    setLoading(true);setError('');
    const params=new URLSearchParams({segment});
    if(q)params.set('q',q);
    if(classId)params.set('class_id',classId);
    try{
      const [r,c,l,u]=await Promise.all([
        fetch('/api/members?'+params),
        fetch('/api/classes'),
        fetch('/api/levels'),
        fetch('/api/auth/me')
      ]);
      if(!r.ok||!c.ok||!l.ok||!u.ok)throw new Error();
      setData(await r.json());
      setClasses(await c.json());
      setLevels(await l.json());
      setRole((await u.json()).role??'');
    }catch{setError('Database belum dapat dimuat.')}
    finally{setLoading(false)}
  };
  useEffect(()=>{void load()},[segment,classId]);

  const classOptions=useMemo(()=>classes.filter(c=>segment==='ALL'||c.audience===segment),[classes,segment]);
  const canManageClass=role==='ADMIN'||role==='DEWAN_GURU';

  async function addClass(e:FormEvent){
    e.preventDefault();setSavingClass(true);setClassMessage('');setError('');
    const r=await fetch('/api/classes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      ...classForm,level_id:classForm.level_id||null
    })});
    const j=await r.json();
    if(!r.ok){setError(j.error||'Gagal menambah kelas.');setSavingClass(false);return}
    setClassMessage('Kelas berhasil ditambahkan.');
    setClassForm(v=>({...v,name:'',level_id:''}));
    setSavingClass(false);
    await load();
  }

  return <>
    <div className="pageHeader">
      <div><h1>Database</h1></div>
      <div className="row">
        {canManageClass&&<button className="btn ghost" onClick={()=>setShowClass(v=>!v)}>{showClass?'Tutup':'Kelola Kelas'}</button>}
        <Link className="btn writeOnly" href="/database/tambah">+ Tambah Data</Link>
      </div>
    </div>

    {showClass&&canManageClass&&<form className="card" onSubmit={addClass}>
      <div className="cardHead"><div><h2>Tambah Kelas</h2><p>Kelas dipakai untuk Caberawit dan Muda-Mudi.</p></div></div>
      <div className="formGrid">
        <label>Jenis<select className="select" value={classForm.audience} onChange={e=>setClassForm({...classForm,audience:e.target.value})}>
          <option value="CABERAWIT">Caberawit</option>
          <option value="MUDA_MUDI">Muda-Mudi</option>
        </select></label>
        <label>Nama kelas<input className="input" required value={classForm.name} onChange={e=>setClassForm({...classForm,name:e.target.value})} placeholder="Contoh: SD 3 A"/></label>
        <label>Jenjang<select className="select" value={classForm.level_id} onChange={e=>setClassForm({...classForm,level_id:e.target.value})}>
          <option value="">Tanpa jenjang khusus</option>{levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
        </select></label>
      </div>
      {classMessage&&<div className="notice section">{classMessage}</div>}
      <div className="formActions"><button className="btn" disabled={savingClass}>{savingClass?'Menyimpan…':'Simpan Kelas'}</button></div>
    </form>}

    <div className="tabBar section">{tabs.map(([v,l])=><button key={v} className={segment===v?'tab active':'tab'} onClick={()=>{setSegment(v);setClassId('')}}>{l}</button>)}</div>
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
