'use client';

import {FormEvent,useEffect,useMemo,useState} from 'react';

type Version={id:string;title:string;version:number;period_start?:string;period_end?:string;source_file_name?:string;analysis?:any;created_at:string};
type Target={id:string;code?:string;title:string;description?:string;target_value?:number;target_unit?:string;levels?:{name?:string};classes?:{name?:string}};

export default function TargetPage(){
  const[versions,setVersions]=useState<Version[]>([]);
  const[targets,setTargets]=useState<Target[]>([]);
  const[selected,setSelected]=useState('');
  const[uploading,setUploading]=useState(false);
  const[error,setError]=useState('');
  const[result,setResult]=useState('');

  const load=async()=>{
    const [v,t]=await Promise.all([fetch('/api/targets/import').then(r=>r.json()),fetch('/api/targets'+(selected?'?version_id='+selected:'')).then(r=>r.json())]);
    setVersions(v);setTargets(t);
  };
  useEffect(()=>{void load()},[selected]);

  async function upload(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setUploading(true);setError('');setResult('');
    const fd=new FormData(e.currentTarget);
    const r=await fetch('/api/targets/import',{method:'POST',body:fd});
    const j=await r.json();
    if(!r.ok){setError(j.error||'Gagal membaca target.');setUploading(false);return}
    setResult(`${j.inserted} target berhasil dipetakan dari Excel.`);
    setSelected(j.version_id);setUploading(false);await load();
  }

  const current=useMemo(()=>versions.find(v=>v.id===selected),[versions,selected]);

  return <>
    <div className="pageHeader"><div><h1>Target & Progres</h1></div></div>
    <div className="dashboardGrid">
      <form className="card writeOnly" onSubmit={upload}>
        <div className="cardHead"><div><h2>Upload Target Excel</h2><p>Struktur kolom dibaca otomatis dan disimpan sebagai versi baru.</p></div></div>
        <div className="formGrid">
          <label>Nama versi<input className="input" name="title" required placeholder="Target Semester 1"/></label>
          <label>File Excel<input className="input" name="file" type="file" accept=".xlsx,.xls" required/></label>
          <label>Periode mulai<input className="input" name="period_start" type="date"/></label>
          <label>Periode akhir<input className="input" name="period_end" type="date"/></label>
        </div>
        {error&&<div className="notice error section">{error}</div>}
        {result&&<div className="notice section">{result}</div>}
        <button className="btn section" disabled={uploading}>{uploading?'Menganalisis Excel…':'Upload & Analisis'}</button>
      </form>
      <section className="card">
        <div className="cardHead"><div><h2>Versi Target</h2><p>Target lama tetap tersimpan.</p></div></div>
        <div className="list">
          {versions.map(v=><button key={v.id} className={selected===v.id?'item targetVersion active':'item targetVersion'} onClick={()=>setSelected(v.id)}>
            <div className="row between"><strong>{v.title}</strong><span className="badge">v{v.version}</span></div>
            <div className="itemMeta">{v.source_file_name||'Input manual'}{v.period_start?' · '+v.period_start:''}</div>
          </button>)}
          {!versions.length&&<div className="emptyState">Belum ada versi target.</div>}
        </div>
      </section>
    </div>
    {current&&<div className="notice section">Struktur terdeteksi: {Object.keys(current.analysis?.columns||{}).join(', ')||'target standar'}.</div>}
    <section className="section">
      <div className="cardHead"><div><h2>Daftar Target</h2><p>{targets.length} target aktif.</p></div></div>
      <div className="tableWrap"><table className="table"><thead><tr><th>Kode</th><th>Target</th><th>Jenjang</th><th>Kelas</th><th>Nilai</th></tr></thead><tbody>
        {targets.map(t=><tr key={t.id}><td>{t.code||'-'}</td><td><strong>{t.title}</strong><div className="itemMeta">{t.description||''}</div></td><td>{t.levels?.name||'-'}</td><td>{t.classes?.name||'-'}</td><td>{t.target_value??'-'} {t.target_unit||''}</td></tr>)}
        {!targets.length&&<tr><td colSpan={5}>Belum ada target.</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
