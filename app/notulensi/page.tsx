'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {CalendarDays,ClipboardList,FilePenLine,Plus,Search,ExternalLink,FileText} from 'lucide-react';
import {jakartaDate} from '@/lib/domain';
import {isNotulensi,meetingTypes,normalizeMeetingType,type MeetingType} from '@/lib/journal-kind';
import {readScopesForRole,writeScopesForRole,type Audience} from '@/lib/access';
import MinutesArchiveEntry,{type ArchivedMinute} from '@/components/MinutesArchiveEntry';
import '../jurnal/journal.css';
import './notulensi.css';

type Journal={
  id:string;title:string;journal_date:string;journal_kind:string;state?:string|null;
  started_at?:string|null;ended_at?:string|null;summary?:string|null;decisions?:string|null;notes?:string|null;
  assessment?:{meeting_minutes?:boolean;meeting_type?:string|null;proposal?:string|null;
    source_text?:string|null;source_original_date?:string|null;source_url?:string|null;
    requires_attachment_review?:boolean;requires_date_review?:boolean}|null;
  activity_types?:{name?:string|null}|null;
};
const audience=(kind:string):Audience=>(kind==='PENGKAJIAN'?'KELOMPOK':kind.startsWith('CABERAWIT')?'CABERAWIT':kind.startsWith('MUDA_MUDI')?'MUDA_MUDI':kind) as Audience;
const dateLabel=(day:string)=>new Date(day+'T12:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const monthLabel=(month:string)=>new Date(month+'-01T12:00:00').toLocaleDateString('id-ID',{month:'long',year:'numeric'});
const meetingType=(journal:Journal)=>normalizeMeetingType(journal.assessment?.meeting_type,journal.journal_kind);

function MinutesText({value}:{value:string}){
  return <div className="minutesDocumentText">{value}</div>;
}
function MinutesContent({journal,editable}:{journal:Journal;editable:boolean}){
  const sections=[
    {name:'Usulan',content:journal.assessment?.proposal||journal.summary||''},
    {name:'Pembahasan / Keputusan',content:journal.decisions||''},
    {name:'Catatan dan Evaluasi',content:journal.notes||''}
  ].filter(s=>s.content.trim());
  const source=journal.assessment?.source_text;
  const verifiedSource=journal.assessment?.source_url?.startsWith('https://docs.google.com/document/')
    ?journal.assessment.source_url:null;
  return <div className="minutesEntryBody">
    {(journal.assessment?.requires_attachment_review||journal.assessment?.requires_date_review)&&
      <div className="minutesArchiveWarning" role="note">
        {journal.assessment?.requires_attachment_review
          ?'Lampiran pada dokumen sumber belum diverifikasi. Rincian lampiran tidak ditambahkan.'
          :'Penulisan hari pada sumber tidak sesuai tanggal kalender. Arsip mengikuti angka tanggal sumber.'}
      </div>}
    {sections.length?
      <div className="minutesResultSections">
        {sections.map((section,i)=><section className="minutesResultBlock" key={section.name}>
          <h3><span>{String(i+1).padStart(2,'0')}</span>{section.name}</h3>
          <MinutesText value={section.content}/>
        </section>)}
      </div>:<p className="minutesNoContent">Belum ada rincian tertulis yang dapat diverifikasi.</p>}
    {source&&<details className="minutesOriginal">
      <summary>Transkripsi sumber asli</summary>
      <MinutesText value={[journal.assessment?.source_original_date,source].filter(Boolean).join('\n')}/>
    </details>}
    <div className="minutesEntryActions">
      {verifiedSource&&<a href={verifiedSource} className="minutesSourceLink" rel="noopener noreferrer" target="_blank"><ExternalLink size={15}/> Dokumen sumber</a>}
      {editable&&<Link className="btn ghost" href={'/jurnal/buat?journal_id='+journal.id+'&from=notulensi'}><FilePenLine size={15}/> Edit notulensi</Link>}
    </div>
  </div>;
}
function MinutesTitle({journal}:{journal:Journal}){
  return <div className="minutesEntryHeading">
    <div className="minutesEntryMeta"><CalendarDays size={16}/>{dateLabel(journal.journal_date)}
      {(journal.started_at||journal.ended_at)&&<span>· {[journal.started_at?.slice(0,5),journal.ended_at?.slice(0,5)].filter(Boolean).join(' – ')}</span>}
    </div>
    <h2>{journal.title}</h2>
    <div className="minutesEntryBadges">
      <span>{meetingType(journal)}</span>
      <span className={journal.state==='COMPLETED'?'minutesStatusDone':'minutesStatusDraft'}>
        {journal.state==='COMPLETED'?'Tersimpan':'Draf / perlu dilengkapi'}
      </span>
    </div>
  </div>;
}
export default function NotulensiPage(){
  const [month,setMonth]=useState(jakartaDate().slice(0,7));
  const [type,setType]=useState<MeetingType|'ALL'>('ALL');
  const [query,setQuery]=useState('');
  const [archiveMonths,setArchiveMonths]=useState<string[]>([]);
  const [rows,setRows]=useState<Journal[]>([]);
  const [archives,setArchives]=useState<ArchivedMinute[]>([]);
  const [allArchives,setAllArchives]=useState<ArchivedMinute[]>([]);
  const [allJournalMonths,setAllJournalMonths]=useState<Array<{month:string;type:MeetingType}>>([]);
  const [role,setRole]=useState('VIEWER');
  const [read,setRead]=useState<Audience[]|null>(null);
  const [write,setWrite]=useState<Audience[]|null>(null);
  const [ready,setReady]=useState(false),[loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    const params=new URLSearchParams(window.location.search);
    const paramMonth=params.get('month'),paramType=params.get('type');
    if(paramMonth&&/^\d{4}-(0[1-9]|1[0-2])$/.test(paramMonth))setMonth(paramMonth);
    if(paramType&&meetingTypes.some(x=>x===paramType))setType(paramType as MeetingType);
    fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.json()).then(user=>{
      if(!active)return;
      setRole(user?.role||'VIEWER');
      setRead(Array.isArray(user?.read_scopes)?user.read_scopes:null);
      setWrite(Array.isArray(user?.write_scopes)?user.write_scopes:null);
    }).catch(()=>{}).finally(()=>{if(active)setReady(true)});
    return()=>{active=false};
  },[]);

  useEffect(()=>{
    const ctrl=new AbortController();
    Promise.all([
      fetch('/api/journals?kind=PENGURUS',{cache:'no-store',signal:ctrl.signal}),
      fetch('/api/notulensi/arsip',{cache:'no-store',signal:ctrl.signal})
    ]).then(async ([jr,ar])=>{
      const [j,a]=await Promise.all([jr.json(),ar.json()]);
      if(!jr.ok||!ar.ok)throw Error('Gagal memuat indeks arsip notulensi.');
      if(!Array.isArray(j)||!Array.isArray(a))throw Error('Format indeks notulensi tidak valid.');
      return {j:j as Journal[],a:a as ArchivedMinute[]};
    }).then(({j,a})=>{
      if(ctrl.signal.aborted)return;
      setAllArchives(a);
      const journalMonths=j.filter(isNotulensi).map(item=>({month:item.journal_date.slice(0,7),type:meetingType(item)}));
      setAllJournalMonths(journalMonths);
      const months=[...new Set([...journalMonths.map(x=>x.month),...a.map(x=>x.meeting_month)])].sort().reverse();
      setArchiveMonths(months);
      const params=new URLSearchParams(window.location.search);
      if(!params.get('month'))setMonth(current=>months.includes(current)?current:(months[0]||current));
    }).catch(()=>{});
    return()=>ctrl.abort();
  },[]);
  useEffect(()=>{
    const ctrl=new AbortController();
    setLoading(true);setError('');
    Promise.all([
      fetch('/api/journals?'+new URLSearchParams({month}),{cache:'no-store',signal:ctrl.signal}),
      fetch('/api/notulensi/arsip?'+new URLSearchParams({month}),{cache:'no-store',signal:ctrl.signal})
    ]).then(async ([jr,ar])=>{
      const [j,a]=await Promise.all([jr.json(),ar.json()]);
      if(!jr.ok||!ar.ok)throw Error(j.error||a.error||'Gagal memuat notulensi');
      if(!Array.isArray(j)||!Array.isArray(a))throw Error('Format arsip tidak valid.');
      return {j:j as Journal[],a:a as ArchivedMinute[]};
    }).then(({j,a})=>{if(!ctrl.signal.aborted){setRows(j);setArchives(a)}})
      .catch(e=>{if(!ctrl.signal.aborted){setError(e instanceof Error?e.message:'Gagal memuat notulensi');setRows([]);setArchives([])}})
      .finally(()=>{if(!ctrl.signal.aborted)setLoading(false)});
    return()=>ctrl.abort();
  },[month]);
  const allowedRead=read??readScopesForRole(role);
  const allowedWrite=write??writeScopesForRole(role);
  const canWrite=ready&&allowedWrite.includes('PENGURUS');
  const items=useMemo(()=>rows.filter(j=>isNotulensi(j)
    &&allowedRead.includes(audience(j.journal_kind))
    &&(type==='ALL'||meetingType(j)===type)
    &&[j.title,j.summary,j.decisions,j.notes,j.assessment?.source_text].some(s=>(s||'').toLowerCase().includes(query.trim().toLowerCase()))
    ).sort((a,b)=>b.journal_date.localeCompare(a.journal_date)),[rows,allowedRead,type,query]);
  const archiveItems=useMemo(()=>archives.filter(item=>
    (type==='ALL'||item.meeting_type===type)&&allowedRead.includes('PENGURUS')&&
    [item.title,item.source_text,item.source_heading,...item.sections.flatMap(section=>section.lines.map(line=>line.text))]
      .some(text=>(text||'').toLocaleLowerCase('id-ID').includes(query.trim().toLocaleLowerCase('id-ID')))
  ),[archives,type,allowedRead,query]);
  const count=items.length+archiveItems.length;
  const combined=useMemo(()=>{
    const journalEntries=items.map(item=>({key:'journal:'+item.id,month:item.journal_date.slice(0,7),day:item.journal_date,kind:'journal' as const,journal:item}));
    const archiveEntries=archiveItems.map(item=>({key:'archive:'+item.id,month:item.meeting_month,day:item.meeting_date||'',kind:'archive' as const,archive:item}));
    return [...journalEntries,...archiveEntries].sort((a,b)=>b.month.localeCompare(a.month)||b.day.localeCompare(a.day)||a.key.localeCompare(b.key));
  },[items,archiveItems]);
  const changeMeetingType=(next:MeetingType|'ALL')=>{
    setType(next);
    const available=[...new Set([
      ...allJournalMonths.filter(j=>next==='ALL'||j.type===next).map(j=>j.month),
      ...allArchives.filter(a=>next==='ALL'||a.meeting_type===next).map(a=>a.meeting_month)
    ])].sort().reverse();
    if(available.length&&!available.includes(month))setMonth(available[0]);
  };
  const monthDisplay=/^\d{4}-(0[1-9]|1[0-2])$/.test(month)?monthLabel(month):'Bulan dipilih';
  return <main className="journalWorkspace minutesWorkspace">
    <header className="pageHeader minutesHeader">
      <div><span className="journalEyebrow"><ClipboardList size={16}/> ARSIP MUSYAWARAH</span>
        <h1>Notulensi</h1><p>Catatan musyawarah yang tersusun menurut bulan dan jenis pertemuan.</p></div>
      {canWrite&&<Link href={'/jurnal/tulis?mode=notulensi&type='+encodeURIComponent(type==='ALL'?'Kelompok':type)} className="btn minutesAdd"><Plus size={17}/> Buat Notulensi</Link>}
    </header>
    <section className="card minutesFilter" aria-label="Filter notulensi">
      <label><span><CalendarDays size={16}/> Bulan</span>
        <input className="input" type="month" value={month} onChange={e=>setMonth(e.target.value)} aria-label="Pilih bulan notulensi"/></label>
      <label><span><ClipboardList size={16}/> Jenis musyawarah</span>
        <select className="select" aria-label="Pilih jenis musyawarah" value={type} onChange={e=>changeMeetingType(e.target.value as MeetingType|'ALL')}>
          <option value="ALL">Semua jenis</option>
          {meetingTypes.map(t=><option key={t} value={t}>{t}</option>)}
        </select></label>
      <label className="minutesSearch"><span><Search size={16}/> Cari isi</span>
        <input className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari judul atau pembahasan…"/></label>
    </section>
    <div className="minutesListHeading">
      <div><span>ARSIP TERPILIH</span><h2>{monthDisplay}</h2></div>
      {!loading&&!error&&<p>{count} notulensi {type==='ALL'?'':('· '+type)}</p>}
    </div>
    {error&&<div className="notice error" role="alert">{error}</div>}
    <section className="minutesList" aria-label="Isi notulensi">
      {loading?<div className="card minutesEmpty">Memuat notulensi…</div>
      :count>0?combined.map(entry=>{
        const opened=count===1;
        return entry.kind==='journal'?
          opened?<article className="card minutesFullCard" key={entry.key}>
            <MinutesTitle journal={entry.journal}/><MinutesContent journal={entry.journal} editable={allowedWrite.includes(audience(entry.journal.journal_kind))}/>
          </article>:
          <details className="card minutesAccordion" key={entry.key}>
            <summary><MinutesTitle journal={entry.journal}/><span className="minutesExpandLabel">Buka isi</span></summary>
            <MinutesContent journal={entry.journal} editable={allowedWrite.includes(audience(entry.journal.journal_kind))}/>
          </details>:
          <MinutesArchiveEntry key={entry.key} item={entry.archive} collapsed={!opened}/>;
      }):<div className="card minutesEmpty"><FileText size={25}/><strong>Belum ada notulensi</strong>
        <p>Tidak ada catatan untuk jenis dan bulan yang dipilih. Ganti filter untuk melihat arsip lainnya.</p>
        {canWrite&&<Link className="btn" href={'/jurnal/tulis?mode=notulensi&type='+encodeURIComponent(type==='ALL'?'Kelompok':type)}>Buat Notulensi</Link>}
      </div>}
    </section>
    {archiveMonths.length>0&&<p className="minutesArchiveInfo">Arsip tersedia sejak {monthLabel(archiveMonths[archiveMonths.length-1])} hingga {monthLabel(archiveMonths[0])}.</p>}
  </main>;
}
