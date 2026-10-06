'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowRight,CheckCircle2} from 'lucide-react';

type Item={id:string;title:string;detail:string;href:string};
type Data={summary:{members:number;attendance:number;journals:number;documentation:number;followups:number;imports:number;total:number};groups:Array<{key:string;title:string;items:Item[]}>};
export default function CompletenessPage(){
  const[data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  async function load(){setLoading(true);const r=await fetch('/api/completeness',{cache:'no-store'});const j=await r.json();if(!r.ok)setError(j.error||'Data tidak dapat dimuat.');else{setData(j);setError('')}setLoading(false)}
  useEffect(()=>{void load()},[]);
  const cards=data?[['Data Anggota',data.summary.members],['Presensi',data.summary.attendance],['Jurnal',data.summary.journals],['Dokumentasi',data.summary.documentation],['Tindak Lanjut',data.summary.followups],['Import',data.summary.imports]]:[];
  return <><div className="pageHeader"><h1>Kelengkapan</h1><button className="btn ghost" onClick={()=>void load()}>Muat Ulang</button></div>
    {error&&<div className="notice error">{error}</div>}
    {loading?<div className="card"><div className="skeleton" style={{height:100}}/></div>:data?.summary.total===0?<div className="card completenessClear"><CheckCircle2 size={26}/><strong>Semua beres</strong></div>:<>
      <div className="metricGrid">{cards.map(([label,value])=><div className="metricCard" key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</div>
      {data?.groups.filter(g=>g.items.length).map(g=><section className="card section" key={g.key}><div className="cardHead"><h2>{g.title}</h2><span className="badge">{g.items.length}</span></div><div className="list">{g.items.map(x=><Link href={x.href} className="categoryRow" key={x.id}><span><strong>{x.title}</strong><small className="itemMeta">{x.detail}</small></span><ArrowRight size={15}/></Link>)}</div></section>)}
    </>}
  </>;
}
