'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {audienceLabels,readScopesForRole,writeScopesForRole,type Audience,type Role} from '@/lib/access';
import {jakartaDate} from '@/lib/domain';
import Recap from '@/components/AttendanceRecap';

type Event={id:string;title:string;event_date:string;audience:string;teacher_name?:string|null;classes?:{name?:string};activity_types?:{name?:string};attendance_records?:unknown[]};
type ClassRow={id:string;name:string;audience:string};

export default function Page(){
  const[month,setMonth]=useState(jakartaDate().slice(0,7));
  const[audience,setAudience]=useState('');
  const[classId,setClassId]=useState('');
  const[classes,setClasses]=useState<ClassRow[]>([]);
  const[events,setEvents]=useState<Event[]>([]);
  const[role,setRole]=useState<Role|null>(null);const[scopedRead,setScopedRead]=useState<Audience[]|null>(null),[scopedWrite,setScopedWrite]=useState<Audience[]|null>(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  const[view,setView]=useState<'input'|'recap'>('input');
  useEffect(()=>{if(new URLSearchParams(window.location.search).get('view')==='rekap')setView('recap')},[]);

  const readable=useMemo(()=>scopedRead??readScopesForRole(role),[role,scopedRead]);
  const writable=useMemo(()=>scopedWrite??writeScopesForRole(role),[role,scopedWrite]);

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
      setEvents(await r.json());setClasses(await c.json());const me=await u.json();setRole(me.role??null);setScopedRead(Array.isArray(me.read_scopes)?me.read_scopes:null);setScopedWrite(Array.isArray(me.write_scopes)?me.write_scopes:null);
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
      <h1>Presensi</h1>
      {view==='input'&&writable.length>0&&<Link href="/presensi/buat" className="btn">+ Presensi</Link>}
    </div>
    <div className="tabBar"><button className={view==='input'?'tab active':'tab'} onClick={()=>setView('input')}>Presensi</button><button className={view==='recap'?'tab active':'tab'} onClick={()=>setView('recap')}>Rekap</button></div>
    {view==='recap'?<Recap embedded/>:<>
    {writable.length>0&&<section className="routineAttendancePanel">
      {writable.includes('KELOMPOK')&&<Link href="/presensi/buat?preset=kelompok" className="routineAttendanceCard"><div><strong>Pengajian Kelompok</strong><span>Senin & Jumat</span></div><small>Absen seluruh kelompok</small></Link>}
      {writable.includes('CABERAWIT')&&<Link href="/presensi/buat?preset=caberawit" className="routineAttendanceCard"><div><strong>Pengajian Caberawit</strong><span>Senin–Sabtu</span></div><small>Absen per kelas + Dewan Guru</small></Link>}
    </section>}
    <div className="toolbar card">
      <input className="input" type="month" value={month} onChange={e=>setMonth(e.target.value)}/>
      <select className="select" value={audience} onChange={e=>{setAudience(e.target.value);setClassId('')}}>
        <option value="">Semua lingkup</option>{readable.map(v=><option key={v} value={v}>{audienceLabels[v]}</option>)}
      </select>
      {(audience==='CABERAWIT'||audience==='MUDA_MUDI')&&<select className="select" value={classId} onChange={e=>setClassId(e.target.value)}>
        <option value="">Semua kelas</option>{classOptions.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </select>}
    </div>
    {error&&<div className="notice error section">{error}</div>}
    <div className="list section">
      {loading?<div className="card"><div className="skeleton" style={{height:62}}/></div>:events.map(e=><div className="item row between" key={e.id}>
        <div><div className="itemTitle">{e.title}</div><div className="itemMeta">{new Date(e.event_date+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})} · {audienceLabels[e.audience as Audience]||e.audience}{e.classes?.name?' · '+e.classes.name:''}{e.teacher_name?' · Guru: '+e.teacher_name:''}</div></div>
        <span className="badge">{e.attendance_records?.length||0} peserta</span>{writable.includes(e.audience as Audience)&&<div className="row"><Link className="smallAction" href={`/catatan?create=1&context=EVENT&event_id=${e.id}`}>Catatan</Link><Link className="btn ghost" href={`/presensi/buat?event_id=${e.id}`}>Buka daftar</Link></div>}
      </div>)}
      {!loading&&!events.length&&<div className="emptyState">Belum ada presensi pada periode ini.</div>}
    </div>
    </>}
  </>;
}
