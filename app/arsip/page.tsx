'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';

type Tab='members'|'journals';
type Dep={
  type:string;
  id:string;
  title:string;
  archived:boolean;
  revision?:number;
  can_permanent_delete:boolean;
  dependencies:Array<{key:string;label:string;count:number;blocking:boolean}>;
};

export default function Archive(){
  const[tab,setTab]=useState<Tab>('members');
  const[rows,setRows]=useState<any[]>([]);
  const[error,setError]=useState('');
  const[loading,setLoading]=useState(true);
  const[busy,setBusy]=useState('');
  const[dep,setDep]=useState<Dep|null>(null);

  async function load(){
    setLoading(true);setError('');
    try{
      const url=tab==='members'?'/api/members?archived=1':'/api/journals?state=ARCHIVED';
      const r=await fetch(url,{cache:'no-store'});
      const v=await r.json();
      if(!r.ok)throw Error(v.error||'Arsip tidak dapat dimuat.');
      setRows(Array.isArray(v)?v:[]);
    }catch(e){setError(e instanceof Error?e.message:'Arsip tidak dapat dimuat.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[tab]);

  async function inspect(row:any){
    setBusy(row.id);setError('');
    const type=tab==='members'?'member':'journal';
    const r=await fetch('/api/archive/dependencies?type='+type+'&id='+row.id,{cache:'no-store'});
    const j=await r.json();setBusy('');
    if(!r.ok){setError(j.error||'Relasi tidak dapat diperiksa.');return}
    setDep(j);
  }

  async function restore(row:any){
    setBusy(row.id);setError('');
    try{
      const r=tab==='members'
        ? await fetch('/api/members/'+row.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status:'ACTIVE'})})
        : await fetch('/api/journals/'+row.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({state_only:true,state:'DRAFT',revision:row.revision})});
      const j=await r.json();
      if(!r.ok)throw Error(j.error||'Data tidak dapat dipulihkan.');
      setDep(null);await load();
    }catch(e){setError(e instanceof Error?e.message:'Data tidak dapat dipulihkan.')}
    finally{setBusy('')}
  }

  async function permanentDelete(){
    if(!dep||dep.type!=='member'||!dep.can_permanent_delete)return;
    setBusy(dep.id);setError('');
    try{
      const r=await fetch('/api/members/'+dep.id+'?permanent=1',{method:'DELETE'});
      const j=await r.json();
      if(!r.ok)throw Error(j.error||'Anggota tidak dapat dihapus permanen.');
      setDep(null);await load();
    }catch(e){setError(e instanceof Error?e.message:'Anggota tidak dapat dihapus permanen.')}
    finally{setBusy('')}
  }

  return <>
    <div className="pageHeader">
      <h1>Arsip</h1>
      <Link className="btn secondary" href="/catatan">Catatan Pribadi</Link>
    </div>

    <div className="tabBar">
      <button className={tab==='members'?'tab active':'tab'} onClick={()=>setTab('members')}>Anggota</button>
      <button className={tab==='journals'?'tab active':'tab'} onClick={()=>setTab('journals')}>Jurnal</button>
    </div>

    {error&&<div className="notice error section">{error}</div>}

    <div className="list section">
      {loading?<div className="card">Memuat…</div>:rows.map(r=>
        <article className="item row between archiveRow" key={r.id}>
          <div>
            <h2>{r.name||r.title}</h2>
            <div className="itemMeta">
              {tab==='members'
                ? 'Anggota nonaktif'
                : (r.journal_date||'')+' · '+(r.journal_kind||'Jurnal')}
            </div>
          </div>
          <div className="row">
            <button className="smallAction" disabled={busy===r.id} onClick={()=>void restore(r)}>
              {busy===r.id?'Memproses…':'Pulihkan'}
            </button>
            <button className="smallAction" disabled={busy===r.id} onClick={()=>void inspect(r)}>Cek Relasi</button>
          </div>
        </article>
      )}
      {!loading&&!rows.length&&<div className="emptyState">Arsip kosong.</div>}
    </div>

    {dep&&<div className="dialogBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setDep(null)}}>
      <div className="dialogCard archiveDependencyDialog" role="dialog" aria-modal="true">
        <div className="cardHead">
          <div><h2>{dep.title}</h2><span className="itemMeta">Dependency data sebelum tindakan permanen</span></div>
          <button className="smallAction" onClick={()=>setDep(null)}>Tutup</button>
        </div>
        <div className="dependencyList section">
          {dep.dependencies.map(x=>
            <div className="dependencyRow" key={x.key}>
              <span>{x.label}</span>
              <strong>{x.count}</strong>
              <span className={x.blocking&&x.count>0?'badge warningBadge':'badge'}>
                {x.blocking&&x.count>0?'Melindungi histori':'Aman'}
              </span>
            </div>
          )}
        </div>
        {dep.type==='member'&&<div className={dep.can_permanent_delete?'notice section':'notice warning section'}>
          {dep.can_permanent_delete
            ? 'Tidak ada histori operasional yang terikat. Permanent delete diizinkan.'
            : 'Permanent delete dikunci karena ada histori operasional. Biarkan anggota di arsip agar presensi, jurnal, progres, dan riwayat jabatan tetap utuh.'}
        </div>}
        {dep.type==='journal'&&<div className="notice section">
          Jurnal tidak dihapus permanen. Pulihkan sebagai Draft bila perlu melakukan koreksi.
        </div>}
        <div className="formActions">
          <button className="btn ghost" onClick={()=>setDep(null)}>Selesai</button>
          {dep.type==='member'&&dep.can_permanent_delete&&
            <button className="btn danger" disabled={busy===dep.id} onClick={()=>void permanentDelete()}>
              {busy===dep.id?'Menghapus…':'Hapus Permanen'}
            </button>}
        </div>
      </div>
    </div>}
  </>;
}
