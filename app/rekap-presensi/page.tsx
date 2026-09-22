'use client';

import {useEffect,useMemo,useState} from 'react';
type ClassRow={id:string;name:string;audience:string};
type Recap={summary:{H:number;I:number;A:number;meetings:number};individuals:Array<{id:string;name:string;class_name:string;H:number;I:number;A:number;percentage:number}>;calendar:Array<{date:string;events:number;recorded:boolean}>};
const labels:Record<string,string>={KELOMPOK:'Kelompok',MUDA_MUDI:'Muda-Mudi',CABERAWIT:'Caberawit',IBU_IBU:'Ibu-Ibu',PENGURUS:'Pengurus'};

export default function Page(){
  const now=new Date();
  const[month,setMonth]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  const[audience,setAudience]=useState('');
  const[classId,setClassId]=useState('');
  const[classes,setClasses]=useState<ClassRow[]>([]);
  const[data,setData]=useState<Recap|null>(null);
  const[error,setError]=useState('');

  const load=async()=>{
    const q=new URLSearchParams({month});if(audience)q.set('audience',audience);if(classId)q.set('class_id',classId);
    try{
      const[r,c]=await Promise.all([fetch('/api/attendance/recap?'+q),fetch('/api/classes')]);
      const j=await r.json();if(!r.ok)throw new Error(j.error);
      setData(j);setClasses(await c.json());setError('');
    }catch{setError('Rekap presensi belum dapat dimuat.')}
  };
  useEffect(()=>{void load()},[month,audience,classId]);
  const classOptions=useMemo(()=>classes.filter(c=>!audience||c.audience===audience),[classes,audience]);

  const first=new Date(Number(month.slice(0,4)),Number(month.slice(5,7))-1,1);
  const offset=(first.getDay()+6)%7;
  const cells=[...Array(offset).fill(null),...(data?.calendar??[])];

  return <>
    <div className="pageHeader"><div><h1>Rekap Presensi</h1></div></div>
    <div className="toolbar card">
      <input className="input" type="month" value={month} onChange={e=>setMonth(e.target.value)}/>
      <select className="select" value={audience} onChange={e=>{setAudience(e.target.value);setClassId('')}}><option value="">Keseluruhan</option>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
      {(audience==='CABERAWIT'||audience==='MUDA_MUDI')&&<select className="select" value={classId} onChange={e=>setClassId(e.target.value)}><option value="">Semua kelas</option>{classOptions.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}
    </div>
    {error&&<div className="notice error section">{error}</div>}
    <div className="metricGrid section">
      <div className="metricCard"><span>Pertemuan</span><strong>{data?.summary.meetings??0}</strong></div>
      <div className="metricCard"><span>Hadir</span><strong>{data?.summary.H??0}</strong></div>
      <div className="metricCard"><span>Izin</span><strong>{data?.summary.I??0}</strong></div>
      <div className="metricCard"><span>Alfa</span><strong>{data?.summary.A??0}</strong></div>
    </div>
    <section className="card section">
      <div className="cardHead"><div><h2>Kalender Presensi</h2><p>Tanggal berwarna berarti sudah ada presensi.</p></div></div>
      <div className="calendarGrid">
        {['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(x=><div className="calendarDayName" key={x}>{x}</div>)}
        {cells.map((x:any,i)=>x?<div className="calendarCell" key={x.date}><div className="calendarDate">{Number(x.date.slice(-2))}</div>{x.recorded?<div className="calendarEvent">{x.events} presensi</div>:<div className="itemMeta">Belum ada</div>}</div>:<div key={'e'+i}/>)}
      </div>
    </section>
    <section className="section">
      <div className="cardHead"><div><h2>Detail Individu</h2><p>H/I/A dan persentase hadir selama satu bulan.</p></div></div>
      <div className="tableWrap"><table className="table"><thead><tr><th>Nama</th><th>Kelas</th><th>H</th><th>I</th><th>A</th><th>Kehadiran</th></tr></thead><tbody>
        {(data?.individuals??[]).map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.class_name||'-'}</td><td>{p.H}</td><td>{p.I}</td><td>{p.A}</td><td>{p.percentage}%</td></tr>)}
        {data&&!data.individuals.length&&<tr><td colSpan={6}>Belum ada individu pada filter ini.</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
