'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {BookOpenText,ArrowRight,ClipboardList,Target,CheckCheck,UsersRound,CalendarDays,History,Plus} from 'lucide-react';
import {jakartaDate} from '@/lib/domain';
import {isNotulensi} from '@/lib/journal-kind';
import {readScopesForRole,writeScopesForRole,type Audience} from '@/lib/access';

type Journal={id:string;class_id?:string;journal_date:string;journal_kind:string;title:string;state?:string;follow_up?:string;classes?:{id?:string;name?:string;level_id?:string};assessment?:{meeting_minutes?:boolean;class_assessment?:{level_id?:string};ai_target_analysis?:{matches?:Array<{target_id:string;relation?:string}>}};journal_progress?:Array<{member_id?:string;participant_key?:string;target_id?:string;progress_value?:number|null}>};
type ClassRow={id:string;name:string;level_id?:string;audience:string};
const kindLabels:Record<string,string>={PENGKAJIAN:'Pengkajian',KELOMPOK:'Kelompok',IBU_IBU:'Ibu-Ibu',PENGURUS:'Musyawarah',CABERAWIT_CLASS:'Caberawit Kelas',CABERAWIT_INDIVIDUAL:'Caberawit Individu',MUDA_MUDI_CLASS:'Muda-Mudi Kelas',MUDA_MUDI_INDIVIDUAL:'Muda-Mudi Individu'};
const audienceFor=(kind:string):Audience=>(kind==='PENGKAJIAN'?'KELOMPOK':kind.startsWith('CABERAWIT')?'CABERAWIT':kind.startsWith('MUDA_MUDI')?'MUDA_MUDI':kind) as Audience;
const monthLabel=(month:string)=>new Date(Number(month.slice(0,4)),Number(month.slice(5,7))-1,1).toLocaleDateString('id-ID',{month:'long',year:'numeric'});

export default function JournalDashboard(){
  const[month,setMonth]=useState(jakartaDate().slice(0,7));
  const[classId,setClassId]=useState('');
  const[kind,setKind]=useState('');
  const[role,setRole]=useState('VIEWER');
  const[readScopes,setReadScopes]=useState<Audience[]|null>(null);
  const[writeScopes,setWriteScopes]=useState<Audience[]|null>(null);
  const[classes,setClasses]=useState<ClassRow[]>([]);
  const[journals,setJournals]=useState<Journal[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  const[refresh,setRefresh]=useState(0);

  useEffect(()=>{
    let active=true;
    Promise.allSettled([fetch('/api/classes').then(r=>r.json()),fetch('/api/auth/me').then(r=>r.json())]).then(([c,u])=>{
      if(!active)return;
      if(c.status==='fulfilled'&&Array.isArray(c.value))setClasses(c.value);
      if(u.status==='fulfilled'&&u.value){
        setRole(u.value.role||'VIEWER');
        setReadScopes(Array.isArray(u.value.read_scopes)?u.value.read_scopes:null);
        setWriteScopes(Array.isArray(u.value.write_scopes)?u.value.write_scopes:null);
      }
    });
    return()=>{active=false};
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');
    fetch('/api/journals?month='+encodeURIComponent(month),{signal:controller.signal})
      .then(async r=>{const value=await r.json();if(!r.ok)throw Error(value.error||'Data jurnal tidak tersedia');return value})
      .then(value=>{if(!controller.signal.aborted)setJournals(Array.isArray(value)?value:[])})
      .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Gagal memuat jurnal')})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[month,refresh]);

  const readable=readScopes??readScopesForRole(role);
  const writable=writeScopes??writeScopesForRole(role);
  const availableKinds=Object.entries(kindLabels).filter(([k])=>readable.includes(audienceFor(k)));
  const filtered=useMemo(()=>journals.filter(j=>{
    if(isNotulensi(j))return false;
    if(!readable.includes(audienceFor(j.journal_kind)))return false;
    if(kind&&j.journal_kind!==kind)return false;
    if(classId&&(j.classes?.id||j.class_id)!==classId)return false;
    return true;
  }),[journals,kind,classId,readable]);
  const relevantClasses=classes.filter(c=>readable.includes(c.audience as Audience)&&(!kind||c.audience===audienceFor(kind)));
  const done=filtered.filter(j=>j.state==='COMPLETED').length;
  const drafts=filtered.filter(j=>j.state==='DRAFT'||!j.state).length;
  const observed=new Set(filtered.flatMap(j=>(j.journal_progress||[]).map(p=>p.participant_key||p.member_id).filter((v):v is string=>Boolean(v)))).size;
  const targetLinks=filtered.reduce((n,j)=>n+(j.assessment?.ai_target_analysis?.matches||[]).filter(m=>m.relation==='DIAJARKAN').length,0);
  const weeks=Array.from({length:Math.ceil(new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate()/7)},(_,i)=>{
    const count=filtered.filter(j=>Math.floor((Number(j.journal_date.slice(8,10))-1)/7)===i).length;
    return{label:`Pekan ${i+1}`,count};
  });
  const maxWeek=Math.max(1,...weeks.map(w=>w.count));
  const recent=[...filtered].sort((a,b)=>b.journal_date.localeCompare(a.journal_date)).slice(0,5);
  const canCreate=writable.length>0;
  return <div className="journalWorkspace">
    <header className="pageHeader journalMainHeader">
      <div><span className="journalEyebrow"><BookOpenText size={15}/> Pencatatan kegiatan & pembinaan</span><h1>Jurnal Kegiatan</h1></div>
      <div className="journalHeaderActions"><Link className="btn ghost" href="/jurnal/riwayat"><History size={16}/> Riwayat Jurnal</Link>{canCreate&&<Link className="btn" href="/jurnal/tulis"><Plus size={16}/> Tulis Jurnal</Link>}</div>
    </header>

    {role!=='VIEWER'&&<nav className="journalSubnav" aria-label="Navigasi jurnal">
      <Link className="journalNavActive" href="/jurnal">Dashboard</Link><Link href="/jurnal/tulis">Tulis Jurnal</Link><Link href="/jurnal/buat">Formulir Lengkap</Link><Link href="/jurnal/riwayat">Riwayat Jurnal</Link><Link href="/notulensi">Notulensi</Link>
    </nav>}

    {writable.length>0&&<section className="journalEasyEntry" aria-label="Mulai jurnal tanpa target manual">
      <div className="journalEasyEntryIntro"><strong>Tulis jurnal per pertemuan</strong></div>
      <div className="journalEasyEntryActions">
        <Link href="/jurnal/tulis"><BookOpenText size={20}/><span><strong>Tulis jurnal</strong></span><ArrowRight size={18}/></Link>
        <Link href="/jurnal/riwayat"><History size={20}/><span><strong>Jurnal tersimpan</strong></span><ArrowRight size={18}/></Link>
        <Link href="/notulensi"><ClipboardList size={20}/><span><strong>Notulensi musyawarah</strong></span><ArrowRight size={18}/></Link>
      </div>
    </section>}

    <section className="journalFilterBar card" aria-label="Filter dashboard jurnal">
      <label>Bulan<input className="input" aria-label="Bulan dashboard jurnal" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>
      
      <label>Kelas<select className="select" value={classId} onChange={e=>setClassId(e.target.value)}><option value="">Semua kelas</option>{relevantClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Jenis jurnal<select className="select" value={kind} onChange={e=>{setKind(e.target.value);setClassId('')}}><option value="">Semua jenis</option>{availableKinds.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
    </section>

    {error&&<div className="notice error section" role="alert">Data jurnal gagal dimuat: {error} <button className="btn ghost" onClick={()=>setRefresh(v=>v+1)}>Coba lagi</button></div>}
    <div className="journalMetrics">
      <article className="card journalMetric"><span><BookOpenText size={17}/> Total jurnal</span><strong>{loading?'…':filtered.length}</strong><small>{monthLabel(month)}</small></article>
      <article className="card journalMetric"><span><CheckCheck size={17}/> Jurnal selesai</span><strong>{loading?'…':done}</strong><small>{loading?'Memuat…':filtered.length?Math.round(done/filtered.length*100)+'% dari jurnal':'Belum ada data'}</small></article>
      <article className="card journalMetric"><span><ClipboardList size={17}/> Perlu dilengkapi</span><strong>{loading?'…':drafts}</strong><small>Jurnal berstatus draf</small></article>
      <article className="card journalMetric"><span><UsersRound size={17}/> Jurnal terhubung target</span><strong>{loading?'…':targetLinks}</strong><small>{targetLinks} target terkonfirmasi AI</small></article>
    </div>

    <div className="journalContentGrid section">
      <section className="card journalChartCard">
        <div className="cardHead"><div><h2>Aktivitas jurnal</h2></div><CalendarDays size={20}/></div>
        <div className="journalBars" role="img" aria-label="Grafik jumlah jurnal per pekan">
          {weeks.map(w=><div className="journalBarCol" key={w.label}><span>{w.count}</span><div className="journalBarTrack"><div className="journalBarFill" style={{height:(w.count?Math.max(9,w.count/maxWeek*100):0)+'%'}}/></div><small>{w.label}</small></div>)}
        </div>
        
      </section>
      {role!=='VIEWER'&&<section className="card journalStartCard">
        <div className="journalStartIcon"><BookOpenText size={23}/></div>
        <h2>Isi jurnal baru</h2>
        
        
        
        
        {canCreate?<Link className="btn journalStartButton" href="/jurnal/tulis">Mulai isi jurnal <ArrowRight size={16}/></Link>:<div className="notice">Akun ini belum memiliki akses menulis jurnal.</div>}
      </section>}
    </div>

    <section className="card section journalRecent">
      <div className="cardHead"><div><h2>Jurnal terbaru</h2></div><Link className="btn ghost" href="/jurnal/riwayat">Lihat riwayat <ArrowRight size={16}/></Link></div>
      {loading?<div className="emptyState">Memuat jurnal…</div>:recent.length?<div className="journalRecentList">{recent.map(j=><div className="journalRecentItem" key={j.id}><div className="journalRecentIcon"><BookOpenText size={18}/></div><div className="journalRecentText"><strong>{j.title}</strong><span>{kindLabels[j.journal_kind]||j.journal_kind} · {j.classes?.name||classes.find(c=>c.id===j.class_id)?.name||'Lintas kelas'} · {j.journal_date}</span></div><span className="badge">{j.state==='COMPLETED'?'Selesai':j.state==='ARCHIVED'?'Arsip':'Draf'}</span><Link className="btn ghost" href={'/jurnal/hasil/'+encodeURIComponent(j.id)}>Lihat detail <ArrowRight size={14}/></Link></div>)}</div>:<div className="journalEmpty"><BookOpenText size={27}/><strong>Belum ada jurnal untuk filter ini</strong>{canCreate&&<Link href="/jurnal/buat" className="btn">Tambah jurnal pertama</Link>}</div>}
    </section>
    <div className="journalIntegration"><Target size={18}/><Link href="/target">Target & Progres <ArrowRight size={13}/></Link></div>
  </div>;
}
