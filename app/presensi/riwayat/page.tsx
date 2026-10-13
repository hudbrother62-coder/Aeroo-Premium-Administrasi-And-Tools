'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {ChevronLeft,ChevronRight,ArrowLeft} from 'lucide-react';
import {jakartaDate} from '@/lib/domain';
import {audienceLabels,readScopesForRole,type Audience,type Role} from '@/lib/access';
import '@/app/presensi/routine.css';

type Meeting={id:string;event_date:string;title:string;audience:string;class_id?:string|null;classes?:{name:string}|null;attendance_records?:Array<{status:string|null}>};
type Class={id:string;name:string;audience:string};
export default function Page(){
 const [month,setMonth]=useState(jakartaDate().slice(0,7));
 const [date,setDate]=useState(jakartaDate());
 const [audience,setAudience]=useState('');
 const [classId,setClassId]=useState('');
 const [scopes,setScopes]=useState<Audience[]>([]);
 const [classes,setClasses]=useState<Class[]>([]);
 const [events,setEvents]=useState<Meeting[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{Promise.all([fetch('/api/auth/me').then(r=>r.json()),fetch('/api/classes').then(r=>r.json())]).then(([u,c])=>{const allowed=(Array.isArray(u.read_scopes)?u.read_scopes:readScopesForRole((u.role||'VIEWER') as Role)) as Audience[];setScopes(allowed);setAudience(allowed.length===1?allowed[0]:'');setClasses(Array.isArray(c)?c:[])}).catch(()=>setError('Akses tidak tersedia'))},[]);
 useEffect(()=>{const d=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();const q=new URLSearchParams({from:month+'-01',to:month+'-'+String(d).padStart(2,'0')});if(audience)q.set('audience',audience);if(classId)q.set('class_id',classId);const ac=new AbortController();setBusy(true);fetch('/api/attendance?'+q,{signal:ac.signal}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||'Riwayat tidak tersedia');return j}).then(j=>setEvents(Array.isArray(j)?j:[])).catch(e=>{if(!ac.signal.aborted)setError(e.message)}).finally(()=>{if(!ac.signal.aborted)setBusy(false)});return()=>ac.abort()},[month,audience,classId]);
 useEffect(()=>{if(!date.startsWith(month))setDate(month+'-01')},[month,date]);
 const days=useMemo(()=>{const y=Number(month.slice(0,4)),m=Number(month.slice(5,7));return [...Array((new Date(y,m-1,1).getDay()+6)%7).fill(null),...Array.from({length:new Date(y,m,0).getDate()},(_,i)=>month+'-'+String(i+1).padStart(2,'0'))] as Array<string|null>},[month]);
 const counts=useMemo(()=>{const map=new Map<string,number>();events.forEach(x=>map.set(x.event_date,(map.get(x.event_date)||0)+1));return map},[events]);
 function move(n:number){const d=new Date(Number(month.slice(0,4)),Number(month.slice(5,7))-1+n,1);setMonth(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'))}
 const chosen=events.filter(x=>x.event_date===date);
 return <main className="attendancePage"><div className="pageHeader"><div><Link href="/presensi" className="journalBack"><ArrowLeft size={16}/> Presensi</Link><h1>Riwayat Presensi</h1></div></div>
 <div className="attendanceWorkspace">
 <section className="attendancePanel">
 <div className="attendanceFilters"><label>Kategori<select className="select" value={audience} onChange={e=>{setAudience(e.target.value);setClassId('')}}><option value="">Semua kategori</option>{scopes.map(x=><option key={x} value={x}>{audienceLabels[x]}</option>)}</select></label><label>Kelas<select className="select" value={classId} onChange={e=>setClassId(e.target.value)}><option value="">Semua kelas</option>{classes.filter(c=>scopes.includes(c.audience as Audience)&&(!audience||audience===c.audience)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
 <div className="attendanceMonthHead"><button className="smallAction" onClick={()=>move(-1)} aria-label="Bulan lalu"><ChevronLeft size={18}/></button><input className="input" aria-label="Pilih bulan" type="month" value={month} onChange={e=>setMonth(e.target.value)}/><button className="smallAction" onClick={()=>move(1)} aria-label="Bulan depan"><ChevronRight size={18}/></button></div>
 <div className="attendanceCalendar">{['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(x=><span className="attendanceWeekName" key={x}>{x}</span>)}{days.map((d,i)=>d?<button className={'attendanceDay'+(date===d?' selected':'')} key={d} onClick={()=>setDate(d)} aria-pressed={date===d}><strong>{Number(d.slice(-2))}</strong>{!!counts.get(d)&&<small>{counts.get(d)} <span className="attendanceDateDot"/></small>}</button>:<span className="attendanceDayEmpty" key={'blank'+i}/>)}</div>
 </section><section className="attendancePanel"><div className="attendancePanelHead"><h2>{new Date(date+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</h2><span>{chosen.length} pertemuan</span></div>
 {error&&<div className="notice error">{error}</div>}{busy?<div className="emptyState">Memuat…</div>:chosen.length?<div className="list">{chosen.map((e,i)=><article className="item" key={e.id}><h3>{i+1}. {e.title}</h3><div className="itemMeta">{audienceLabels[e.audience as Audience]||e.audience}{e.classes?.name?' · '+e.classes.name:''}</div><div className="row"><Link className="btn secondary" href={'/presensi/buat?event_id='+e.id}>Buka Presensi</Link><Link className="btn ghost" href={'/presensi/rekap?event_id='+e.id+'&month='+month}>Detail Rekap</Link></div></article>)}</div>:<div className="emptyState">Belum ada pertemuan.</div>}
 </section></div></main>
}
