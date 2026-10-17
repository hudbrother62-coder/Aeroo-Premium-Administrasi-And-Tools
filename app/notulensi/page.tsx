'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,CalendarDays,ClipboardList,FilePenLine,History,Plus,Search} from 'lucide-react';
import {jakartaDate} from '@/lib/domain';
import {isNotulensi} from '@/lib/journal-kind';
import {readScopesForRole,writeScopesForRole,type Audience} from '@/lib/access';
import '../jurnal/journal.css';
import './notulensi.css';

type Journal={id:string;title:string;journal_date:string;journal_kind:string;state?:string|null;
  started_at?:string|null;ended_at?:string|null;summary?:string|null;decisions?:string|null;notes?:string|null;
  assessment?:{meeting_minutes?:boolean;proposal?:string|null}|null;activity_types?:{name?:string|null}|null};
const audience=(kind:string):Audience=>(kind==='PENGKAJIAN'?'KELOMPOK':kind.startsWith('CABERAWIT')?'CABERAWIT':kind.startsWith('MUDA_MUDI')?'MUDA_MUDI':kind) as Audience;
const dateLabel=(day:string)=>new Date(day+'T12:00:00').toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
export default function NotulensiPage(){
  const [month,setMonth]=useState(jakartaDate().slice(0,7));
  const [query,setQuery]=useState('');
  const [rows,setRows]=useState<Journal[]>([]);
  const [role,setRole]=useState('VIEWER');
  const [read,setRead]=useState<Audience[]|null>(null);
  const [write,setWrite]=useState<Audience[]|null>(null);
  const [ready,setReady]=useState(false),[loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    let mounted=true;
    fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.json()).then(u=>{
      if(!mounted)return;
      setRole(u?.role||'VIEWER');
      setRead(Array.isArray(u?.read_scopes)?u.read_scopes:null);
      setWrite(Array.isArray(u?.write_scopes)?u.write_scopes:null);
    }).catch(()=>{}).finally(()=>{if(mounted)setReady(true)});
    return()=>{mounted=false};
  },[]);
  useEffect(()=>{
    const ctrl=new AbortController();setLoading(true);setError('');
    fetch('/api/journals?'+new URLSearchParams({month}),{cache:'no-store',signal:ctrl.signal})
      .then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||'Gagal memuat notulensi');return j})
      .then(j=>{if(!ctrl.signal.aborted)setRows(Array.isArray(j)?j:[])})
      .catch(e=>{if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:'Gagal memuat notulensi')})
      .finally(()=>{if(!ctrl.signal.aborted)setLoading(false)});
    return()=>ctrl.abort();
  },[month]);
  const allowedRead=read??readScopesForRole(role);
  const allowedWrite=write??writeScopesForRole(role);
  const canWrite=allowedWrite.includes('PENGURUS');
  const items=useMemo(()=>rows.filter(j=>isNotulensi(j)&&allowedRead.includes(audience(j.journal_kind))&&j.title.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>b.journal_date.localeCompare(a.journal_date)),[rows,allowedRead,query]);
  const done=items.filter(j=>j.state==='COMPLETED').length;
  return <main className="journalWorkspace minutesWorkspace">
    <header className="pageHeader minutesHeader">
      <div><span className="journalEyebrow"><ClipboardList size={16}/> MUSYAWARAH & RAPAT</span><h1>Notulensi</h1><p>Usulan, keputusan, dan catatan tersimpan terpisah dari jurnal kegiatan.</p></div>
      {ready&&canWrite&&<Link href="/jurnal/tulis?mode=notulensi" className="btn minutesAdd"><Plus size={17}/> Buat Notulensi</Link>}
    </header>
    <nav className="journalSubnav" aria-label="Navigasi jurnal"><Link href="/jurnal">Jurnal Kegiatan</Link><Link href="/jurnal/riwayat">Riwayat Jurnal</Link><Link className="journalNavActive" href="/notulensi">Notulensi</Link></nav>
    <div className="card minutesFilter">
      <label><span><CalendarDays size={16}/> Bulan</span><input className="input" type="month" value={month} onChange={e=>setMonth(e.target.value)} aria-label="Bulan notulensi"/></label>
      <label><span><Search size={16}/> Cari judul</span><input className="input" placeholder="Cari musyawarah…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    </div>
    <div className="minutesStats">
      <div className="card"><span>Notulensi</span><strong>{loading?'…':items.length}</strong></div>
      <div className="card"><span>Selesai</span><strong>{loading?'…':done}</strong></div>
      <div className="card"><span>Draf</span><strong>{loading?'…':items.length-done}</strong></div>
    </div>
    {error&&<div className="notice error" role="alert">{error}</div>}
    <section className="minutesList" aria-label="Daftar notulensi">
      {loading?<div className="card minutesEmpty">Memuat notulensi…</div>:items.length?items.map(j=><article className="card minutesItem" key={j.id}>
        <div className="minutesMain">
          <small className="minutesDate"><CalendarDays size={15}/>{dateLabel(j.journal_date)}{j.started_at||j.ended_at?' · '+[j.started_at?.slice(0,5),j.ended_at?.slice(0,5)].filter(Boolean).join(' – '):''}</small>
          <h2>{j.title}</h2><span className="minutesBadge">{j.state==='COMPLETED'?'Selesai':'Draf'}</span>
          <div className="minutesPreview">
            <div><strong>Usulan</strong><p>{j.assessment?.proposal||j.summary||'—'}</p></div>
            <div><strong>Keputusan</strong><p>{j.decisions||'—'}</p></div>
            <div><strong>Catatan</strong><p>{j.notes||'—'}</p></div>
          </div>
        </div>
        <div className="minutesActions"><Link className="btn ghost" href={'/jurnal/hasil/'+j.id}>Lihat <ArrowRight size={15}/></Link>{allowedWrite.includes(audience(j.journal_kind))&&<Link className="btn ghost" href={'/jurnal/buat?journal_id='+j.id}><FilePenLine size={15}/> Edit</Link>}</div>
      </article>):<div className="card minutesEmpty"><History size={25}/><strong>Belum ada notulensi</strong><p>Belum ada catatan untuk bulan atau pencarian ini.</p>{canWrite&&<Link className="btn" href="/jurnal/tulis?mode=notulensi">Buat Notulensi <ArrowRight size={15}/></Link>}</div>}
    </section>
  </main>;
}
