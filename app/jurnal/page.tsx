'use client';

import Link from 'next/link';
import {readScopesForRole,writeScopesForRole} from '@/lib/access';
import {useEffect,useState} from 'react';

type Journal={id:string;journal_date:string;journal_kind:string;title:string;state?:string;revision?:number;material?:string;summary?:string;decisions?:string;assessment?:{materials?:Array<{topic:string;page:string}>;meeting_type?:string;absence?:string};classes?:{name?:string};members?:{name?:string}};
const tabs=[['','Semua'],['KELOMPOK','Kelompok'],['IBU_IBU','Ibu-Ibu'],['PENGURUS','Musyawarah'],['CABERAWIT_CLASS','Jabirawit Kelas'],['CABERAWIT_INDIVIDUAL','Jabirawit Individu'],['MUDA_MUDI_CLASS','Remaja Kelas'],['MUDA_MUDI_INDIVIDUAL','Remaja Individu']] as const;
const labels:Record<string,string>={KELOMPOK:'Kelompok',IBU_IBU:'Ibu-Ibu',PENGURUS:'Musyawarah',CABERAWIT_CLASS:'Jabirawit Kelas',CABERAWIT_INDIVIDUAL:'Jabirawit Individu',MUDA_MUDI_CLASS:'Remaja Kelas',MUDA_MUDI_INDIVIDUAL:'Remaja Individu'};

export default function Page(){
  const[kind,setKind]=useState('');const[role,setRole]=useState('VIEWER');useEffect(()=>{fetch('/api/auth/me').then(r=>r.json()).then(u=>setRole(u.role))},[]);
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
    <div className="tabBar">{tabs.filter(([v])=>!v||readScopesForRole(role).includes((v.startsWith('CABERAWIT')?'CABERAWIT':v.startsWith('MUDA_MUDI')?'MUDA_MUDI':v) as any)).map(([v,l])=><button key={v} className={kind===v?'tab active':'tab'} onClick={()=>setKind(v)}>{l}</button>)}</div>
    {error&&<div className="notice error">{error}</div>}
    <div className="list section">
      {loading?<div className="card">Memuat…</div>:data.map(j=><article className="item" key={j.id}>
        <div className="row between"><span className="badge">{labels[j.journal_kind]||j.journal_kind}</span><span className="itemMeta">{new Date(j.journal_date+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</span></div>
        <div className="row between"><span className="badge">{j.state||'DRAFT'}</span>{writeScopesForRole(role).includes((j.journal_kind.startsWith('CABERAWIT')?'CABERAWIT':j.journal_kind.startsWith('MUDA_MUDI')?'MUDA_MUDI':j.journal_kind) as any)&&<Link className="btn ghost writeOnly" href={`/jurnal/buat?journal_id=${j.id}`}>Edit / {j.state==='ARCHIVED'?'Pulihkan':'Arsipkan'}</Link>}</div><h3 style={{margin:'12px 0 5px'}}>{j.title}</h3>
        <div className="itemMeta">{j.classes?.name||j.members?.name||''}{j.assessment?.meeting_type?' · '+j.assessment.meeting_type:''}{j.assessment?.absence&&j.assessment.absence!=='HADIR'?' · '+j.assessment.absence:''}</div>
        <p style={{fontSize:12,margin:'9px 0 0'}}>{j.journal_kind==='PENGURUS'?(j.summary||j.decisions||'Belum ada notulensi.'):(j.material||j.summary||'Belum ada catatan.')}</p>
        {!!j.assessment?.materials?.length&&<div className="chips section">{j.assessment.materials.map((m,i)=><span className="chip" key={i}>{m.topic}{m.page?' · hal. '+m.page:''}</span>)}</div>}
      </article>)}
      {!loading&&!data.length&&<div className="emptyState">Belum ada jurnal.</div>}
    </div>
  </>;
}
