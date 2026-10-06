'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowRight,CalendarDays,ClipboardCheck,Database,FileText} from 'lucide-react';

type Overview={members:number;categories:Array<{name:string;count:number}>;attendance:{meetings:number;present:number;excused:number;absent:number};journals:number};
type Dashboard=Overview&{levels:Array<{id:string;name:string;count:number;present:number;total:number}>;todayEvents?:Array<{id:string;title:string}>;unfinishedAttendance?:Array<{id:string;title:string}>;draftJournals?:Array<{id:string;title:string}>;monthly?:Array<{month:string;meetings:number;journals:number;present:number}>};

export default function Home(){
  const[data,setData]=useState<Dashboard|null>(null);
  const[loggedIn,setLoggedIn]=useState(false);
  const[error,setError]=useState('');
  const[level,setLevel]=useState('');
  const[visitorName,setVisitorName]=useState('');
  const[visitMessage,setVisitMessage]=useState('');
  const[viewerMonth,setViewerMonth]=useState(()=>new Date().toISOString().slice(0,7));
  const[viewerSpan,setViewerSpan]=useState<1|6>(1);

  useEffect(()=>{
    async function load(){
      try{
        const auth=await fetch('/api/auth/me',{cache:'no-store'});
        const user=auth.ok?await auth.json():null;const signed=Boolean(user&&!user.public&&user.role!=='VIEWER');setLoggedIn(signed);
        const r=await fetch(signed?'/api/dashboard':`/api/public/recap?month=${viewerMonth}&span=${viewerSpan}`,{cache:'no-store'});
        if(!r.ok)throw new Error();
        setData(await r.json());
        if(!signed&&!sessionStorage.getItem('aeroo-viewer-visited')){
          await fetch('/api/public/visit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({})});
          sessionStorage.setItem('aeroo-viewer-visited','1');
        }
      }catch{setError('Ringkasan belum dapat dimuat. Coba segarkan halaman.');}
    }
    void load();
  },[viewerMonth,viewerSpan]);

  async function identify(){
    const r=await fetch('/api/public/visit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:visitorName.trim()})});
    setVisitMessage(r.ok?'Nama kunjungan tercatat.':'Gagal mencatat kunjungan.');
  }
  const current=data?.levels?.find(x=>x.id===level);
  const attendance=data?.attendance;
  const total=(attendance?.present??0)+(attendance?.excused??0)+(attendance?.absent??0);

  return <div className="homePage">
    <div className="pageHeader"><h1>Beranda</h1></div>
    {error&&<div className="notice error">{error}</div>}
    {!loggedIn&&<div className="toolbar card viewerFilters"><label>Bulan<input className="input" type="month" value={viewerMonth} onChange={e=>setViewerMonth(e.target.value)}/></label><label>Periode<select className="select" value={viewerSpan} onChange={e=>setViewerSpan(Number(e.target.value) as 1|6)}><option value={1}>1 bulan</option><option value={6}>6 bulan</option></select></label></div>}
    {loggedIn&&<div className="taskLinks"><Link className="btn" href="/agenda">+ Agenda</Link><Link className="btn secondary" href="/presensi/buat">Presensi</Link><Link className="btn secondary" href="/jurnal/buat?kind=PENGKAJIAN">Pengkajian</Link><Link className="btn ghost" href="/catatan">Catatan</Link></div>}

    {loggedIn&&<div className="dashboardGrid section">
      <section className="card"><div className="cardHead"><h2>Hari Ini</h2><Link className="textLink" href="/agenda">Agenda <ArrowRight size={14}/></Link></div>
        {data?.todayEvents?.length?data.todayEvents.map(e=><Link key={e.id} className="categoryRow" href={'/presensi/buat?event_id='+e.id}><span>{e.title}</span><ArrowRight size={15}/></Link>):<div className="emptyState">Belum ada kegiatan.</div>}
      </section>
      <section className="card"><h2>Perlu Tindakan</h2>
        {data?.unfinishedAttendance?.map(e=><Link key={e.id} className="categoryRow" href={'/presensi/buat?event_id='+e.id}><span>Presensi · {e.title}</span><ArrowRight size={15}/></Link>)}
        {data?.draftJournals?.map(j=><Link key={j.id} className="categoryRow" href={'/jurnal/buat?journal_id='+j.id}><span>Jurnal · {j.title}</span><ArrowRight size={15}/></Link>)}
        {!data?.unfinishedAttendance?.length&&!data?.draftJournals?.length&&<div className="emptyState">Semua beres.</div>}
      </section>
    </div>}

    <div className="metricGrid section">
      <Link href="/database" className="metricCard"><Database size={18}/><span>Anggota</span><strong>{data?.members??'—'}</strong></Link>
      <Link href="/agenda" className="metricCard"><CalendarDays size={18}/><span>Kegiatan</span><strong>{attendance?.meetings??'—'}</strong></Link>
      <Link href="/presensi?view=rekap" className="metricCard"><ClipboardCheck size={18}/><span>Kehadiran</span><strong>{total?Math.round((attendance?.present??0)/total*100)+'%':'—'}</strong></Link>
      <Link href="/jurnal" className="metricCard"><FileText size={18}/><span>Jurnal</span><strong>{data?.journals??'—'}</strong></Link>
    </div>

    {loggedIn&&<section className="section"><div className="cardHead"><h2>Jenjang</h2><select className="select compactSelect" value={level} onChange={e=>setLevel(e.target.value)}><option value="">Semua</option>{data?.levels?.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      <div className="levelGrid">{(current?[current]:data?.levels??[]).map(x=><div className="levelCard" key={x.id}><strong>{x.name}</strong><span>{x.count} anggota</span><b>{x.total?Math.round(x.present/x.total*100)+'%':'—'} hadir</b></div>)}</div>
    </section>}

    {!loggedIn&&viewerSpan===6&&<section className="card section"><div className="cardHead"><h2>6 Bulan</h2></div><div className="tableWrap"><table className="table"><thead><tr><th>Bulan</th><th>Kegiatan</th><th>Hadir</th><th>Jurnal</th></tr></thead><tbody>{data?.monthly?.map(x=><tr key={x.month}><td>{x.month}</td><td>{x.meetings}</td><td>{x.present}</td><td>{x.journals}</td></tr>)}</tbody></table></div></section>}
    {!loggedIn&&<section className="card section viewerNote"><div className="cardHead"><h2>Viewer</h2></div><div className="viewerIdentify"><input className="input" value={visitorName} onChange={e=>setVisitorName(e.target.value)} maxLength={80} placeholder="Nama (opsional)" aria-label="Nama pengunjung"/><button className="btn secondary" onClick={()=>void identify()} disabled={!visitorName.trim()}>Simpan</button></div>{visitMessage&&<div className="notice">{visitMessage}</div>}</section>}
  </div>;
}
