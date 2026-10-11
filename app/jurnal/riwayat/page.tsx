'use client';

import {jakartaDate} from '@/lib/domain';
import {studyRecap} from '@/lib/rebuild';
import Link from 'next/link';
import {ArrowLeft,History} from 'lucide-react';
import {readScopesForRole,writeScopesForRole,type Audience} from '@/lib/access';
import {useEffect,useState} from 'react';

type Journal={id:string;journal_date:string;journal_kind:string;title:string;state?:string;revision?:number;started_at?:string;ended_at?:string;material?:string;summary?:string;decisions?:string;assessment?:{presenter?:string;presenter_id?:string;materials?:Array<{topic:string;page:string;status?:string}>;meeting_type?:string;absence?:string};classes?:{id?:string;name?:string;level_id?:string};members?:{name?:string}};
const tabs=[['','Semua'],['PENGKAJIAN','Pengkajian'],['KELOMPOK','Kelompok'],['IBU_IBU','Ibu-Ibu'],['PENGURUS','Musyawarah'],['CABERAWIT_CLASS','Caberawit Kelas'],['CABERAWIT_INDIVIDUAL','Caberawit Individu'],['MUDA_MUDI_CLASS','Muda-Mudi Kelas'],['MUDA_MUDI_INDIVIDUAL','Muda-Mudi Individu']] as const;
const labels:Record<string,string>={PENGKAJIAN:'Pengkajian',KELOMPOK:'Kelompok',IBU_IBU:'Ibu-Ibu',PENGURUS:'Musyawarah',CABERAWIT_CLASS:'Caberawit Kelas',CABERAWIT_INDIVIDUAL:'Caberawit Individu',MUDA_MUDI_CLASS:'Muda-Mudi Kelas',MUDA_MUDI_INDIVIDUAL:'Muda-Mudi Individu'};

export default function Page(){
  const[month,setMonth]=useState(jakartaDate().slice(0,7));
  const[kind,setKind]=useState('');const[role,setRole]=useState('VIEWER'),[scopedRead,setScopedRead]=useState<Audience[]|null>(null),[scopedWrite,setScopedWrite]=useState<Audience[]|null>(null);useEffect(()=>{fetch('/api/auth/me').then(r=>r.json()).then(u=>{setRole(u.role);setScopedRead(Array.isArray(u.read_scopes)?u.read_scopes:null);setScopedWrite(Array.isArray(u.write_scopes)?u.write_scopes:null)})},[]);
  const[data,setData]=useState<Journal[]>([]);
  const[levels,setLevels]=useState<Array<{id:string;name:string}>>([]);
  const[levelId,setLevelId]=useState('');
  const[classes,setClasses]=useState<Array<{id:string;level_id?:string}>>([]);
  const[status,setStatus]=useState('');
  useEffect(()=>{Promise.allSettled([fetch('/api/levels').then(r=>r.json()),fetch('/api/classes').then(r=>r.json())]).then(([l,c])=>{if(l.status==='fulfilled'&&Array.isArray(l.value))setLevels(l.value);if(c.status==='fulfilled'&&Array.isArray(c.value))setClasses(c.value)})},[]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');

  const load=async()=>{
    setLoading(true);
    const q=new URLSearchParams({month});if(kind)q.set('kind',kind);
    try{const r=await fetch('/api/journals?'+q);const j=await r.json();if(!r.ok)throw new Error(j.error);setData(j);setError('')}
    catch{setError('Jurnal belum dapat dimuat.')}finally{setLoading(false)}
  };
  useEffect(()=>{void load()},[kind,month]);

  const filtered=data.filter(j=>(!status||(j.state||'DRAFT')===status)&&(!levelId||(j.classes?.level_id||classes.find(c=>c.id===j.classes?.id)?.level_id)===levelId));
  return <div className="journalWorkspace">
    <div className="pageHeader"><div><Link className="journalBack" href="/jurnal"><ArrowLeft size={16}/> Dashboard Jurnal</Link><h1>Riwayat Jurnal</h1><p>Temukan, periksa, dan perbarui jurnal yang sudah tersimpan.</p></div><Link className="btn writeOnly" href="/jurnal/buat">+ Tambah Jurnal</Link></div>
    <nav className="journalSubnav" aria-label="Navigasi jurnal"><Link href="/jurnal">Dashboard</Link><Link href="/jurnal/buat">Isi Jurnal</Link><Link href="/jurnal/riwayat" className="journalNavActive"><History size={15}/> Riwayat Jurnal</Link></nav>
    <div className="card journalFilterBar"><label>Bulan<input aria-label="Bulan jurnal" type="month" className="input" value={month} onChange={e=>setMonth(e.target.value)}/></label><label>Jenis jurnal<select aria-label="Jenis jurnal" className="select" value={kind} onChange={e=>setKind(e.target.value)}>{tabs.filter(([v])=>!v||(scopedRead??readScopesForRole(role)).includes((v==='PENGKAJIAN'?'KELOMPOK':v.startsWith('CABERAWIT')?'CABERAWIT':v.startsWith('MUDA_MUDI')?'MUDA_MUDI':v) as any)).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Jenjang<select className="select" value={levelId} onChange={e=>setLevelId(e.target.value)}><option value="">Semua jenjang</option>{levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label>Status<select className="select" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Semua status</option><option value="DRAFT">Draf</option><option value="COMPLETED">Selesai</option></select></label></div>
    {kind==='PENGKAJIAN'&&!loading&&<div className="metricGrid section">{Object.entries(studyRecap(filtered)).map(([k,v])=><div className="metricCard" key={k}><span>{({sessions:'Pengkajian selesai',minutes:'Durasi (menit)',presenters:'Pemateri',completed:'Materi tuntas',unfinished:'Materi belum tuntas'} as Record<string,string>)[k]}</span><strong>{v}</strong></div>)}</div>}{error&&<div className="notice error">{error}</div>}
    <div className="list section">
      {loading?<div className="card">Memuat…</div>:filtered.map(j=><article className="item" key={j.id}>
        <div className="row between"><span className="badge">{labels[j.journal_kind]||j.journal_kind}</span><span className="itemMeta">{new Date(j.journal_date+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</span></div>
        <div className="row between"><span className="badge">{j.state||'DRAFT'}</span>{(scopedWrite??writeScopesForRole(role)).includes((j.journal_kind==='PENGKAJIAN'?'KELOMPOK':j.journal_kind.startsWith('CABERAWIT')?'CABERAWIT':j.journal_kind.startsWith('MUDA_MUDI')?'MUDA_MUDI':j.journal_kind) as any)&&<Link className="btn ghost writeOnly" href={`/jurnal/buat?journal_id=${j.id}`}>Edit / {j.state==='ARCHIVED'?'Pulihkan':'Arsipkan'}</Link>}</div><h3 style={{margin:'12px 0 5px'}}>{j.title}</h3>
        <div className="itemMeta">{j.classes?.name||j.members?.name||''}{j.assessment?.meeting_type?' · '+j.assessment.meeting_type:''}{j.assessment?.absence&&j.assessment.absence!=='HADIR'?' · '+j.assessment.absence:''}</div>
        <p style={{fontSize:12,margin:'9px 0 0'}}>{j.journal_kind==='PENGURUS'?(j.summary||j.decisions||'Belum ada notulensi.'):(j.material||j.summary||'Belum ada catatan.')}</p>
        {!!j.assessment?.materials?.length&&<div className="chips section">{j.assessment.materials.map((m,i)=><span className="chip" key={i}>{m.topic}{m.page?' · hal. '+m.page:''}</span>)}</div>}
      </article>)}
      {!loading&&!filtered.length&&<div className="emptyState">Belum ada jurnal.</div>}
    </div>
  </div>;
}
