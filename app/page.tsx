'use client';

import Link from 'next/link';
import Image from 'next/image';
import {useEffect,useState} from 'react';
import {ArrowRight,CalendarDays,ClipboardCheck,Database,Eye,FileText,LogIn,ShieldCheck} from 'lucide-react';

type Overview={members:number;categories:Array<{name:string;count:number}>;attendance:{meetings:number;present:number;excused:number;absent:number};journals:number};
type Dashboard=Overview&{role?:string;levels:Array<{id:string;name:string;count:number;present:number;total:number}>;todayEvents?:Array<{id:string;title:string;audience?:string}>;unfinishedAttendance?:Array<{id:string;title:string}>;draftJournals?:Array<{id:string;title:string}>;overdueDecisions?:Array<{id:string;title:string;journal_id:string;deadline:string}>;completeness?:{members:number;attendance:number;journals:number;followups:number;imports:number};monthly?:Array<{month:string;meetings:number;journals:number;present:number}>};

export default function Home(){
  const[data,setData]=useState<Dashboard|null>(null);
  const[loggedIn,setLoggedIn]=useState(false);const[role,setRole]=useState('VIEWER');
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
        const user=auth.ok?await auth.json():null;const signed=Boolean(user&&!user.public&&user.role!=='VIEWER');setLoggedIn(signed);setRole(user?.role||'VIEWER');
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
    <div className="homeIntro">
      <div><span className="eyebrow">SIMPUL</span><h1>Beranda</h1><p>Agenda, presensi, jurnal, dan tindak lanjut dalam satu ruang.</p></div>
      <div className="homeIntroLogo" aria-hidden="true"><Image src="/simpul-logo.webp" alt="" width={82} height={82} priority/></div>
    </div>
    {error&&<div className="notice error">{error}</div>}
    {!loggedIn&&<section className="viewerHero"><div className="viewerHeroIcon"><Eye size={22}/></div><div><span>MODE VIEWER</span><h2>Ringkasan publik Simpul</h2><p>Data ditampilkan dalam mode baca saja. Perubahan administrasi hanya tersedia setelah masuk.</p></div><Link className="btn secondary viewerHeroLogin" href="/login"><LogIn size={16}/>Masuk Admin</Link></section>}
    {!loggedIn&&<div className="toolbar card viewerFilters"><label>Bulan<input className="input" type="month" value={viewerMonth} onChange={e=>setViewerMonth(e.target.value)}/></label><label>Periode<select className="select" value={viewerSpan} onChange={e=>setViewerSpan(Number(e.target.value) as 1|6)}><option value={1}>1 bulan</option><option value={6}>6 bulan</option></select></label></div>}
    {loggedIn&&<div className="taskLinks"><Link className="btn" href="/agenda?create=1">+ Agenda</Link><Link className="btn secondary" href="/presensi/buat">Presensi</Link><Link className="btn secondary" href="/jurnal/buat">Jurnal</Link><Link className="btn ghost" href="/catatan?create=1">Catatan</Link></div>}

    {loggedIn&&<div className="dashboardGrid section">
      <section className="card"><div className="cardHead"><h2>Hari Ini</h2><Link className="textLink" href="/agenda">Agenda <ArrowRight size={14}/></Link></div>
        {data?.todayEvents?.length?data.todayEvents.map(e=><Link key={e.id} className="categoryRow" href={'/presensi/buat?event_id='+e.id}><span>{e.title}</span><ArrowRight size={15}/></Link>):<div className="emptyState">Belum ada kegiatan.</div>}
      </section>
      <section className="card"><h2>Perlu Tindakan</h2>
        {data?.unfinishedAttendance?.map(e=><Link key={e.id} className="categoryRow" href={'/presensi/buat?event_id='+e.id}><span>Presensi · {e.title}</span><ArrowRight size={15}/></Link>)}
        {data?.draftJournals?.map(j=><Link key={j.id} className="categoryRow" href={'/jurnal/buat?journal_id='+j.id}><span>Jurnal · {j.title}</span><ArrowRight size={15}/></Link>)}
        {data?.overdueDecisions?.map(d=><Link key={d.id} className="categoryRow" href={'/jurnal/buat?journal_id='+d.journal_id}><span>Tindak lanjut · {d.title}</span><ArrowRight size={15}/></Link>)}
        {(data?.completeness&&Object.values(data.completeness).some(Boolean))&&<Link className="categoryRow" href="/kelengkapan"><span>Kelengkapan · {Object.values(data.completeness).reduce((a,b)=>a+b,0)} item</span><ArrowRight size={15}/></Link>}
        {!data?.unfinishedAttendance?.length&&!data?.draftJournals?.length&&!data?.overdueDecisions?.length&&!data?.completeness&&<div className="emptyState">Semua beres.</div>}
      </section>
    </div>}

    <div className="metricGrid section">
      <Link href="/database" className="metricCard"><Database size={18}/><span>Database</span><strong>{data?.members??'—'}</strong></Link>
      <Link href="/agenda" className="metricCard"><CalendarDays size={18}/><span>Kegiatan</span><strong>{attendance?.meetings??'—'}</strong></Link>
      <Link href="/presensi?view=rekap" className="metricCard"><ClipboardCheck size={18}/><span>Kehadiran</span><strong>{total?Math.round((attendance?.present??0)/total*100)+'%':'—'}</strong></Link>
      <Link href="/jurnal" className="metricCard"><FileText size={18}/><span>Jurnal</span><strong>{data?.journals??'—'}</strong></Link>
    </div>

    {loggedIn&&['ADMIN','DEWAN_GURU'].includes(role)&&<section className="section"><div className="cardHead"><h2>Jenjang</h2><select className="select compactSelect" value={level} onChange={e=>setLevel(e.target.value)}><option value="">Semua</option>{data?.levels?.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      <div className="levelGrid">{(current?[current]:data?.levels??[]).map(x=><div className="levelCard" key={x.id}><strong>{x.name}</strong><span>{x.count} anggota</span><b>{x.total?Math.round(x.present/x.total*100)+'%':'—'} hadir</b></div>)}</div>
    </section>}

    {!loggedIn&&viewerSpan===6&&<section className="card section"><div className="cardHead"><h2>6 Bulan</h2></div><div className="tableWrap"><table className="table"><thead><tr><th>Bulan</th><th>Kegiatan</th><th>Hadir</th><th>Jurnal</th></tr></thead><tbody>{data?.monthly?.map(x=><tr key={x.month}><td>{x.month}</td><td>{x.meetings}</td><td>{x.present}</td><td>{x.journals}</td></tr>)}</tbody></table></div></section>}
    {!loggedIn&&<section className="card section viewerNote"><div className="cardHead"><div><h2>Kunjungan Viewer</h2><p>Nama hanya opsional untuk pencatatan kunjungan.</p></div><ShieldCheck size={20}/></div><div className="viewerIdentify"><input className="input" value={visitorName} onChange={e=>setVisitorName(e.target.value)} maxLength={80} placeholder="Nama pengunjung (opsional)" aria-label="Nama pengunjung"/><button className="btn secondary" onClick={()=>void identify()} disabled={!visitorName.trim()}>Catat kunjungan</button></div>{visitMessage&&<div className="notice">{visitMessage}</div>}</section>}
  </div>;
}
