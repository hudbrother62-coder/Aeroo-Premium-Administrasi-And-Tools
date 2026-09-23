'use client';

import {useEffect,useMemo,useState} from 'react';

type Trend={label:string;H:number;I:number;A:number};
type Stats={
  total:number;caberawit:number;mudaMudi:number;pengurus:number;
  month:{H:number;I:number;A:number};trend:Trend[];
};

function Metric({label,value}:{label:string;value:number|string}){
  return <div className="metricCard"><span>{label}</span><strong>{value}</strong></div>;
}

export default function Dashboard(){
  const[data,setData]=useState<Stats|null>(null);
  const[error,setError]=useState('');
  useEffect(()=>{fetch('/api/dashboard').then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error);return j}).then(setData).catch(()=>setError('Dashboard belum dapat dimuat.'))},[]);
  const max=useMemo(()=>Math.max(1,...(data?.trend??[]).map(x=>x.H+x.I+x.A)),[data]);

  return <>
    <div className="pageHeader"><div><h1>Dashboard</h1><p>Ringkasan data dan kehadiran.</p></div></div>
    {error&&<div className="notice error">{error}</div>}
    <div className="metricGrid">
      <Metric label="Database keseluruhan" value={data?.total??'…'}/>
      <Metric label="Caberawit" value={data?.caberawit??'…'}/>
      <Metric label="Muda-Mudi" value={data?.mudaMudi??'…'}/>
      <Metric label="Pengurus" value={data?.pengurus??'…'}/>
    </div>
    <div className="dashboardGrid section">
      <section className="card">
        <div className="cardHead"><div><h2>Tren Presensi 6 Bulan</h2><p>Hadir, izin, dan alfa per bulan.</p></div></div>
        <div className="barChart">
          {(data?.trend??[]).map(x=>{
            const total=x.H+x.I+x.A;
            return <div className="barCol" key={x.label}>
              <div className="barValue">{total}</div>
              <div className="barTrack"><div className="barFill" style={{height:`${Math.max(5,total/max*100)}%`}}/></div>
              <span>{x.label}</span>
            </div>;
          })}
          {!data&&[1,2,3,4,5,6].map(i=><div className="barCol" key={i}><div className="barTrack skeleton"/></div>)}
        </div>
      </section>
      <section className="card">
        <div className="cardHead"><div><h2>Bulan Ini</h2><p>Komposisi kehadiran.</p></div></div>
        <div className="attendanceSummary">
          <div><span>H</span><strong>{data?.month.H??0}</strong><small>Hadir</small></div>
          <div><span>I</span><strong>{data?.month.I??0}</strong><small>Izin</small></div>
          <div><span>A</span><strong>{data?.month.A??0}</strong><small>Alfa</small></div>
        </div>
      </section>
    </div>
  </>;
}
