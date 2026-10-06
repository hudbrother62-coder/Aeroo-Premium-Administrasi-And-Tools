'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';

type Job={id:string;resource_type:string;file_name?:string;status:string;total_rows:number;inserted_rows:number;updated_rows:number;skipped_rows:number;error_rows:number;errors:any[];created_at:string;completed_at?:string};
const label:Record<string,string>={PENDING:'Menunggu',VALIDATING:'Validasi',PREVIEW:'Preview',IMPORTING:'Mengimpor',COMPLETED:'Selesai',PARTIAL:'Sebagian',FAILED:'Gagal'};

export default function ImportCenter(){
  const[jobs,setJobs]=useState<Job[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  async function load(){setLoading(true);const r=await fetch('/api/import-jobs',{cache:'no-store'});const j=await r.json();if(!r.ok)setError(j.error||'Riwayat import tidak dapat dimuat.');else{setJobs(j);setError('')}setLoading(false)}
  useEffect(()=>{void load()},[]);
  const modules=[
    {title:'Anggota',href:'/database',template:'/api/members/spreadsheet?template=1'},
    {title:'Target & Progres',href:'/target',template:'/api/targets/import?template=1'}
  ];
  return <><div className="pageHeader"><h1>Import Center</h1></div>
    <div className="structureGrid">{modules.map(x=><section className="card" key={x.title}><h2>{x.title}</h2><div className="taskLinks section"><a className="btn ghost" href={x.template}>Template</a><Link className="btn" href={x.href}>Buka</Link></div></section>)}</div>
    <section className="section"><div className="cardHead"><h2>Riwayat Import</h2><button className="smallAction" onClick={()=>void load()}>Muat ulang</button></div>{error&&<div className="notice error">{error}</div>}<div className="tableWrap"><table className="table"><thead><tr><th>Waktu</th><th>Data</th><th>File</th><th>Status</th><th>Hasil</th></tr></thead><tbody>{loading?<tr><td colSpan={5}>Memuat…</td></tr>:jobs.map(j=><tr key={j.id}><td>{new Date(j.created_at).toLocaleString('id-ID')}</td><td>{j.resource_type}</td><td>{j.file_name||'-'}</td><td><span className="badge">{label[j.status]||j.status}</span></td><td>{j.inserted_rows} tambah · {j.updated_rows} ubah · {j.error_rows} error</td></tr>)}{!loading&&!jobs.length&&<tr><td colSpan={5}>Belum ada riwayat import.</td></tr>}</tbody></table></div></section>
  </>;
}
