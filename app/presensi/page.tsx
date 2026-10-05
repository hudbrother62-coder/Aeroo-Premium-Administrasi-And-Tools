'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {audienceLabels,readScopesForRole,writeScopesForRole,type Audience,type Role} from '@/lib/access';
import Recap from '@/components/AttendanceRecap';

type Event={id:string;title:string;event_date:string;audience:string;classes?:{name?:string};activity_types?:{name?:string};attendance_records?:unknown[]};
type ClassRow={id:string;name:string;audience:string};

export default function Page(){
  const now=new Date();
  const[month,setMonth]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  const[audience,setAudience]=useState('');
  const[classId,setClassId]=useState('');
  const[classes,setClasses]=useState<ClassRow[]>([]);
  const[events,setEvents]=useState<Event[]>([]);
  const[role,setRole]=useState<Role|null>(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  const[view,setView]=useState<'input'|'recap'>('input');
  useEffect(()=>{if(new URLSearchParams(window.location.search).get('view')==='rekap')setView('recap')},[]);

  const readable=useMemo(()=>readScopesForRole(role),[role]);
  const writable=useMemo(()=>writeScopesForRole(role),[role]);

  const load=async()=>{
    setLoading(true);setError('');
    const start=month+'-01';
    const d=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0);
    const end=`${month}-${String(d.getDate()).padStart(2,'0')}`;
    const q=new URLSearchParams({from:start,to:end});
    if(audience)q.set('audience',audience);
    if(classId)q.set('class_id',classId);
    try{
      const[r,c,u]=await Promise.all([fetch('/api/attendance?'+q),fetch('/api/classes'),fetch('/api/auth/me')]);
      if(!r.ok||!c.ok||!u.ok)throw new Error();
      setEvents(await r.json());setClasses(await c.json());setRole((await u.json()).role??null);
    }catch{setError('Presensi belum dapat dimuat.')}
    finally{setLoading(false)}
  };
  useEffect(()=>{void load()},[month,audience,classId]);

  useEffect(()=>{
    if(audience&&!readable.includes(audience as Audience)){setAudience('');setClassId('')}
  },[readable,audience]);

  const classOptions=useMemo(()=>classes.filter(c=>!audience||c.audience===audience),[classes,audience]);

  return <>
    <div className="pageHeader">
      <div><h1>Presensi</h1><p>Isi daftar hadir dan telusuri hasil pertemuan.</p></div>
      {view==='input'&&writable.length>0&&<Link href="/presensi/buat" className="btn">+ Presensi</Link>}
    </div>
    <div className="tabBar"><button className={view==='input'?'tab active':'tab'} onClick={()=>setView('input')}>Daftar presensi</button><button className={view==='recap'?'tab active':'tab'} onClick={()=>setView('recap')}>Rekap & individu</button></div>
    {view==='recap'?<Recap embedded/>:<>
    <div className="toolbar card">
      <input className="input" type="month" value={month} onChange={e=>setMonth(e.target.value)}/>
      <select className="select" value={audience} onChange={e=>{setAudience(e.target.value);setClassId('')}}>
        <option value="">Semua akses</option>{readable.map(v=><option key={v} value={v}>{audienceLabels[v]}</option>)}
      </select>
      {(audience==='CABERAWIT'||audience==='MUDA_MUDI')&&<select className="select" value={classId} onChange={e=>setClassId(e.target.value)}>
        <option value="">Semua kelas</option>{classOptions.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </select>}
    </div>
    {error&&<div className="notice error section">{error}</div>}
    <div className="list section">
      {loading?<div className="card"><div className="skeleton" style={{height:62}}/></div>:events.map(e=><div className="item row between" key={e.id}>
        <div><div className="itemTitle">{e.title}</div><div className="itemMeta">{new Date(e.event_date+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})} · {audienceLabels[e.audience as Audience]||e.audience}{e.classes?.name?' · '+e.classes.name:''}</div></div>
        <span className="badge">{e.attendance_records?.length||0} peserta</span>{writable.includes(e.audience as Audience)&&<Link className="btn ghost" href={`/presensi/buat?event_id=${e.id}`}>Buka daftar</Link>}
      </div>)}
      {!loading&&!events.length&&<div className="emptyState">Belum ada presensi pada periode ini.</div>}
    </div>
    </>}
  </>;
}
