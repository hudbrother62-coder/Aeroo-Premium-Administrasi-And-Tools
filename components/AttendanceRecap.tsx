'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {BarChart3,CalendarDays,ChevronDown,Download,Search,Users} from 'lucide-react';
import AttendanceTrendChart from '@/components/AttendanceTrendChart';
import {monthsEnding,mergeRecapMonths,attendanceShares,type CombinedRecap} from '@/lib/attendance-trends';
import '@/app/presensi/recap-analytics.css';
import {jakartaDate} from '@/lib/domain';
import {audienceLabels,readScopesForRole,type Audience,type Role} from '@/lib/access';

type ClassRow={id:string;name:string;audience:string;level_id?:string|null};
type LevelRow={id:string;name:string;active?:boolean};
type Status='H'|'I'|'A'|null;
type Participant={id:string;name:string;class_name:string;level_name:string;status:Status;notes:string};
type Meeting={id:string;title:string;date:string;audience:string;class_name:string;total:number;summary:{H:number;I:number;A:number;pending:number}};
type Recap=CombinedRecap;
const statusLabel=(s:Status)=>s==='H'?'Hadir':s==='I'?'Izin':s==='A'?'Alfa':'Belum diisi';
const statusClass=(s:Status)=>s==='H'?'hadir':s==='I'?'izin':s==='A'?'alfa':'pending';
const dayLabel=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
type Detail='overall'|'meetings'|'individual';

export default function AttendanceRecap({embedded=false,focusEventId='',individualOnly=false}:{embedded?:boolean;focusEventId?:string;individualOnly?:boolean}){
 const [month,setMonth]=useState(jakartaDate().slice(0,7));
 const [span,setSpan]=useState<1|3|6>(1);
 const [audience,setAudience]=useState('');
 const [levelId,setLevelId]=useState('');
 const [levels,setLevels]=useState<LevelRow[]>([]);
 const [classId,setClassId]=useState('');
 const [classes,setClasses]=useState<ClassRow[]>([]);
 const [readable,setReadable]=useState<Audience[]>([]);
 const [data,setData]=useState<Recap|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [detail,setDetail]=useState<Detail>(individualOnly?'individual':'overall');
 const [meetingId,setMeetingId]=useState(focusEventId);
 const [search,setSearch]=useState('');
 const [statusFilter,setStatusFilter]=useState('all');
 const [participants,setParticipants]=useState<Participant[]>([]);
 const [participantsLoading,setParticipantsLoading]=useState(false);
 const [participantsError,setParticipantsError]=useState('');

 useEffect(()=>{if(focusEventId){setMeetingId(focusEventId);setDetail('meetings');const selectedMonth=new URLSearchParams(window.location.search).get('month');if(selectedMonth&&/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth))setMonth(selectedMonth);}},[focusEventId]);
 useEffect(()=>{let live=true;
  Promise.all([fetch('/api/classes'),fetch('/api/auth/me'),fetch('/api/levels')]).then(async results=>{
    if(results.some(r=>!r.ok))throw Error('Gagal memuat filter.');
    const [c,u,l]=await Promise.all(results.map(r=>r.json()));
    if(!live)return;
    setClasses(Array.isArray(c)?c:[]);setLevels(Array.isArray(l)?l:[]);
    const access=(Array.isArray(u.read_scopes)?u.read_scopes:readScopesForRole((u.role||'VIEWER') as Role)) as Audience[];setReadable(access);if(access.length===1)setAudience(access[0]);
  }).catch(()=>{if(live)setError('Filter kelas belum dapat dimuat.');});
  return()=>{live=false};
 },[]);

 useEffect(()=>{
   const controller=new AbortController();let live=true;
   setLoading(true);setError('');setData(null);setParticipants([]);
   const activeMonths=monthsEnding(month,span);
   Promise.all(activeMonths.map(async m=>{
     const params=new URLSearchParams({month:m});
     if(audience)params.set('audience',audience);
     if(audience==='CABERAWIT'&&classId)params.set('class_id',classId);
     if(audience==='MUDA_MUDI'&&levelId)params.set('level_id',levelId);
     const response=await fetch('/api/attendance/recap?'+params.toString(),{signal:controller.signal,cache:'no-store'});
     const json=await response.json();
     if(!response.ok)throw Error(json.error||'Rekap gagal dimuat.');
     return json;
   })).then(rows=>{if(live)setData(mergeRecapMonths(rows))})
     .catch(e=>{if(live){setError(e instanceof Error?e.message:'Rekap gagal dimuat.');setData(null)}})
     .finally(()=>{if(live)setLoading(false)});
   return()=>{live=false;controller.abort()};
 },[month,span,audience,classId,levelId]);
 useEffect(()=>{
   if(detail!=='meetings'||!meetingId||!data?.meetings.some(m=>m.id===meetingId)){setParticipants([]);setParticipantsError('');setParticipantsLoading(false);return;}
   let live=true;const controller=new AbortController();
   setParticipants([]);setParticipantsError('');setParticipantsLoading(true);
   const eventMonth=data?.meetings.find(m=>m.id===meetingId)?.date.slice(0,7)||month;
   const params=new URLSearchParams({month:eventMonth,event_id:meetingId});
   if(audience)params.set('audience',audience);if(audience==='CABERAWIT'&&classId)params.set('class_id',classId);if(audience==='MUDA_MUDI'&&levelId)params.set('level_id',levelId);
   fetch('/api/attendance/recap?'+params.toString(),{signal:controller.signal})
     .then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||'Rincian peserta gagal dimuat.');return j;})
     .then(j=>{if(live)setParticipants(Array.isArray(j.participants)?j.participants:[]);})
     .catch(e=>{if(live)setParticipantsError(e.message);})
     .finally(()=>{if(live)setParticipantsLoading(false);});
   return()=>{live=false;controller.abort()};
 },[detail,meetingId,month,audience,classId,levelId,data]);
 const availableClasses=classes.filter(c=>c.audience==='CABERAWIT');
 const availableLevels=levels.filter(l=>l.active!==false&&(/remaj/i.test(l.name)||/generasi produktif|genpro/i.test(l.name)));
 const meetings=data?.meetings||[];
 const meeting=meetings.find(m=>m.id===meetingId)||null;
 const people=useMemo(()=>(data?.individuals||[]).filter(p=>p.name.toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID'))||p.class_name.toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID'))),[data,search]);
 const visibleParticipants=participants.filter(p=>(statusFilter==='all'||(p.status||'pending')===statusFilter)&&p.name.toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID')));
 const totalMarked=(data?.summary.H||0)+(data?.summary.I||0)+(data?.summary.A||0);
 const overallRate=totalMarked?Math.round((data?.summary.H||0)/totalMarked*1000)/10:null;
 const shares=attendanceShares(data?.summary.H||0,data?.summary.I||0,data?.summary.A||0);
 const statuses=[{id:'H',label:'Hadir',value:data?.summary.H||0,percentage:shares?.[0]},{id:'I',label:'Izin',value:data?.summary.I||0,percentage:shares?.[1]},{id:'A',label:'Alfa',value:data?.summary.A||0,percentage:shares?.[2]},{id:'pending',label:'Belum diisi',value:data?.summary.pending||0,percentage:null}];
 async function exportExcel(){
  const XLSX=await import('xlsx');
  const rows=detail==='meetings'&&meeting?participants.map(p=>({Tanggal:meeting.date,Pertemuan:meeting.title,Nama:p.name,Kelas:p.class_name,Status:statusLabel(p.status),Keterangan:p.notes})):detail==='individual'?(data?.individuals||[]).map(p=>({Nama:p.name,Kelas:p.class_name,Hadir:p.H,Izin:p.I,Alfa:p.A,'Belum diisi':p.pending,'Persentase (%)':p.percentage??''})):meetings.map(m=>({Tanggal:m.date,Pertemuan:m.title,Lingkup:audienceLabels[m.audience as Audience]||m.audience,Kelas:m.class_name,Peserta:m.total,Hadir:m.summary.H,Izin:m.summary.I,Alfa:m.summary.A,'Belum diisi':m.summary.pending}));
  const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{Keterangan:'Tidak ada data untuk filter ini'}]);
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Rekap Presensi');XLSX.writeFile(wb,'rekap-presensi-'+month+'-'+span+'bulan.xlsx');
 }
 return <div className="attendanceRecap">
   {!embedded&&<div className="pageHeader"><h1>Rekap Presensi</h1></div>}
   <div className="attendancePanelHead attendanceRecapHead"><div><h2>Analisis Presensi</h2></div><button type="button" className="btn ghost" onClick={()=>void exportExcel()} disabled={!data||loading||(detail==='meetings'&&!!meeting&& (participantsLoading||!!participantsError))}><Download size={16}/> Ekspor Excel</button></div>
   <section className="attendanceFilters attendanceRecapFilters attendancePeriodFilters">
    <label>Periode<input className="input" aria-label="Bulan rekap" type="month" value={month} onChange={e=>{setMonth(e.target.value);setMeetingId('');}}/></label>
    <label>Rentang<select className="select" aria-label="Rentang rekap" value={span} onChange={e=>{setSpan(Number(e.target.value) as 1|3|6);setMeetingId('');}}>
      <option value={1}>1 bulan</option><option value={3}>3 bulan</option><option value={6}>6 bulan</option>
    </select></label>
    <label>Lingkup<select className="select" value={audience} onChange={e=>{setAudience(e.target.value);setClassId('');setLevelId('');setMeetingId('');}}>
      <option value="">Keseluruhan</option>{readable.map(a=><option key={a} value={a}>{audienceLabels[a]}</option>)}
    </select></label>
    {audience==='CABERAWIT'&&<label>Kelas<select className="select" value={classId} onChange={e=>{setClassId(e.target.value);setMeetingId('');}}>
      <option value="">Semua kelas</option>{availableClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
    </select></label>}
    {audience==='MUDA_MUDI'&&<label>Jenjang<select className="select" value={levelId} onChange={e=>{setLevelId(e.target.value);setMeetingId('');}}>
      <option value="">Semua jenjang</option>{availableLevels.map(l=><option key={l.id} value={l.id}>{/generasi produktif/i.test(l.name)?'Genpro':l.name}</option>)}
    </select></label>}
   </section>
   {error&&<div className="notice error" role="alert">{error} Silakan coba filter yang lebih spesifik atau muat ulang.</div>}
   {loading?<div className="card"><div className="skeleton" style={{height:160}}/></div>:!data?<div className="attendanceEmpty card" role="status"><strong>Rekap belum bisa ditampilkan</strong><span>Data tidak diubah. Coba muat ulang atau pilih periode lain.</span></div>:<>
   {!individualOnly&&<div className="attendanceKpiGrid">
     <div className="attendanceKpi"><span>Total pertemuan</span><strong>{data?.summary.meetings||0}</strong><small>Dalam filter yang dipilih</small></div>
     <div className="attendanceKpi"><span>Persentase hadir</span><strong>{overallRate===null?'—':overallRate+'%'}</strong><small>Dari status yang sudah dicatat</small></div>
     <div className="attendanceKpi"><span>Jumlah hadir</span><strong>{data?.summary.H||0}</strong><small>Akumulasi seluruh pertemuan</small></div>
     <div className="attendanceKpi"><span>Belum diisi</span><strong>{data?.summary.pending||0}</strong><small>Tidak otomatis dianggap alfa</small></div>
   </div>}
   {!individualOnly&&<nav className="attendanceDetailTabs" aria-label="Tingkat detail rekap">
    <button type="button" className={detail==='overall'?'active':''} onClick={()=>setDetail('overall')}><BarChart3 size={16}/> Keseluruhan</button>
    <button type="button" className={detail==='meetings'?'active':''} onClick={()=>setDetail('meetings')}><CalendarDays size={16}/> Per pertemuan</button>
    <button type="button" className={detail==='individual'?'active':''} onClick={()=>setDetail('individual')}><Users size={16}/> Per peserta</button>
   </nav>}
   {detail==='overall'&&!individualOnly&&<div className="attendanceOverviewGrid">
     <section className="attendancePanel"><div className="attendancePanelHead"><div><h2>Komposisi Presensi</h2><p>Perbandingan status pada seluruh pertemuan terpilih.</p></div></div>
       <div className="attendanceStackedTrack" aria-label="Komposisi status absensi">{statuses.map(s=><div key={s.id} className={'attendanceStack '+s.id} style={{width:s.id==='pending'?'0%':String(s.percentage??0)+'%'}} title={s.label+': '+s.value}/>)}</div>
       <div className="attendanceStatusBars">{statuses.map(s=><div className="attendanceStatusBar" key={s.id}><span><i className={'attendanceStatusDot '+s.id}/>{s.label}</span><div className="attendanceBarTrack"><div className={'attendanceBarFill '+s.id} style={{width:s.id==='pending'?String(s.value/Math.max(totalMarked+s.value,1)*100)+'%':String(s.percentage??0)+'%'}}/></div><strong>{s.value} {s.percentage!=null?<small className="attendanceStatusPercent">({s.percentage.toFixed(1)}%)</small>:null}</strong></div>)}</div>
     </section>
     <section className="attendancePanel"><div className="attendancePanelHead"><div><h2>Ringkasan periode</h2><p>Indikator untuk membaca kelengkapan pencatatan.</p></div></div><div className="attendanceOverviewNumbers"><div><span>Peserta tercatat</span><strong>{data?.individuals.length||0}</strong></div><div><span>Catatan terisi</span><strong>{totalMarked}</strong></div><div><span>Total catatan</span><strong>{totalMarked+(data?.summary.pending||0)}</strong></div></div><button className="btn secondary attendanceFullButton" type="button" onClick={()=>setDetail('meetings')}>Lihat pertemuan <ChevronDown size={15}/></button></section>
   </div>}
   {span>1&&detail==='overall'&&!individualOnly&&<AttendanceTrendChart points={data.trend} title="Tren kehadiran per bulan"/>}
   {detail==='meetings'&&!individualOnly&&<div className="attendanceMeetingExplorer">
     <section className="attendancePanel attendanceMeetingPicker"><div className="attendancePanelHead"><div><h2>Daftar Pertemuan</h2><p>{meetings.length} kegiatan dalam {span} bulan</p></div></div>
       <div className="attendanceMeetingPickList">{meetings.map(m=><button type="button" key={m.id} className={'attendanceMeetingPick'+(m.id===meetingId?' selected':'')} onClick={()=>{setMeetingId(m.id);setParticipants([]);setParticipantsLoading(true);setSearch('');setStatusFilter('all');}}><strong>{m.title}</strong><span>{dayLabel(m.date)} · {m.class_name||audienceLabels[m.audience as Audience]||m.audience}</span><small>{m.total} peserta · {m.summary.H} hadir</small></button>)}</div>
       {!meetings.length&&<div className="attendanceEmpty"><CalendarDays/><strong>Belum ada pertemuan</strong><span>Coba periode atau filter lainnya.</span></div>}
     </section>
     <section className="attendancePanel attendanceMeetingDetails">
       {meeting?<><div className="attendancePanelHead"><div><span className="attendanceEyebrow">{dayLabel(meeting.date)}</span><h2>{meeting.title}</h2><p>{meeting.class_name||audienceLabels[meeting.audience as Audience]||meeting.audience} · {meeting.total} peserta</p></div></div>
       <div className="attendanceSmallMetrics"><span>{meeting.summary.H} Hadir</span><span>{meeting.summary.I} Izin</span><span>{meeting.summary.A} Alfa</span><span>{meeting.summary.pending} Belum</span></div>
       <div className="attendanceDetailFilters"><label className="attendanceSearch"><Search size={16}/><input className="input" type="search" placeholder="Cari nama peserta" value={search} onChange={e=>setSearch(e.target.value)}/></label><select className="select" aria-label="Filter status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Semua status</option><option value="H">Hadir</option><option value="I">Izin</option><option value="A">Alfa</option><option value="pending">Belum diisi</option></select></div>
       {participantsLoading&&<div className="card"><div className="skeleton" style={{height:90}}/></div>}
       {participantsError&&<div className="notice error" role="alert">{participantsError}</div>}
       {!participantsLoading&&!participantsError&&<div className="tableWrap"><table className="table"><thead><tr><th>Nama peserta</th><th>Kelas</th><th>Status</th><th>Keterangan</th></tr></thead><tbody>{visibleParticipants.map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.class_name||'—'}</td><td><span className={'attendanceStatusChip '+statusClass(p.status)}>{statusLabel(p.status)}</span></td><td>{p.notes||'—'}</td></tr>)}{!visibleParticipants.length&&<tr><td colSpan={4}>Tidak ada peserta sesuai filter.</td></tr>}</tbody></table></div>}
       </>:<div className="attendanceEmpty"><Users size={27}/><strong>Pilih sebuah pertemuan</strong><span>Rincian hadir, izin, alfa, dan nama peserta akan tampil di sini.</span></div>}
     </section>
   </div>}
   {(detail==='individual'||individualOnly)&&<section className="attendancePanel">
    <div className="attendancePanelHead"><div><h2>Daftar Rekap Individu</h2>
      <p>Setiap orang tampil satu kali. Pilih Lihat Detail untuk seluruh kewajiban pertemuan, status, catatan, dan grafik bulanan.</p>
    </div></div>
    <label className="attendanceSearch attendancePeopleSearch"><Search size={16}/>
      <input type="search" className="input" placeholder="Cari nama atau kelas" value={search} onChange={e=>setSearch(e.target.value)}/>
    </label>
    <div className="tableWrap"><table className="table attendanceIndividualsTable">
      <thead><tr><th>Nama peserta</th><th>Kelas</th><th>Hadir</th><th>Izin</th><th>Alfa</th><th>Belum</th><th>Kehadiran</th><th>Detail</th></tr></thead>
      <tbody>{people.map(p=>{
        const params=new URLSearchParams({month,span:String(span)});
        if(audience)params.set('audience',audience);
        if(audience==='CABERAWIT'&&classId)params.set('class_id',classId);
        if(audience==='MUDA_MUDI'&&levelId)params.set('level_id',levelId);
        return <tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.class_name||'—'}</td>
          <td>{p.H}</td><td>{p.I}</td><td>{p.A}</td><td>{p.pending}</td>
          <td>{p.percentage===null?'Belum diisi':p.percentage+'%'}</td>
          <td><Link className="btn ghost attendancePersonDetailLink"
            href={'/presensi/individu/'+encodeURIComponent(p.id)+'?'+params.toString()}>
            Lihat Detail <ChevronDown size={15}/></Link></td>
        </tr>;
      })}
      {!people.length&&<tr><td colSpan={8}>Belum ada peserta dalam filter ini.</td></tr>}
      </tbody>
    </table></div>
   </section>}
   </>}
 </div>;
}
