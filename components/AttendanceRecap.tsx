'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {BarChart3,CalendarDays,ChevronDown,Download,RefreshCw,Search,Users} from 'lucide-react';
import AttendanceTrendChart from '@/components/AttendanceTrendChart';
import {monthsEnding,mergeRecapMonths,attendanceShares,type CombinedRecap} from '@/lib/attendance-trends';
import '@/app/presensi/recap-analytics.css';
import {jakartaDate} from '@/lib/domain';
import {audienceLabels,readScopesForRole,type Audience,type Role} from '@/lib/access';

type ClassRow={id:string;name:string;audience:string;level_id?:string|null};
type Status='H'|'I'|'A'|null;
type Participant={id:string;name:string;class_name:string;level_name:string;status:Status;notes:string};
type Meeting={id:string;title:string;date:string;audience:string;class_name:string;total:number;summary:{H:number;I:number;A:number;pending:number}};
type Recap=CombinedRecap;
const statusLabel=(s:Status)=>s==='H'?'Hadir':s==='I'?'Izin':s==='A'?'Alfa':'Belum diisi';
const statusClass=(s:Status)=>s==='H'?'hadir':s==='I'?'izin':s==='A'?'alfa':'pending';
const dayLabel=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
const presenceRate=(h:number,i:number,a:number):number|null=>{const wajib=h+i+a;return wajib?Number((100*h/wajib).toFixed(2)):null;};
const formattedRate=(rate:number|null)=>rate===null?'—':rate.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
type Detail='overall'|'meetings'|'individual';

export default function AttendanceRecap({embedded=false,focusEventId='',individualOnly=false}:{embedded?:boolean;focusEventId?:string;individualOnly?:boolean}){
 const [month,setMonth]=useState(jakartaDate().slice(0,7));
 const [span,setSpan]=useState<1|3|6>(1);
 const [audience,setAudience]=useState('');
 const [classId,setClassId]=useState('');
 const [classes,setClasses]=useState<ClassRow[]>([]);
 const [readable,setReadable]=useState<Audience[]>([]);
 const [data,setData]=useState<Recap|null>(null);
 const [error,setError]=useState('');
 const [filterError,setFilterError]=useState('');
 const [reload,setReload]=useState(0);
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
  Promise.all([fetch('/api/classes'),fetch('/api/auth/me')]).then(async results=>{
    if(results.some(r=>!r.ok))throw Error('Gagal memuat filter.');
    const [c,u]=await Promise.all(results.map(r=>r.json()));
    if(!live)return;
    setClasses(Array.isArray(c)?c:[]);
    const access=(Array.isArray(u.read_scopes)?u.read_scopes:readScopesForRole((u.role||'VIEWER') as Role)) as Audience[];setReadable(access);if(access.length===1)setAudience(access[0]);
  }).catch(()=>{if(live)setFilterError('Pilihan kelas belum dapat dimuat. Rekap tetap dapat dibuka.');});
  return()=>{live=false};
 },[]);

 useEffect(()=>{
   const controller=new AbortController();let live=true;
   setLoading(true);setError('');setData(null);setParticipants([]);
   const activeMonths=monthsEnding(month,span);
   Promise.allSettled(activeMonths.map(async m=>{
     const params=new URLSearchParams({month:m});
     if(audience)params.set('audience',audience);
     if(audience==='CABERAWIT'&&classId)params.set('class_id',classId);
     // Only attendance records within the selected month are read.
     const response=await fetch('/api/attendance/recap?'+params.toString(),{signal:controller.signal,cache:'no-store'});
     const json=await response.json();
     if(!response.ok)throw Error(json.error||'Rekap bulan '+m+' gagal dimuat.');
     if(!json||json.month!==m||!json.summary||!Array.isArray(json.meetings)||!Array.isArray(json.individuals))
       throw Error('Format rekap '+m+' tidak valid.');
     return json as Recap;
   })).then(results=>{
     if(!live)return;
     const successful=results.filter((r):r is PromiseFulfilledResult<Recap>=>r.status==='fulfilled').map(r=>r.value);
     if(successful.length){
       setData(mergeRecapMonths(successful));
       if(successful.length!==activeMonths.length){
         const failed=results.flatMap((r,i)=>r.status==='rejected'?[activeMonths[i]]:[]);
         setError('Rekap sementara: data '+failed.join(', ')+' belum berhasil dimuat. Tekan Muat ulang untuk melengkapi periode.');
       }
     }else{
       const failure=results.find((r):r is PromiseRejectedResult=>r.status==='rejected');
       setError(failure?.reason instanceof Error?failure.reason.message:'Rekap tidak dapat dimuat. Coba lagi.');
       setData(null);
     }
   })
     .catch(e=>{if(live){setError(e instanceof Error?e.message:'Rekap gagal dimuat.');setData(null)}})
     .finally(()=>{if(live)setLoading(false)});
   return()=>{live=false;controller.abort()};
 },[month,span,audience,classId,reload]);
 useEffect(()=>{
   if(detail!=='meetings'||!meetingId||!data?.meetings.some(m=>m.id===meetingId)){setParticipants([]);setParticipantsError('');setParticipantsLoading(false);return;}
   let live=true;const controller=new AbortController();
   setParticipants([]);setParticipantsError('');setParticipantsLoading(true);
   const eventMonth=data?.meetings.find(m=>m.id===meetingId)?.date.slice(0,7)||month;
   const params=new URLSearchParams({month:eventMonth,event_id:meetingId});
   if(audience)params.set('audience',audience);if(audience==='CABERAWIT'&&classId)params.set('class_id',classId);
   fetch('/api/attendance/recap?'+params.toString(),{signal:controller.signal})
     .then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||'Rincian peserta gagal dimuat.');return j;})
     .then(j=>{if(live)setParticipants(Array.isArray(j.participants)?j.participants:[]);})
     .catch(e=>{if(live)setParticipantsError(e.message);})
     .finally(()=>{if(live)setParticipantsLoading(false);});
   return()=>{live=false;controller.abort()};
 },[detail,meetingId,month,audience,classId,data]);
 const availableClasses=classes.filter(c=>c.audience==='CABERAWIT');
 const meetings=data?.meetings||[];
 const meeting=meetings.find(m=>m.id===meetingId)||null;
 const people=useMemo(()=>(data?.individuals||[]).filter(p=>p.name.toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID'))||p.class_name.toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID'))),[data,search]);
 const visibleParticipants=participants.filter(p=>(statusFilter==='all'||(p.status||'pending')===statusFilter)&&p.name.toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID')));
 const totalMarked=(data?.summary.H||0)+(data?.summary.I||0)+(data?.summary.A||0);
 const overallRate=presenceRate(data?.summary.H||0,data?.summary.I||0,data?.summary.A||0);
 const shares=attendanceShares(data?.summary.H||0,data?.summary.I||0,data?.summary.A||0);
 const statuses=[{id:'H',label:'Hadir',value:data?.summary.H||0,percentage:shares?.[0]},{id:'I',label:'Izin',value:data?.summary.I||0,percentage:shares?.[1]},{id:'A',label:'Alfa',value:data?.summary.A||0,percentage:shares?.[2]},{id:'pending',label:'Belum diisi',value:data?.summary.pending||0,percentage:null}];
 async function exportExcel(){
   const XLSX=await import('xlsx');
   const scoped=detail==='meetings'&&meeting?meeting.summary:data?.summary;
   const h=scoped?.H||0,i=scoped?.I||0,a=scoped?.A||0,pending=scoped?.pending||0;
   const rows=detail==='meetings'&&meeting
     ?participants.map(p=>({Tanggal:meeting.date,Pertemuan:meeting.title,Nama:p.name,Kelas:p.class_name,Status:statusLabel(p.status),Keterangan:p.notes}))
     :detail==='individual'
     ?(data?.individuals||[]).map(p=>({Nama:p.name,Kelas:p.class_name,Hadir:p.H,Izin:p.I,Alfa:p.A,'Belum diisi':p.pending,'Wajib hadir':p.H+p.I+p.A,'Kehadiran (%)':presenceRate(p.H,p.I,p.A)??'—'}))
     :meetings.map(m=>({Tanggal:m.date,Pertemuan:m.title,Lingkup:audienceLabels[m.audience as Audience]||m.audience,Kelas:m.class_name,Peserta:m.total,Hadir:m.summary.H,Izin:m.summary.I,Alfa:m.summary.A,'Belum diisi':m.summary.pending,'Wajib hadir':m.summary.H+m.summary.I+m.summary.A,'Kehadiran (%)':presenceRate(m.summary.H,m.summary.I,m.summary.A)??'—'}));
   const wb=XLSX.utils.book_new();
   const summary=XLSX.utils.aoa_to_sheet([
     ['SIMPUL — RINGKASAN PRESENSI'],
     ['Periode',month],['Rentang',span+' bulan'],
     ['Kategori',audience?audienceLabels[audience as Audience]||audience:'Keseluruhan'],
     ['Hadir',h],['Izin',i],['Alfa',a],['Belum diisi',pending],
     ['Wajib hadir (H+I+A)',h+i+a],
     ['Persentase kehadiran (%)',presenceRate(h,i,a)??'—'],
     ['Catatan','Belum diisi tidak dihitung sebagai Alfa dan tidak masuk total wajib hadir hingga statusnya dicatat.']
   ]);
   summary['!cols']=[{wch:34},{wch:76}];
   XLSX.utils.book_append_sheet(wb,summary,'Ringkasan');
   const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{Keterangan:'Tidak ada data untuk filter ini'}]);
   XLSX.utils.book_append_sheet(wb,ws,'Rekap Presensi');
   XLSX.writeFile(wb,'rekap-presensi-'+month+'-'+span+'bulan.xlsx');
 }
 return <div className="attendanceRecap">
   {!embedded&&<div className="pageHeader"><h1>Rekap Presensi</h1></div>}
   <div className="attendancePanelHead attendanceRecapHead"><div><h2>Analisis Presensi</h2></div><div className="row"><button type="button" className="btn ghost" onClick={()=>setReload(v=>v+1)} disabled={loading}><RefreshCw size={16}/> Muat ulang</button><button type="button" className="btn ghost" onClick={()=>void exportExcel()} disabled={!data||loading||(detail==='meetings'&&!!meeting&& (participantsLoading||!!participantsError))}><Download size={16}/> Ekspor Excel</button></div></div>
   <section className="attendanceFilters attendanceRecapFilters attendancePeriodFilters">
    <label>Periode<input className="input" aria-label="Bulan rekap" type="month" value={month} onChange={e=>{setMonth(e.target.value);setMeetingId('');}}/></label>
    <label>Rentang<select className="select" aria-label="Rentang rekap" value={span} onChange={e=>{setSpan(Number(e.target.value) as 1|3|6);setMeetingId('');}}>
      <option value={1}>1 bulan</option><option value={3}>3 bulan</option><option value={6}>6 bulan</option>
    </select></label>
    <label>Kategori<select className="select" value={audience} onChange={e=>{setAudience(e.target.value);setClassId('');setMeetingId('');}}>
      <option value="">Keseluruhan</option>{readable.map(a=><option key={a} value={a}>{audienceLabels[a]}</option>)}
    </select></label>
    {audience==='CABERAWIT'&&<label>Kelas<select className="select" value={classId} onChange={e=>{setClassId(e.target.value);setMeetingId('');}}>
      <option value="">Semua kelas</option>{availableClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
    </select></label>}
   </section>
   {filterError&&<div className="notice" role="status">{filterError}</div>}
   {error&&<div className="notice error" role="alert">{error} <button className="smallAction" type="button" disabled={loading} onClick={()=>setReload(v=>v+1)}>Coba lagi</button></div>}
   {loading?<div className="card"><div className="skeleton" style={{height:160}}/></div>:!data?<div className="attendanceEmpty card" role="status"><strong>Rekap belum berhasil dimuat</strong><span>Data presensi aman. Periksa koneksi atau coba bulan lain.</span><button type="button" className="btn secondary" onClick={()=>setReload(v=>v+1)}>Muat ulang rekap</button></div>:<>
   {!individualOnly&&<div className="attendanceKpiGrid">
     <div className="attendanceKpi"><span>Total pertemuan</span><strong>{data?.summary.meetings||0}</strong><small>Dalam filter yang dipilih</small></div>
     <div className="attendanceKpi"><span>Wajib hadir (H+I+A)</span><strong>{totalMarked}</strong><small>Hadir + Izin + Alfa</small></div>
     <div className="attendanceKpi"><span>Persentase hadir</span><strong>{formattedRate(overallRate)}</strong><small>Hadir ÷ wajib hadir × 100%</small></div>
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
       <div className="attendanceMeetingPickList">{meetings.map(m=><button type="button" key={m.id} className={'attendanceMeetingPick'+(m.id===meetingId?' selected':'')} onClick={()=>{setMeetingId(m.id);setParticipants([]);setParticipantsLoading(true);setSearch('');setStatusFilter('all');}}><strong>{m.title}</strong><span>{dayLabel(m.date)} · {m.class_name||audienceLabels[m.audience as Audience]||m.audience}</span><small>{m.total} peserta · {m.summary.H+m.summary.I+m.summary.A} wajib hadir · {formattedRate(presenceRate(m.summary.H,m.summary.I,m.summary.A))}</small></button>)}</div>
       {!meetings.length&&<div className="attendanceEmpty"><CalendarDays/><strong>Belum ada pertemuan</strong><span>Coba periode atau filter lainnya.</span></div>}
     </section>
     <section className="attendancePanel attendanceMeetingDetails">
       {meeting?<><div className="attendancePanelHead"><div><span className="attendanceEyebrow">{dayLabel(meeting.date)}</span><h2>{meeting.title}</h2><p>{meeting.class_name||audienceLabels[meeting.audience as Audience]||meeting.audience} · {meeting.total} peserta</p></div></div>
       <div className="attendanceSmallMetrics"><span>{meeting.summary.H} Hadir</span><span>{meeting.summary.I} Izin</span><span>{meeting.summary.A} Alfa</span><span>{meeting.summary.H+meeting.summary.I+meeting.summary.A} Wajib hadir</span><span>{formattedRate(presenceRate(meeting.summary.H,meeting.summary.I,meeting.summary.A))} kehadiran</span><span>{meeting.summary.pending} Belum</span></div>
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
