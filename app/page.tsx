'use client';

import {useEffect,useMemo,useState} from 'react';

type Trend={label:string;H:number;I:number;A:number};
type Level={id:string;name:string};
type Stats={
  total:number;caberawit:number;mudaMudi:number;pengurus:number;
  month:{H:number;I:number;A:number};trend:Trend[];
};

function Metric({label,value}:{label:string;value:number|string}){
  return <div className="metricCard"><span>{label}</span><strong>{value}</strong></div>;
}

export default function Dashboard(){
  const[data,setData]=useState<Stats|null>(null);
  const[levels,setLevels]=useState<Level[]>([]);
  const[levelId,setLevelId]=useState('');
  const[error,setError]=useState('');
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    fetch('/api/levels').then(r=>r.json()).then(v=>Array.isArray(v)&&setLevels(v)).catch(()=>{});
  },[]);

  useEffect(()=>{
    setLoading(true);setError('');
    const q=new URLSearchParams();
    if(levelId)q.set('level_id',levelId);
    fetch('/api/dashboard'+(q.toString()?'?'+q:''))
      .then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error);return j})
      .then(setData)
      .catch(()=>setError('Dashboard belum dapat dimuat.'))
      .finally(()=>setLoading(false));
  },[levelId]);

  const max=useMemo(()=>Math.max(1,...(data?.trend??[]).map(x=>x.H+x.I+x.A)),[data]);
  const levelName=levels.find(x=>x.id===levelId)?.name;

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
        <div className="cardHead">
          <div><h2>Tren Presensi 6 Bulan</h2><p>{levelName?`Khusus jenjang ${levelName}.`:'Semua jenjang.'}</p></div>
          <div className="trendControls">
            <select className="select" aria-label="Pilih jenjang tren kehadiran" value={levelId} onChange={e=>setLevelId(e.target.value)}>
              <option value="">Semua jenjang</option>
              {levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>

        <div className="barChart" aria-label="Grafik tren presensi enam bulan">
          {(data?.trend??[]).map(x=>{
            const total=x.H+x.I+x.A;
            const h=total?x.H/max*100:0;
            const i=total?x.I/max*100:0;
            const a=total?x.A/max*100:0;
            return <div className="barCol" key={x.label} title={`${x.label}: H ${x.H}, I ${x.I}, A ${x.A}`}>
              <div className="barValue">{total}</div>
              <div className="stackedTrack">
                <div className="stackSeg h" style={{height:`${h}%`}}/>
                <div className="stackSeg i" style={{height:`${i}%`}}/>
                <div className="stackSeg a" style={{height:`${a}%`}}/>
              </div>
              <span>{x.label}</span>
            </div>;
          })}
          {loading&&[1,2,3,4,5,6].map(i=><div className="barCol" key={i}><div className="stackedTrack skeleton"/></div>)}
        </div>
        <div className="chartLegend">
          <span><i className="legendDot h"/>Hadir</span>
          <span><i className="legendDot i"/>Izin</span>
          <span><i className="legendDot a"/>Alfa</span>
        </div>
      </section>

      <section className="card">
        <div className="cardHead"><div><h2>Bulan Ini</h2><p>{levelName?`Jenjang ${levelName}`:'Semua jenjang'}</p></div></div>
        <div className="attendanceSummary">
          <div><span>H</span><strong>{data?.month.H??0}</strong><small>Hadir</small></div>
          <div><span>I</span><strong>{data?.month.I??0}</strong><small>Izin</small></div>
          <div><span>A</span><strong>{data?.month.A??0}</strong><small>Alfa</small></div>
        </div>
      </section>
    </div>
  </>;
}
