'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {CalendarDays,ChevronLeft,ChevronRight,ClipboardCheck,History,BarChart3,ArrowRight} from 'lucide-react';
import CreateAttendance from '@/components/AttendanceCreate';
import AttendanceRecap from '@/components/AttendanceRecap';
import {audienceLabels,readScopesForRole,writeScopesForRole,type Audience,type Role} from '@/lib/access';
import {jakartaDate} from '@/lib/domain';

type EventRow={
  id:string;title:string;event_date:string;audience:string;class_id?:string|null;level_id?:string|null;
  classes?:{name:string}|null;activity_types?:{name:string}|null;
  attendance_records?:Array<{status:'H'|'I'|'A'|null;class_id_snapshot?:string|null;level_id_snapshot?:string|null}>;
};
type ClassRow={id:string;name:string;audience:string;level_id?:string|null};
type LevelRow={id:string;name:string};
type Tab='baru'|'riwayat'|'rekap';
const labelDate=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const statusCount=(e:EventRow,s:'H'|'I'|'A')=>(e.attendance_records||[]).filter(r=>r.status===s).length;

function HistoryView({onRecap}:{onRecap:(id:string,date:string)=>void}){
 const [month,setMonth]=useState(jakartaDate().slice(0,7));
 const [selected,setSelected]=useState(jakartaDate());
 const [audience,setAudience]=useState('');
 const [level,setLevel]=useState('');
 const [classId,setClassId]=useState('');
 const [events,setEvents]=useState<EventRow[]>([]);
 const [classes,setClasses]=useState<ClassRow[]>([]);
 const [levels,setLevels]=useState<LevelRow[]>([]);
 const [readable,setReadable]=useState<Audience[]>([]);
 const [writable,setWritable]=useState<Audience[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{let live=true;
   Promise.all([fetch('/api/classes'),fetch('/api/levels'),fetch('/api/auth/me')]).then(async responses=>{
     if(responses.some(r=>!r.ok))throw Error('Gagal memuat hak akses.');
     const [c,l,u]=await Promise.all(responses.map(r=>r.json()));
     if(!live)return;
     setClasses(Array.isArray(c)?c:[]);setLevels(Array.isArray(l)?l:[]);
     const role=(u.role||'VIEWER') as Role;
     setReadable(Array.isArray(u.read_scopes)?u.read_scopes:readScopesForRole(role));
     setWritable(Array.isArray(u.write_scopes)?u.write_scopes:writeScopesForRole(role));
   }).catch(()=>{if(live)setError('Hak akses belum dapat dimuat.');});
   return()=>{live=false};
 },[]);
 useEffect(()=>{let live=true;const start=month+'-01';
   const end=month+'-'+String(new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate()).padStart(2,'0');
   const params=new URLSearchParams({from:start,to:end});if(audience)params.set('audience',audience);if(classId)params.set('class_id',classId);
   setLoading(true);setError('');
   fetch('/api/attendance?'+params.toString()).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.error||'Gagal memuat riwayat.');return body;})
    .then(rows=>{if(live)setEvents(Array.isArray(rows)?rows:[]);})
    .catch(e=>{if(live)setError(e.message);})
    .finally(()=>{if(live)setLoading(false);});
   return()=>{live=false};
 },[month,audience,classId]);
 useEffect(()=>{if(!selected.startsWith(month))setSelected(month+'-01');},[month,selected]);
 const scoped=useMemo(()=>events.filter(e=>!level||e.level_id===level||(e.attendance_records||[]).some(r=>r.level_id_snapshot===level)),[events,level]);
 const dates=useMemo(()=>{const m=new Map<string,EventRow[]>();scoped.forEach(e=>m.set(e.event_date,[...(m.get(e.event_date)||[]),e]));return m;},[scoped]);
 const selectedEvents=dates.get(selected)||[];
 const days=useMemo(()=>{const year=Number(month.slice(0,4)),mo=Number(month.slice(5,7));const first=(new Date(year,mo-1,1).getDay()+6)%7;const total=new Date(year,mo,0).getDate();return [...Array(first).fill(null),...Array.from({length:total},(_,i)=>month+'-'+String(i+1).padStart(2,'0'))] as Array<string|null>;},[month]);
 const filteredClasses=classes.filter(c=>(!audience||c.audience===audience)&&(!level||c.level_id===level));
 const changeMonth=(n:number)=>{const d=new Date(Number(month.slice(0,4)),Number(month.slice(5,7))-1+n,1);setMonth(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));};
 return <div className="attendanceWorkspace">
   <section className="attendancePanel">
     <div className="attendancePanelHead"><div><h2>Riwayat Presensi</h2><p>Pilih tanggal yang bertanda, kemudian buka pertemuan untuk melihat atau mengubah absensi.</p></div><span className="attendanceSubtle">{scoped.length} pertemuan</span></div>
     <div className="attendanceFilters">
       <label>Lingkup<select className="select" value={audience} onChange={e=>{setAudience(e.target.value);setLevel('');setClassId('');}}><option value="">Semua lingkup</option>{readable.map(a=><option key={a} value={a}>{audienceLabels[a]}</option>)}</select></label>
       <label>Jenjang<select className="select" value={level} onChange={e=>{setLevel(e.target.value);setClassId('');}}><option value="">Semua jenjang</option>{levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
       <label>Kelas<select className="select" value={classId} onChange={e=>setClassId(e.target.value)}><option value="">Semua kelas</option>{filteredClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
     </div>
     <div className="attendanceMonthHead"><button type="button" className="smallAction" onClick={()=>changeMonth(-1)} aria-label="Bulan sebelumnya"><ChevronLeft size={18}/></button><strong>{new Date(month+'-01T12:00:00').toLocaleDateString('id-ID',{month:'long',year:'numeric'})}</strong><button type="button" className="smallAction" onClick={()=>changeMonth(1)} aria-label="Bulan selanjutnya"><ChevronRight size={18}/></button></div>
     {error&&<div role="alert" className="notice error">{error}</div>}
     <div className="attendanceCalendar">
       {['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(d=><span className="attendanceWeekName" key={d}>{d}</span>)}
       {days.map((day,i)=>day?<button key={day} type="button" className={'attendanceDay'+(selected===day?' selected':'')+(day===jakartaDate()?' today':'')} onClick={()=>setSelected(day)} aria-pressed={selected===day} aria-label={labelDate(day)+', '+(dates.get(day)?.length||0)+' pertemuan'}><strong>{Number(day.slice(-2))}</strong>{!!dates.get(day)?.length&&<small>{dates.get(day)?.length} <span className="attendanceDateDot"/></small>}</button>:<span key={'empty'+i} className="attendanceDayEmpty"/>)}
     </div>
   </section>
   <section className="attendancePanel">
     <div className="attendancePanelHead"><div><h2>{labelDate(selected)}</h2><p>{selectedEvents.length} pertemuan tercatat pada tanggal ini</p></div><CalendarDays size={19}/></div>
     {loading?<div className="skeleton" style={{height:100}}/>:selectedEvents.length?<div className="attendanceMeetingList">{selectedEvents.map(e=><article className="attendanceMeeting" key={e.id}><div className="attendanceMeetingBody"><h3>{e.title}</h3><p>{audienceLabels[e.audience as Audience]||e.audience}{e.classes?.name?' · '+e.classes.name:''}{e.activity_types?.name?' · '+e.activity_types.name:''}</p><div className="attendanceMeetingStats"><span>{statusCount(e,'H')} Hadir</span><span>{statusCount(e,'I')} Izin</span><span>{statusCount(e,'A')} Alfa</span><span>{(e.attendance_records||[]).filter(r=>r.status==null).length} Belum</span></div></div><div className="attendanceMeetingActions"><button type="button" className="btn ghost" onClick={()=>onRecap(e.id,e.event_date)}>Detail <ArrowRight size={15}/></button>{writable.includes(e.audience as Audience)&&<Link className="btn secondary" href={'/presensi/buat?event_id='+e.id}>Edit absensi</Link>}</div></article>)}</div>:<div className="attendanceEmpty"><CalendarDays size={27}/><strong>Belum ada presensi di tanggal ini</strong><span>Pilih tanggal bertanda untuk melihat pertemuan yang sudah dicatat.</span></div>}
   </section>
 </div>;
}
export default function PresensiPage(){
 const [tab,setTab]=useState<Tab>('baru');
 const [focusEvent,setFocusEvent]=useState('');
 useEffect(()=>{const read=()=>{const p=new URLSearchParams(window.location.search);const current=p.get('tab');setTab(current==='riwayat'||current==='rekap'?current:'baru');setFocusEvent(p.get('event_id')||'');};read();window.addEventListener('popstate',read);return()=>window.removeEventListener('popstate',read);},[]);
 function select(next:Tab,event='',date=''){setTab(next);setFocusEvent(event);const p=new URLSearchParams();if(next!=='baru')p.set('tab',next);if(event)p.set('event_id',event);if(date)p.set('month',date.slice(0,7));window.history.pushState(null,'','/presensi'+(p.size?'?'+p.toString():''));}
 return <div className="attendancePage">
  <div className="pageHeader"><div><h1>Presensi</h1><p>Mulai absensi, perbaiki riwayat, atau lihat rekap dari data yang sama.</p></div></div>
  <nav className="attendanceNav" aria-label="Subnavigasi presensi">
   <button type="button" onClick={()=>select('baru')} className={tab==='baru'?'active':''} aria-current={tab==='baru'?'page':undefined}><ClipboardCheck size={18}/><span>Absensi Baru</span></button>
   <button type="button" onClick={()=>select('riwayat')} className={tab==='riwayat'?'active':''} aria-current={tab==='riwayat'?'page':undefined}><History size={18}/><span>Riwayat</span></button>
   <button type="button" onClick={()=>select('rekap')} className={tab==='rekap'?'active':''} aria-current={tab==='rekap'?'page':undefined}><BarChart3 size={18}/><span>Rekap</span></button>
  </nav>
  {tab==='baru'?<CreateAttendance embedded/>:tab==='riwayat'?<HistoryView onRecap={(id,date)=>select('rekap',id,date)}/>:<AttendanceRecap embedded focusEventId={focusEvent}/>}
 </div>;
}
