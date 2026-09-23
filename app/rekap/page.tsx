'use client';

import {useEffect,useState} from 'react';

type Summary={month:string;counts:{total:number;caberawit:number;muda_mudi:number;pengurus:number;ibu_ibu:number};attendance:{H:number;I:number;A:number;meetings:number};journals:number;individuals:Array<{id:string;name:string;categories:string[];class_name:string;level_name:string;H:number;I:number;A:number;percentage:number;journals:number}>};

export default function RekapPage(){
  const now=new Date();
  const[month,setMonth]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  const[mode,setMode]=useState<'ALL'|'PERSON'>('ALL');
  const[selected,setSelected]=useState('');
  const[data,setData]=useState<Summary|null>(null);
  const[error,setError]=useState('');

  const load=async()=>{try{const r=await fetch('/api/summary?month='+month);const j=await r.json();if(!r.ok)throw new Error(j.error);setData(j);setError('')}catch{setError('Rekap data belum dapat dimuat.')}};
  useEffect(()=>{void load()},[month]);
  const person=data?.individuals.find(x=>x.id===selected)||data?.individuals[0];

  return <>
    <div className="pageHeader"><div><h1>Rekap Data</h1></div></div>
    <div className="toolbar card"><input className="input" type="month" value={month} onChange={e=>setMonth(e.target.value)}/><div className="tabBar" style={{margin:0}}><button className={mode==='ALL'?'tab active':'tab'} onClick={()=>setMode('ALL')}>Keseluruhan</button><button className={mode==='PERSON'?'tab active':'tab'} onClick={()=>setMode('PERSON')}>1 Individu</button></div></div>
    {error&&<div className="notice error section">{error}</div>}
    {mode==='ALL'&&data&&<>
      <div className="metricGrid section">
        <div className="metricCard"><span>Total database</span><strong>{data.counts.total}</strong></div>
        <div className="metricCard"><span>Caberawit</span><strong>{data.counts.caberawit}</strong></div>
        <div className="metricCard"><span>Muda-Mudi</span><strong>{data.counts.muda_mudi}</strong></div>
        <div className="metricCard"><span>Pengurus</span><strong>{data.counts.pengurus}</strong></div>
      </div>
      <div className="dashboardGrid section">
        <section className="card"><h2>Presensi Bulan Ini</h2><div className="attendanceSummary"><div><span>H</span><strong>{data.attendance.H}</strong><small>Hadir</small></div><div><span>I</span><strong>{data.attendance.I}</strong><small>Izin</small></div><div><span>A</span><strong>{data.attendance.A}</strong><small>Alfa</small></div></div></section>
        <section className="card"><h2>Aktivitas</h2><div className="metricCard" style={{boxShadow:'none'}}><span>Jurnal tersimpan</span><strong>{data.journals}</strong></div></section>
      </div>
    </>}
    {mode==='PERSON'&&data&&<>
      <div className="card section"><label style={{display:'grid',gap:6,fontSize:11,fontWeight:800,color:'var(--muted)'}}>Pilih individu<select className="select" value={person?.id||''} onChange={e=>setSelected(e.target.value)}>{data.individuals.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
      {person&&<div className="dashboardGrid section">
        <section className="card"><h2>{person.name}</h2><div className="itemMeta">{person.categories.join(' • ')||'Tanpa kategori'} · {person.class_name||'Tanpa kelas'} · {person.level_name||'Tanpa jenjang'}</div><div className="attendanceSummary section"><div><span>H</span><strong>{person.H}</strong><small>Hadir</small></div><div><span>I</span><strong>{person.I}</strong><small>Izin</small></div><div><span>A</span><strong>{person.A}</strong><small>Alfa</small></div></div></section>
        <section className="card"><div className="metricCard" style={{boxShadow:'none'}}><span>Persentase hadir</span><strong>{person.percentage}%</strong></div><div className="metricCard section" style={{boxShadow:'none'}}><span>Jurnal individu</span><strong>{person.journals}</strong></div></section>
      </div>}
    </>}
  </>;
}
