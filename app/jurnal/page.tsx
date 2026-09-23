'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';

type Journal={id:string;journal_date:string;journal_kind:string;title:string;material?:string;summary?:string;decisions?:string;classes?:{name?:string};members?:{name?:string}};
const tabs=[['','Semua'],['KELOMPOK','Kelompok'],['IBU_IBU','Ibu-Ibu'],['PENGURUS','Pengurus'],['CABERAWIT_CLASS','Caberawit Kelas'],['CABERAWIT_INDIVIDUAL','Caberawit Individu']] as const;
const labels:Record<string,string>={KELOMPOK:'Kelompok',IBU_IBU:'Ibu-Ibu',PENGURUS:'Pengurus',CABERAWIT_CLASS:'Caberawit Kelas',CABERAWIT_INDIVIDUAL:'Caberawit Individu'};

export default function Page(){
  const[kind,setKind]=useState('');
  const[data,setData]=useState<Journal[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');

  const load=async()=>{
    setLoading(true);
    const q=new URLSearchParams();if(kind)q.set('kind',kind);
    try{const r=await fetch('/api/journals?'+q);const j=await r.json();if(!r.ok)throw new Error(j.error);setData(j);setError('')}
    catch{setError('Jurnal belum dapat dimuat.')}finally{setLoading(false)}
  };
  useEffect(()=>{void load()},[kind]);

  return <>
    <div className="pageHeader"><div><h1>Jurnal</h1></div><Link className="btn writeOnly" href="/jurnal/buat">+ Buat Jurnal</Link></div>
    <div className="tabBar">{tabs.map(([v,l])=><button key={v} className={kind===v?'tab active':'tab'} onClick={()=>setKind(v)}>{l}</button>)}</div>
    {error&&<div className="notice error">{error}</div>}
    <div className="list section">
      {loading?<div className="card">Memuat…</div>:data.map(j=><article className="item" key={j.id}>
        <div className="row between"><span className="badge">{labels[j.journal_kind]||j.journal_kind}</span><span className="itemMeta">{new Date(j.journal_date+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</span></div>
        <h3 style={{margin:'12px 0 5px'}}>{j.title}</h3>
        <div className="itemMeta">{j.classes?.name||j.members?.name||''}</div>
        <p style={{fontSize:12,margin:'9px 0 0'}}>{j.journal_kind==='PENGURUS'?(j.summary||j.decisions||'Belum ada notulensi.'):(j.material||j.summary||'Belum ada catatan.')}</p>
      </article>)}
      {!loading&&!data.length&&<div className="emptyState">Belum ada jurnal.</div>}
    </div>
  </>;
}
