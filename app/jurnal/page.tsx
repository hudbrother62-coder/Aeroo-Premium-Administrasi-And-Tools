'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {BookOpenText,ArrowRight,ClipboardList,Target,CheckCheck,UsersRound,CalendarDays,History,Plus} from 'lucide-react';
import {jakartaDate} from '@/lib/domain';
import {readScopesForRole,writeScopesForRole,type Audience} from '@/lib/access';

type Journal={id:string;class_id?:string;journal_date:string;journal_kind:string;title:string;state?:string;follow_up?:string;classes?:{id?:string;name?:string;level_id?:string};assessment?:{class_assessment?:{level_id?:string}};journal_progress?:Array<{member_id?:string;participant_key?:string;target_id?:string;progress_value?:number|null}>};
type Level={id:string;name:string};
type ClassRow={id:string;name:string;level_id?:string;audience:string};
const kindLabels:Record<string,string>={PENGKAJIAN:'Pengkajian',KELOMPOK:'Kelompok',IBU_IBU:'Ibu-Ibu',PENGURUS:'Musyawarah',CABERAWIT_CLASS:'Caberawit Kelas',CABERAWIT_INDIVIDUAL:'Caberawit Individu',MUDA_MUDI_CLASS:'Muda-Mudi Kelas',MUDA_MUDI_INDIVIDUAL:'Muda-Mudi Individu'};
const audienceFor=(kind:string):Audience=>(kind==='PENGKAJIAN'?'KELOMPOK':kind.startsWith('CABERAWIT')?'CABERAWIT':kind.startsWith('MUDA_MUDI')?'MUDA_MUDI':kind) as Audience;
const monthLabel=(month:string)=>new Date(Number(month.slice(0,4)),Number(month.slice(5,7))-1,1).toLocaleDateString('id-ID',{month:'long',year:'numeric'});

export default function JournalDashboard(){
  const[month,setMonth]=useState(jakartaDate().slice(0,7));
  const[levelId,setLevelId]=useState('');
  const[classId,setClassId]=useState('');
  const[kind,setKind]=useState('');
  const[role,setRole]=useState('VIEWER');
  const[readScopes,setReadScopes]=useState<Audience[]|null>(null);
  const[writeScopes,setWriteScopes]=useState<Audience[]|null>(null);
  const[levels,setLevels]=useState<Level[]>([]);
  const[classes,setClasses]=useState<ClassRow[]>([]);
  const[journals,setJournals]=useState<Journal[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  const[refresh,setRefresh]=useState(0);

  useEffect(()=>{
    let active=true;
    Promise.allSettled([fetch('/api/levels').then(r=>r.json()),fetch('/api/classes').then(r=>r.json()),fetch('/api/auth/me').then(r=>r.json())]).then(([l,c,u])=>{
      if(!active)return;
      if(l.status==='fulfilled'&&Array.isArray(l.value))setLevels(l.value);
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
    if(!readable.includes(audienceFor(j.journal_kind)))return false;
    if(kind&&j.journal_kind!==kind)return false;
    if(classId&&(j.classes?.id||j.class_id)!==classId)return false;
    if(levelId){
      const journalLevel=j.assessment?.class_assessment?.level_id||j.classes?.level_id||classes.find(c=>c.id===(j.classes?.id||j.class_id))?.level_id;
      if(journalLevel!==levelId)return false;
    }
    return true;
  }),[journals,kind,classId,levelId,classes,readable]);
  const relevantClasses=classes.filter(c=>!levelId||c.level_id===levelId).filter(c=>readable.includes(c.audience as Audience));
  const done=filtered.filter(j=>j.state==='COMPLETED').length;
  const drafts=filtered.filter(j=>j.state==='DRAFT'||!j.state).length;
  const observed=new Set(filtered.flatMap(j=>(j.journal_progress||[]).map(p=>p.participant_key||p.member_id).filter((v):v is string=>Boolean(v)))).size;
  const targetLinks=filtered.reduce((n,j)=>n+(j.journal_progress||[]).filter(p=>!!p.target_id).length,0);
  const weeks=Array.from({length:Math.ceil(new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate()/7)},(_,i)=>{
    const count=filtered.filter(j=>Math.floor((Number(j.journal_date.slice(8,10))-1)/7)===i).length;
    return{label:`Pekan ${i+1}`,count};
  });
  const maxWeek=Math.max(1,...weeks.map(w=>w.count));
  const recent=[...filtered].sort((a,b)=>b.journal_date.localeCompare(a.journal_date)).slice(0,5);
  const canCreate=writable.length>0;
  return <div className="journalWorkspace">
    <header className="pageHeader journalMainHeader">
      <div><span className="journalEyebrow"><BookOpenText size={15}/> Pencatatan kegiatan & pembinaan</span><h1>Dashboard Jurnal</h1><p>Catat kegiatan sesuai jenjang. Jurnal menjadi sumber observasi, evaluasi, progres target dan laporan.</p></div>
      <div className="journalHeaderActions"><Link className="btn ghost" href="/jurnal/riwayat"><History size={16}/> Riwayat Jurnal</Link>{canCreate&&<Link className="btn" href="/jurnal/cepat"><Plus size={16}/> Isi Jurnal (Mudah)</Link>}</div>
    </header>

    <nav className="journalSubnav" aria-label="Navigasi jurnal">
      <Link className="journalNavActive" href="/jurnal">Dashboard</Link><Link href="/jurnal/cepat">Isi Jurnal (Mudah)</Link><Link href="/jurnal/buat">Formulir Lengkap</Link><Link href="/jurnal/riwayat">Riwayat Jurnal</Link>
    </nav>

    {writable.some(scope=>scope==='CABERAWIT'||scope==='MUDA_MUDI')&&<section className="journalEasyEntry" aria-label="Cara tercepat mengisi jurnal">
      <div className="journalEasyEntryIntro"><strong>Mulai dari sini</strong><p>Hanya 3 langkah: pilih kegiatan, pilih target, lalu isi hasil. Cocok untuk guru yang tidak terbiasa dengan aplikasi.</p></div>
      <div className="journalEasyEntryActions">
        <Link href="/jurnal/cepat"><BookOpenText size={20}/><span><strong>Catat kegiatan</strong><small>Materi dan hasil pembelajaran</small></span><ArrowRight size={18}/></Link>
        <Link href="/jurnal/cepat?mode=score"><UsersRound size={20}/><span><strong>Nilai beberapa anak</strong><small>Ambil peserta hadir dari presensi</small></span><ArrowRight size={18}/></Link>
      </div>
    </section>}

    <section className="journalFilterBar card" aria-label="Filter dashboard jurnal">
      <label>Bulan<input className="input" aria-label="Bulan dashboard jurnal" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>
      <label>Jenjang<select className="select" value={levelId} onChange={e=>{setLevelId(e.target.value);setClassId('')}}><option value="">Semua jenjang</option>{levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <label>Kelas<select className="select" value={classId} onChange={e=>setClassId(e.target.value)}><option value="">Semua kelas</option>{relevantClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Jenis jurnal<select className="select" value={kind} onChange={e=>setKind(e.target.value)}><option value="">Semua jenis</option>{availableKinds.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
    </section>

    {error&&<div className="notice error section" role="alert">Data jurnal gagal dimuat: {error} <button className="btn ghost" onClick={()=>setRefresh(v=>v+1)}>Coba lagi</button></div>}
    <div className="journalMetrics">
      <article className="card journalMetric"><span><BookOpenText size={17}/> Total jurnal</span><strong>{loading?'…':filtered.length}</strong><small>{monthLabel(month)}</small></article>
      <article className="card journalMetric"><span><CheckCheck size={17}/> Jurnal selesai</span><strong>{loading?'…':done}</strong><small>{loading?'Memuat…':filtered.length?Math.round(done/filtered.length*100)+'% dari jurnal':'Belum ada data'}</small></article>
      <article className="card journalMetric"><span><ClipboardList size={17}/> Perlu dilengkapi</span><strong>{loading?'…':drafts}</strong><small>Jurnal berstatus draf</small></article>
      <article className="card journalMetric"><span><UsersRound size={17}/> Individu terobservasi</span><strong>{loading?'…':observed}</strong><small>{targetLinks} penilaian terhubung target</small></article>
    </div>

    <div className="journalContentGrid section">
      <section className="card journalChartCard">
        <div className="cardHead"><div><h2>Aktivitas jurnal</h2><p>Jumlah jurnal per pekan · {monthLabel(month)}</p></div><CalendarDays size={20}/></div>
        <div className="journalBars" role="img" aria-label="Grafik jumlah jurnal per pekan">
          {weeks.map(w=><div className="journalBarCol" key={w.label}><span>{w.count}</span><div className="journalBarTrack"><div className="journalBarFill" style={{height:(w.count?Math.max(9,w.count/maxWeek*100):0)+'%'}}/></div><small>{w.label}</small></div>)}
        </div>
        <div className="journalChartFooter">Grafik dihitung dari jurnal yang tersimpan, mengikuti pilihan jenjang, kelas dan jenis.</div>
      </section>
      <section className="card journalStartCard">
        <div className="journalStartIcon"><BookOpenText size={23}/></div>
        <h2>Isi jurnal baru</h2>
        <p>Satu formulir terpandu untuk semua jenis. Pilih jenis jurnal, kemudian sistem menampilkan kolom yang relevan dan data terhubung.</p>
        <div className="journalStep"><span>01</span> Pilih jenis jurnal dan tanggal</div>
        <div className="journalStep"><span>02</span> Hubungkan agenda/presensi, jenjang dan kelas</div>
        <div className="journalStep"><span>03</span> Isi materi, evaluasi dan observasi target</div>
        {canCreate?<Link className="btn journalStartButton" href="/jurnal/buat">Mulai isi jurnal <ArrowRight size={16}/></Link>:<div className="notice">Akun ini belum memiliki akses menulis jurnal.</div>}
      </section>
    </div>

    <section className="card section journalRecent">
      <div className="cardHead"><div><h2>Jurnal terbaru</h2><p>Ringkasan pencatatan sesuai filter yang aktif.</p></div><Link className="btn ghost" href="/jurnal/riwayat">Lihat riwayat <ArrowRight size={16}/></Link></div>
      {loading?<div className="emptyState">Memuat jurnal…</div>:recent.length?<div className="journalRecentList">{recent.map(j=><div className="journalRecentItem" key={j.id}><div className="journalRecentIcon"><BookOpenText size={18}/></div><div className="journalRecentText"><strong>{j.title}</strong><span>{kindLabels[j.journal_kind]||j.journal_kind} · {j.classes?.name||classes.find(c=>c.id===j.class_id)?.name||'Lintas kelas'} · {j.journal_date}</span></div><span className="badge">{j.state==='COMPLETED'?'Selesai':j.state==='ARCHIVED'?'Arsip':'Draf'}</span><Link className="btn ghost" href={writable.includes(audienceFor(j.journal_kind))?'/jurnal/buat?journal_id='+j.id:'/jurnal/riwayat'}>Lihat <ArrowRight size={14}/></Link></div>)}</div>:<div className="journalEmpty"><BookOpenText size={27}/><strong>Belum ada jurnal untuk filter ini</strong><p>Jurnal yang disimpan akan otomatis muncul di sini dan masuk ke riwayat.</p>{canCreate&&<Link href="/jurnal/buat" className="btn">Tambah jurnal pertama</Link>}</div>}
    </section>
    <div className="journalIntegration"><Target size={18}/><span><strong>Terhubung dengan Target & Progres.</strong> Penilaian individu yang ditautkan ke target dapat dipakai untuk analisis perkembangan. <Link href="/target">Buka Target & Progres <ArrowRight size={13}/></Link></span></div>
  </div>;
}
