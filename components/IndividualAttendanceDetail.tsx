'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,CalendarDays,Download,FilePenLine,Search} from 'lucide-react';
import AttendanceTrendChart from '@/components/AttendanceTrendChart';
import {attendanceShares,type RecapPerson} from '@/lib/attendance-trends';
import '@/app/presensi/recap-analytics.css';

type Status='H'|'I'|'A'|null;
type DetailRow={id:string;event_id:string;date:string;title:string;audience:string;class_name:string;status:Status;notes:string;obligation:boolean};
type Payload={person:RecapPerson;meetings:DetailRow[]};
const label=(s:Status)=>s==='H'?'Hadir':s==='I'?'Izin':s==='A'?'Alfa':'Belum diisi';
const day=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'long',year:'numeric'});
export default function IndividualAttendanceDetail({personId}:{personId:string}){
 const [params,setParams]=useState({month:'',span:3 as 1|3|6,audience:'',class_id:'',level_id:''});
 const [loaded,setLoaded]=useState(false);
 const [data,setData]=useState<Payload|null>(null);
 const [busy,setBusy]=useState(true);
 const [error,setError]=useState('');
 const [filter,setFilter]=useState<'ALL'|'H'|'I'|'A'|'pending'>('ALL');
 const [search,setSearch]=useState('');
 useEffect(()=>{
  const q=new URLSearchParams(window.location.search);
  const today=new Date(Date.now()+7*3600000).toISOString().slice(0,7);
  const m=q.get('month')||today,span=Number(q.get('span')||3);
  setParams({month:/^\d{4}-(0[1-9]|1[0-2])$/.test(m)?m:today,
    span:([1,3,6].includes(span)?span:3) as 1|3|6,
    audience:q.get('audience')||'',class_id:q.get('class_id')||'',level_id:q.get('level_id')||''});
  setLoaded(true);
 },[]);
 useEffect(()=>{
  if(!loaded)return;
  const ac=new AbortController();
  setBusy(true);setError('');
  const q=new URLSearchParams({person_id:personId,month:params.month,span:String(params.span)});
  if(params.audience)q.set('audience',params.audience);
  if(params.class_id)q.set('class_id',params.class_id);
  if(params.level_id)q.set('level_id',params.level_id);
  fetch('/api/attendance/individual?'+q,{cache:'no-store',signal:ac.signal})
   .then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error||'Gagal memuat detail.');return v as Payload})
   .then(v=>{if(!ac.signal.aborted)setData(v)})
   .catch(e=>{if(!ac.signal.aborted){setError(e instanceof Error?e.message:'Data tidak tersedia.');setData(null)}})
   .finally(()=>{if(!ac.signal.aborted)setBusy(false)});
  return()=>ac.abort();
 },[loaded,params,personId]);
 const all=data?.meetings||[];
 const rows=useMemo(()=>all.filter(m=>(filter==='ALL'||(m.status||'pending')===filter)&&[m.title,m.date,m.notes].some(v=>v.toLowerCase().includes(search.toLowerCase()))),[all,filter,search]);
 const summary=data?.person;
 const shares=summary?attendanceShares(summary.H,summary.I,summary.A):null;
 const back='/presensi/individu?'+new URLSearchParams({
   month:params.month,span:String(params.span),...(params.audience?{audience:params.audience}:{}),
   ...(params.class_id?{class_id:params.class_id}:{}),...(params.level_id?{level_id:params.level_id}:{})
 }).toString();
 async function exportRows(){
  if(!data)return;
  const XLSX=await import('xlsx');
  const sheet=XLSX.utils.json_to_sheet(all.map(r=>({
    Tanggal:day(r.date),Pertemuan:r.title,Kewajiban:'Terdaftar pada pertemuan',
    Status:label(r.status),Keterangan:r.notes||'',Lingkup:r.audience,Kelas:r.class_name
  })));
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Detail Individu');
  XLSX.writeFile(book,'rekap-individu-'+params.month+'-'+params.span+'bulan.xlsx');
 }
 return <div className="attendanceIndividualReport">
   <div className="attendanceIndividualHeader"><Link href={back} className="btn ghost"><ArrowLeft size={17}/> Kembali ke daftar</Link>
    {summary&&<button className="btn ghost" onClick={()=>void exportRows()}><Download size={16}/> Ekspor Excel</button>}
   </div>
   {busy&&<div className="card attendancePersonLoader">Memuat detail kehadiran…</div>}
   {error&&<div className="notice error" role="alert">{error}</div>}
   {!busy&&summary&&<div className="attendanceIndividualContent">
    <div className="attendanceIndividualHero"><span className="attendanceEyebrow">REKAP KEHADIRAN INDIVIDU</span>
      <h1>{summary.name}</h1><p>{summary.class_name||params.audience||'Data peserta'} · {params.span} bulan hingga {params.month}</p>
    </div>
    <div className="attendanceIndividualControls">
      <label>Periode<input type="month" className="input" value={params.month} onChange={e=>setParams(x=>({...x,month:e.target.value}))}/></label>
      <label>Rentang<select className="select" value={params.span} onChange={e=>setParams(x=>({...x,span:Number(e.target.value) as 1|3|6}))}>
        <option value={1}>1 bulan</option><option value={3}>3 bulan</option><option value={6}>6 bulan</option>
      </select></label>
    </div>
    <div className="attendanceIndividualKpis">
      <div><span>Pertemuan tercatat</span><strong>{all.length}</strong></div>
      <div><span>Hadir</span><strong>{summary.H}</strong><small>{shares?.[0]??'—'}%</small></div>
      <div><span>Izin</span><strong>{summary.I}</strong><small>{shares?.[1]??'—'}%</small></div>
      <div><span>Alfa</span><strong>{summary.A}</strong><small>{shares?.[2]??'—'}%</small></div>
      <div><span>Belum diisi</span><strong>{summary.pending}</strong></div>
    </div>
    {params.span>1&&<AttendanceTrendChart points={summary.monthly} title="Performa kehadiran per bulan"/>}
    <section className="attendancePanel attendanceIndividualMeetings">
      <div className="attendancePanelHead"><div><h2>Riwayat setiap pertemuan</h2>
        <p>Hanya pertemuan ketika peserta terdaftar dalam daftar presensi. Belum diisi tidak dianggap Alfa.</p>
      </div></div>
      <div className="attendanceIndividualSearch">
        <label><Search size={16}/><input type="search" className="input" placeholder="Cari tanggal, pertemuan, atau keterangan" value={search} onChange={e=>setSearch(e.target.value)}/></label>
        <select className="select" aria-label="Filter status pertemuan" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}>
          <option value="ALL">Semua status</option><option value="H">Hadir</option><option value="I">Izin</option>
          <option value="A">Alfa</option><option value="pending">Belum diisi</option>
        </select>
      </div>
      <div className="attendanceIndividualHistory">
        {rows.map(row=><article key={row.id} className="attendanceIndividualMeeting">
          <div className="attendanceIndividualMeetingTop"><div>
            <span><CalendarDays size={14}/>{day(row.date)}</span><h3>{row.title}</h3>
          </div><span className={'attendanceStatusChip '+(row.status==='H'?'hadir':row.status==='I'?'izin':row.status==='A'?'alfa':'pending')}>{label(row.status)}</span></div>
          <div className="attendanceIndividualMeetingMeta">
            <span>Kewajiban hadir: <strong>Terdaftar</strong></span>
            {row.class_name&&<span>Kelas: <strong>{row.class_name}</strong></span>}
          </div>
          {row.notes.trim()&&<p className="attendanceIndividualNotes"><b>Keterangan:</b> {row.notes}</p>}
          <Link className="attendanceIndividualEdit" href={'/presensi/buat?event_id='+encodeURIComponent(row.event_id)}>
            <FilePenLine size={14}/> Buka presensi / isi keterangan
          </Link>
        </article>)}
        {!rows.length&&<p className="attendanceIndividualNoRows">Belum ada pertemuan sesuai filter ini.</p>}
      </div>
    </section>
   </div>}
  </div>;
}
