'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowRight,CalendarDays,ClipboardCheck,Database,FileText} from 'lucide-react';

type Overview={members:number;categories:Array<{name:string;count:number}>;attendance:{meetings:number;present:number;excused:number;absent:number};journals:number};
type Dashboard=Overview&{levels:Array<{id:string;name:string;count:number;present:number;total:number}>;monthly?:Array<{month:string;meetings:number;journals:number;present:number}>};

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
        const signed=auth.ok;setLoggedIn(signed);
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
    <div className="pageHeader heroHeader"><div><div className="eyebrow">Administrasi Airo · Bulan ini</div><h1>{loggedIn?'Ringkasan kegiatan':'Pusat informasi kegiatan'}</h1><p>Anggota, pertemuan, kehadiran, dan jurnal dalam satu tempat.</p></div>
      {!loggedIn&&<Link className="btn" href="/login">Masuk pengelola <ArrowRight size={17}/></Link>}
    </div>
    {error&&<div className="notice error">{error}</div>}
    {!loggedIn&&<div className="toolbar card viewerFilters"><label>Bulan<input className="input" type="month" value={viewerMonth} onChange={e=>setViewerMonth(e.target.value)}/></label><label>Periode<select className="select" value={viewerSpan} onChange={e=>setViewerSpan(Number(e.target.value) as 1|6)}><option value={1}>Satu bulan</option><option value={6}>Enam bulan</option></select></label></div>}
    <div className="metricGrid">
      <div className="metricCard"><Database size={20}/><span>Anggota aktif</span><strong>{data?.members??'—'}</strong></div>
      <div className="metricCard"><CalendarDays size={20}/><span>Pertemuan bulan ini</span><strong>{attendance?.meetings??'—'}</strong></div>
      <div className="metricCard"><ClipboardCheck size={20}/><span>Kehadiran</span><strong>{total?`${Math.round((attendance?.present??0)/total*100)}%`:'—'}</strong></div>
      <div className="metricCard"><FileText size={20}/><span>Jurnal bulan ini</span><strong>{data?.journals??'—'}</strong></div>
    </div>
    <div className="dashboardGrid section">
      <section className="card"><div className="cardHead"><div><h2>Anggota per bagian</h2><p>Jumlah anggota aktif dapat berada di lebih dari satu bagian.</p></div></div>
        <div className="categoryRows">{data?.categories?.map(x=><div className="categoryRow" key={x.name}><span>{x.name}</span><strong>{x.count}</strong></div>)}</div>
        {!data&&<div className="skeleton" style={{height:160}}/>}
      </section>
      <section className="card"><div className="cardHead"><div><h2>Presensi bulan ini</h2><p>Hasil dari pertemuan yang sudah dicatat.</p></div></div>
        <div className="attendanceSummary"><div><span>H</span><strong>{attendance?.present??0}</strong><small>Hadir</small></div><div><span>I</span><strong>{attendance?.excused??0}</strong><small>Izin</small></div><div><span>A</span><strong>{attendance?.absent??0}</strong><small>Alfa</small></div></div>
        {loggedIn&&<Link className="textLink" href="/presensi?view=rekap">Lihat rekap lengkap <ArrowRight size={15}/></Link>}
      </section>
    </div>
    {loggedIn&&<section className="card section"><div className="cardHead"><div><h2>Per jenjang</h2><p>Anggota aktif dan tingkat kehadiran bulan ini.</p></div><select className="select compactSelect" value={level} onChange={e=>setLevel(e.target.value)}><option value="">Semua jenjang</option>{data?.levels?.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      <div className="levelGrid">{(current?[current]:data?.levels??[]).map(x=><div className="levelCard" key={x.id}><strong>{x.name}</strong><span>{x.count} anggota</span><b>{x.total?Math.round(x.present/x.total*100)+'%':'—'} hadir</b></div>)}</div>
    </section>}
    {!loggedIn&&viewerSpan===6&&<section className="card section"><div className="cardHead"><div><h2>Enam bulan terakhir</h2><p>Jumlah pertemuan, hadir, dan jurnal per bulan.</p></div></div><div className="tableWrap"><table className="table"><thead><tr><th>Bulan</th><th>Pertemuan</th><th>Hadir</th><th>Jurnal</th></tr></thead><tbody>{data?.monthly?.map(x=><tr key={x.month}><td>{x.month}</td><td>{x.meetings}</td><td>{x.present}</td><td>{x.journals}</td></tr>)}</tbody></table></div></section>}
    {!loggedIn&&<section className="card section viewerNote"><div><h2>Melihat tanpa akun</h2><p>Ringkasan publik hanya menampilkan jumlah, tanpa identitas atau kontak anggota. Kunjungan dan perangkat dicatat. Anda dapat menambahkan nama kunjungan.</p></div><div className="viewerIdentify"><input className="input" value={visitorName} onChange={e=>setVisitorName(e.target.value)} maxLength={80} placeholder="Nama Anda (opsional)" aria-label="Nama pengunjung"/><button className="btn secondary" onClick={()=>void identify()} disabled={!visitorName.trim()}>Catat nama</button></div>{visitMessage&&<div className="notice">{visitMessage}</div>}</section>}
  </div>;
}
