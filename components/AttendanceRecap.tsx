'use client';

import {useEffect,useMemo,useState} from 'react';
import {BarChart3,CalendarDays,ChevronDown,Download,Search,Users} from 'lucide-react';
import {jakartaDate} from '@/lib/domain';
import {audienceLabels,readScopesForRole,type Audience,type Role} from '@/lib/access';

type ClassRow={id:string;name:string;audience:string;level_id?:string|null};
type LevelRow={id:string;name:string};
type Status='H'|'I'|'A'|null;
type Person={id:string;name:string;class_name:string;level_name?:string;H:number;I:number;A:number;pending:number;percentage:number|null;dates:{H:string[];I:string[];A:string[]}};
type Meeting={id:string;title:string;date:string;audience:string;class_name:string;total:number;summary:{H:number;I:number;A:number;pending:number};participants:Array<{id:string;name:string;class_name:string;level_name:string;status:Status;notes:string}>};
type Recap={month:string;summary:{H:number;I:number;A:number;pending:number;meetings:number};individuals:Person[];meetings:Meeting[]};
const statusLabel=(s:Status)=>s==='H'?'Hadir':s==='I'?'Izin':s==='A'?'Alfa':'Belum diisi';
const statusClass=(s:Status)=>s==='H'?'hadir':s==='I'?'izin':s==='A'?'alfa':'pending';
const dayLabel=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
type Detail='overall'|'meetings'|'individual';

export default function AttendanceRecap({embedded=false,focusEventId=''}:{embedded?:boolean;focusEventId?:string}){
 const [month,setMonth]=useState(jakartaDate().slice(0,7));
 const [audience,setAudience]=useState('');
 const [levelId,setLevelId]=useState('');
 const [classId,setClassId]=useState('');
 const [classes,setClasses]=useState<ClassRow[]>([]);
 const [levels,setLevels]=useState<LevelRow[]>([]);
 const [readable,setReadable]=useState<Audience[]>([]);
 const [data,setData]=useState<Recap|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [detail,setDetail]=useState<Detail>('overall');
 const [meetingId,setMeetingId]=useState(focusEventId);
 const [expandedPerson,setExpandedPerson]=useState('');
 const [search,setSearch]=useState('');
 const [statusFilter,setStatusFilter]=useState('all');

 useEffect(()=>{if(focusEventId){setMeetingId(focusEventId);setDetail('meetings');}},[focusEventId]);
 useEffect(()=>{let live=true;
  Promise.all([fetch('/api/classes'),fetch('/api/levels'),fetch('/api/auth/me')]).then(async results=>{
    if(results.some(r=>!r.ok))throw Error('Gagal memuat filter.');
    const [c,l,u]=await Promise.all(results.map(r=>r.json()));
    if(!live)return;
    setClasses(Array.isArray(c)?c:[]);setLevels(Array.isArray(l)?l:[]);
    setReadable(Array.isArray(u.read_scopes)?u.read_scopes:readScopesForRole((u.role||'VIEWER') as Role));
  }).catch(()=>{if(live)setError('Filter kelas belum dapat dimuat.');});
  return()=>{live=false};
 },[]);
 useEffect(()=>{let live=true;setLoading(true);setError('');
   const params=new URLSearchParams({month});if(audience)params.set('audience',audience);if(levelId)params.set('level_id',levelId);if(classId)params.set('class_id',classId);
   fetch('/api/attendance/recap?'+params.toString()).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||'Rekap gagal dimuat.');return j;})
    .then(j=>{if(live)setData(j);}).catch(e=>{if(live){setError(e.message);setData(null);}}).finally(()=>{if(live)setLoading(false);});
   return()=>{live=false};
 },[month,audience,levelId,classId]);
 const availableClasses=classes.filter(c=>(!audience||c.audience===audience)&&(!levelId||c.level_id===levelId));
 const meetings=data?.meetings||[];
 const meeting=meetings.find(m=>m.id===meetingId)||null;
 const people=useMemo(()=>(data?.individuals||[]).filter(p=>p.name.toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID'))||p.class_name.toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID'))),[data,search]);
 const visibleParticipants=(meeting?.participants||[]).filter(p=>(statusFilter==='all'||(p.status||'pending')===statusFilter)&&p.name.toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID')));
 const totalMarked=(data?.summary.H||0)+(data?.summary.I||0)+(data?.summary.A||0);
 const overallRate=totalMarked?Math.round((data?.summary.H||0)/totalMarked*1000)/10:null;
 const statuses=[{id:'H',label:'Hadir',value:data?.summary.H||0},{id:'I',label:'Izin',value:data?.summary.I||0},{id:'A',label:'Alfa',value:data?.summary.A||0},{id:'pending',label:'Belum diisi',value:data?.summary.pending||0}];
 async function exportExcel(){
  const XLSX=await import('xlsx');
  const rows=detail==='meetings'&&meeting?meeting.participants.map(p=>({Tanggal:meeting.date,Pertemuan:meeting.title,Nama:p.name,Kelas:p.class_name,Status:statusLabel(p.status),Keterangan:p.notes})):detail==='individual'?(data?.individuals||[]).map(p=>({Nama:p.name,Kelas:p.class_name,Hadir:p.H,Izin:p.I,Alfa:p.A,'Belum diisi':p.pending,'Persentase (%)':p.percentage??''})):meetings.map(m=>({Tanggal:m.date,Pertemuan:m.title,Lingkup:audienceLabels[m.audience as Audience]||m.audience,Kelas:m.class_name,Peserta:m.total,Hadir:m.summary.H,Izin:m.summary.I,Alfa:m.summary.A,'Belum diisi':m.summary.pending}));
  const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{Keterangan:'Tidak ada data untuk filter ini'}]);
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Rekap Presensi');XLSX.writeFile(wb,'rekap-presensi-'+month+'.xlsx');
 }
 return <div className="attendanceRecap">
   {!embedded&&<div className="pageHeader"><h1>Rekap Presensi</h1></div>}
   <div className="attendancePanelHead attendanceRecapHead"><div><h2>Analisis Presensi</h2><p>Mulai dari gambaran keseluruhan, lalu telusuri pertemuan dan setiap peserta.</p></div><button type="button" className="btn ghost" onClick={()=>void exportExcel()} disabled={!data||loading}><Download size={16}/> Ekspor Excel</button></div>
   <section className="attendanceFilters attendanceRecapFilters">
    <label>Periode<input className="input" aria-label="Bulan rekap" type="month" value={month} onChange={e=>{setMonth(e.target.value);setMeetingId('');}}/></label>
    <label>Lingkup<select className="select" value={audience} onChange={e=>{setAudience(e.target.value);setLevelId('');setClassId('');setMeetingId('');}}><option value="">Keseluruhan</option>{readable.map(a=><option key={a} value={a}>{audienceLabels[a]}</option>)}</select></label>
    <label>Jenjang<select className="select" value={levelId} onChange={e=>{setLevelId(e.target.value);setClassId('');setMeetingId('');}}><option value="">Semua jenjang</option>{levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
    <label>Kelas<select className="select" value={classId} onChange={e=>{setClassId(e.target.value);setMeetingId('');}}><option value="">Semua kelas</option>{availableClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   </section>
   {error&&<div className="notice error" role="alert">{error}</div>}
   {loading?<div className="card"><div className="skeleton" style={{height:160}}/></div>:<>
   <div className="attendanceKpiGrid">
     <div className="attendanceKpi"><span>Total pertemuan</span><strong>{data?.summary.meetings||0}</strong><small>Dalam filter yang dipilih</small></div>
     <div className="attendanceKpi"><span>Persentase hadir</span><strong>{overallRate===null?'—':overallRate+'%'}</strong><small>Dari status yang sudah dicatat</small></div>
     <div className="attendanceKpi"><span>Jumlah hadir</span><strong>{data?.summary.H||0}</strong><small>Akumulasi seluruh pertemuan</small></div>
     <div className="attendanceKpi"><span>Belum diisi</span><strong>{data?.summary.pending||0}</strong><small>Tidak otomatis dianggap alfa</small></div>
   </div>
   <nav className="attendanceDetailTabs" aria-label="Tingkat detail rekap">
    <button type="button" className={detail==='overall'?'active':''} onClick={()=>setDetail('overall')}><BarChart3 size={16}/> Keseluruhan</button>
    <button type="button" className={detail==='meetings'?'active':''} onClick={()=>setDetail('meetings')}><CalendarDays size={16}/> Per pertemuan</button>
    <button type="button" className={detail==='individual'?'active':''} onClick={()=>setDetail('individual')}><Users size={16}/> Per peserta</button>
   </nav>
   {detail==='overall'&&<div className="attendanceOverviewGrid">
     <section className="attendancePanel"><div className="attendancePanelHead"><div><h2>Komposisi Presensi</h2><p>Perbandingan status pada seluruh pertemuan terpilih.</p></div></div>
       <div className="attendanceStackedTrack" aria-label="Komposisi status absensi">{statuses.map(s=><div key={s.id} className={'attendanceStack '+s.id} style={{width:(s.value/Math.max(totalMarked+(data?.summary.pending||0),1)*100)+'%'}} title={s.label+': '+s.value}/>)}</div>
       <div className="attendanceStatusBars">{statuses.map(s=><div className="attendanceStatusBar" key={s.id}><span><i className={'attendanceStatusDot '+s.id}/>{s.label}</span><div className="attendanceBarTrack"><div className={'attendanceBarFill '+s.id} style={{width:(s.value/Math.max(totalMarked+(data?.summary.pending||0),1)*100)+'%'}}/></div><strong>{s.value}</strong></div>)}</div>
     </section>
     <section className="attendancePanel"><div className="attendancePanelHead"><div><h2>Ringkasan periode</h2><p>Indikator untuk membaca kelengkapan pencatatan.</p></div></div><div className="attendanceOverviewNumbers"><div><span>Peserta tercatat</span><strong>{data?.individuals.length||0}</strong></div><div><span>Catatan terisi</span><strong>{totalMarked}</strong></div><div><span>Total catatan</span><strong>{totalMarked+(data?.summary.pending||0)}</strong></div></div><button className="btn secondary attendanceFullButton" type="button" onClick={()=>setDetail('meetings')}>Lihat pertemuan <ChevronDown size={15}/></button></section>
   </div>}
   {detail==='meetings'&&<div className="attendanceMeetingExplorer">
     <section className="attendancePanel attendanceMeetingPicker"><div className="attendancePanelHead"><div><h2>Daftar Pertemuan</h2><p>{meetings.length} kegiatan pada bulan ini</p></div></div>
       <div className="attendanceMeetingPickList">{meetings.map(m=><button type="button" key={m.id} className={'attendanceMeetingPick'+(m.id===meetingId?' selected':'')} onClick={()=>{setMeetingId(m.id);setSearch('');setStatusFilter('all');}}><strong>{m.title}</strong><span>{dayLabel(m.date)} · {m.class_name||audienceLabels[m.audience as Audience]||m.audience}</span><small>{m.total} peserta · {m.summary.H} hadir</small></button>)}</div>
       {!meetings.length&&<div className="attendanceEmpty"><CalendarDays/><strong>Belum ada pertemuan</strong><span>Coba periode atau filter lainnya.</span></div>}
     </section>
     <section className="attendancePanel attendanceMeetingDetails">
       {meeting?<><div className="attendancePanelHead"><div><span className="attendanceEyebrow">{dayLabel(meeting.date)}</span><h2>{meeting.title}</h2><p>{meeting.class_name||audienceLabels[meeting.audience as Audience]||meeting.audience} · {meeting.total} peserta</p></div></div>
       <div className="attendanceSmallMetrics"><span>{meeting.summary.H} Hadir</span><span>{meeting.summary.I} Izin</span><span>{meeting.summary.A} Alfa</span><span>{meeting.summary.pending} Belum</span></div>
       <div className="attendanceDetailFilters"><label className="attendanceSearch"><Search size={16}/><input className="input" type="search" placeholder="Cari nama peserta" value={search} onChange={e=>setSearch(e.target.value)}/></label><select className="select" aria-label="Filter status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Semua status</option><option value="H">Hadir</option><option value="I">Izin</option><option value="A">Alfa</option><option value="pending">Belum diisi</option></select></div>
       <div className="tableWrap"><table className="table"><thead><tr><th>Nama peserta</th><th>Kelas</th><th>Status</th><th>Keterangan</th></tr></thead><tbody>{visibleParticipants.map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.class_name||'—'}</td><td><span className={'attendanceStatusChip '+statusClass(p.status)}>{statusLabel(p.status)}</span></td><td>{p.notes||'—'}</td></tr>)}{!visibleParticipants.length&&<tr><td colSpan={4}>Tidak ada peserta sesuai filter.</td></tr>}</tbody></table></div>
       </>:<div className="attendanceEmpty"><Users size={27}/><strong>Pilih sebuah pertemuan</strong><span>Rincian hadir, izin, alfa, dan nama peserta akan tampil di sini.</span></div>}
     </section>
   </div>}
   {detail==='individual'&&<section className="attendancePanel"><div className="attendancePanelHead"><div><h2>Rekap per Peserta</h2><p>Pilih nama untuk melihat tanggal hadir, izin, dan alfa.</p></div></div><label className="attendanceSearch attendancePeopleSearch"><Search size={16}/><input type="search" className="input" placeholder="Cari nama atau kelas" value={search} onChange={e=>setSearch(e.target.value)}/></label>
      <div className="tableWrap"><table className="table"><thead><tr><th>Nama / detail tanggal</th><th>Kelas</th><th>H</th><th>I</th><th>A</th><th>Belum</th><th>Kehadiran</th></tr></thead><tbody>{people.map(p=><tr key={p.id}><td><button className="nameButton" type="button" onClick={()=>setExpandedPerson(expandedPerson===p.id?'':p.id)} aria-expanded={expandedPerson===p.id}>{p.name} <ChevronDown size={14}/></button>{expandedPerson===p.id&&<div className="attendancePersonDates">{(['H','I','A'] as const).map(s=><p key={s}><b>{statusLabel(s)}:</b> {p.dates[s].length?p.dates[s].map(dayLabel).join(', '):'Belum ada'}</p>)}</div>}</td><td>{p.class_name||'—'}</td><td>{p.H}</td><td>{p.I}</td><td>{p.A}</td><td>{p.pending}</td><td>{p.percentage===null?'Belum diisi':p.percentage+'%'}</td></tr>)}{!people.length&&<tr><td colSpan={7}>Belum ada peserta dalam filter ini.</td></tr>}</tbody></table></div>
   </section>}
   </>}
 </div>;
}
