'use client';
import {FormEvent,useEffect,useState} from 'react';

type Job={id:string;resource_type:string;file_name?:string;status:string;total_rows:number;inserted_rows:number;updated_rows:number;skipped_rows:number;error_rows:number;created_at:string};
type Kind='ANGGOTA'|'TARGET';
const label:Record<string,string>={PENDING:'Menunggu',VALIDATING:'Validasi',PREVIEW:'Preview',IMPORTING:'Mengimpor',COMPLETED:'Selesai',PARTIAL:'Sebagian',FAILED:'Gagal'};

export default function ImportCenter(){
  const[jobs,setJobs]=useState<Job[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const[kind,setKind]=useState<Kind|null>(null),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState<any>(null),[busy,setBusy]=useState(false);
  const[meta,setMeta]=useState({title:'Target Baru',period_start:'',period_end:''});

  async function load(){setLoading(true);const r=await fetch('/api/import-jobs',{cache:'no-store'});const j=await r.json();if(!r.ok)setError(j.error||'Riwayat import tidak dapat dimuat.');else{setJobs(j);setError('')}setLoading(false)}
  useEffect(()=>{void load()},[]);
  function open(k:Kind){setKind(k);setFile(null);setPreview(null);setError('')}
  function formData(){const fd=new FormData();if(file)fd.set('file',file);if(kind==='TARGET'){fd.set('title',meta.title);if(meta.period_start)fd.set('period_start',meta.period_start);if(meta.period_end)fd.set('period_end',meta.period_end)}return fd}
  function endpoint(previewMode=false){const base=kind==='ANGGOTA'?'/api/members/spreadsheet':'/api/targets/import';return base+(previewMode?'?preview=1':'')}
  async function doPreview(e:FormEvent){e.preventDefault();if(!file)return;setBusy(true);setError('');const r=await fetch(endpoint(true),{method:'POST',body:formData()});const j=await r.json();setBusy(false);setPreview(j);if(!r.ok)setError(j.error||'Preview gagal.');await load()}
  async function confirm(){if(!file||!preview?.valid)return;setBusy(true);setError('');const r=await fetch(endpoint(false),{method:'POST',body:formData()});const j=await r.json();setBusy(false);if(!r.ok){setError(j.error||'Import gagal.');return}setKind(null);setPreview(null);setFile(null);await load()}

  return <><div className="pageHeader"><h1>Import Center</h1></div>
    <div className="structureGrid">
      <section className="card"><h2>Anggota</h2><div className="taskLinks section"><a className="btn ghost" href="/api/members/spreadsheet?template=1">Template</a><button className="btn" onClick={()=>open('ANGGOTA')}>Import</button></div></section>
      <section className="card"><h2>Target & Progres</h2><div className="taskLinks section"><a className="btn ghost" href="/api/targets/import?template=1">Template</a><button className="btn" onClick={()=>open('TARGET')}>Import</button></div></section>
    </div>
    <section className="section"><div className="cardHead"><h2>Riwayat Import</h2><button className="smallAction" onClick={()=>void load()}>Muat ulang</button></div>{error&&!kind&&<div className="notice error">{error}</div>}<div className="tableWrap"><table className="table"><thead><tr><th>Waktu</th><th>Data</th><th>File</th><th>Status</th><th>Hasil</th></tr></thead><tbody>{loading?<tr><td colSpan={5}>Memuat…</td></tr>:jobs.map(j=><tr key={j.id}><td>{new Date(j.created_at).toLocaleString('id-ID')}</td><td>{j.resource_type}</td><td>{j.file_name||'-'}</td><td><span className="badge">{label[j.status]||j.status}</span></td><td>{j.inserted_rows} tambah · {j.updated_rows} ubah · {j.error_rows} error</td></tr>)}{!loading&&!jobs.length&&<tr><td colSpan={5}>Belum ada riwayat import.</td></tr>}</tbody></table></div></section>
    {kind&&<div className="dialogBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setKind(null)}}><form className="dialogCard importWizard" onSubmit={doPreview}><div className="cardHead"><h2>Import {kind==='ANGGOTA'?'Anggota':'Target'}</h2><button type="button" className="smallAction" onClick={()=>setKind(null)} disabled={busy}>Tutup</button></div>
      {kind==='TARGET'&&<div className="formGrid"><label>Nama versi<input className="input" value={meta.title} onChange={e=>setMeta({...meta,title:e.target.value})} required/></label><label>Mulai<input className="input" type="date" value={meta.period_start} onChange={e=>setMeta({...meta,period_start:e.target.value})}/></label><label>Akhir<input className="input" type="date" value={meta.period_end} onChange={e=>setMeta({...meta,period_end:e.target.value})}/></label></div>}
      <label className="section">File Excel<input className="input" type="file" accept=".xlsx,.xls" required onChange={e=>{setFile(e.target.files?.[0]||null);setPreview(null)}}/></label>
      {error&&<div className="notice error section">{error}</div>}
      {!preview&&<button className="btn section" disabled={busy||!file}>{busy?'Memeriksa…':'Preview & Validasi'}</button>}
      {preview&&<div className="section"><div className={preview.valid?'notice success':'notice error'}>{preview.valid?'Data siap diimport.':(preview.errors?.length||0)+' error ditemukan.'}</div><div className="metricGrid section"><div className="metricCard"><span>Total</span><strong>{preview.total??0}</strong></div>{kind==='ANGGOTA'&&<><div className="metricCard"><span>Baru</span><strong>{preview.inserted??0}</strong></div><div className="metricCard"><span>Update</span><strong>{preview.updated??0}</strong></div></>}</div>
        {!!preview.errors?.length&&<div className="importErrors">{preview.errors.slice(0,30).map((x:string,i:number)=><div key={i}>{x}</div>)}</div>}
        {!!preview.rows?.length&&<div className="tableWrap section"><table className="table"><thead><tr>{Object.keys(preview.rows[0]).map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{preview.rows.slice(0,20).map((row:any,i:number)=><tr key={i}>{Object.values(row).map((v:any,j)=><td key={j}>{Array.isArray(v)?v.join(', '):String(v??'')}</td>)}</tr>)}</tbody></table></div>}
        <div className="formActions"><button type="button" className="btn ghost" onClick={()=>setPreview(null)}>Ganti File</button><button type="button" className="btn" disabled={busy||!preview.valid} onClick={()=>void confirm()}>{busy?'Mengimpor…':'Konfirmasi Import'}</button></div>
      </div>}
    </form></div>}
  </>;
}
