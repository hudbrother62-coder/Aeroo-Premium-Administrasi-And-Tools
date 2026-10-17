'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,BookOpen,CheckCircle2,FileText,LoaderCircle,RefreshCw,Sparkles} from 'lucide-react';
import {jakartaDate} from '@/lib/domain';
import {writeScopesForRole,type Audience} from '@/lib/access';
import './tulis.css';

type ClassRow={id:string;name:string;level_id?:string|null;audience:string};
type Activity={id:string;name:string;audience:string};
type EventRow={id:string;event_date:string;title:string;audience:string;class_id?:string|null;activity_type_id?:string|null;agenda_id?:string|null;state?:string};
type AgendaRow={id:string;title:string;audience:string;class_id?:string|null;activity_type_id?:string|null;status?:string;starts_at:string};
type TargetMatch={target_id:string;title:string;reason:string;quote:string;relation:string};
type Analysis={summary:string;suggestion:string;matches:TargetMatch[];created_at:string;status:string};
const journalKinds=[
  {value:'KELOMPOK',label:'Kegiatan Kelompok',audience:'KELOMPOK'},
  {value:'CABERAWIT_CLASS',label:'Pembelajaran Caberawit',audience:'CABERAWIT'},
  {value:'MUDA_MUDI_CLASS',label:'Pembelajaran Muda-Mudi',audience:'MUDA_MUDI'},
  {value:'IBU_IBU',label:'Kegiatan ibu-ibu',audience:'IBU_IBU'},
  {value:'PENGURUS',label:'Rapat atau kegiatan pengurus',audience:'PENGURUS'}
];
export default function TulisJurnal(){
  const [role,setRole]=useState('VIEWER');
  const [scopes,setScopes]=useState<Audience[]>([]);
  const [classes,setClasses]=useState<ClassRow[]>([]);
  const [activities,setActivities]=useState<Activity[]>([]);
  const [events,setEvents]=useState<EventRow[]>([]);
  const [ready,setReady]=useState(false);
  const [date,setDate]=useState(jakartaDate());
  const [kind,setKind]=useState('KELOMPOK');
  const [classId,setClassId]=useState('');
  const [activityId,setActivityId]=useState('');
  const [selectedEvent,setSelectedEvent]=useState('');
  const [fromAgenda,setFromAgenda]=useState(false);
  const [agendaId,setAgendaId]=useState('');
  const [agendaOptions,setAgendaOptions]=useState<AgendaRow[]>([]);
  const [title,setTitle]=useState('');
  const [startedAt,setStartedAt]=useState('');
  const [endedAt,setEndedAt]=useState('');
  const [proposal,setProposal]=useState('');
  const [decisions,setDecisions]=useState('');
  const [meetingNotes,setMeetingNotes]=useState('');
  const [material,setMaterial]=useState('');
  const [summary,setSummary]=useState('');
  const [obstacles,setObstacles]=useState('');
  const [followUp,setFollowUp]=useState('');
  const [saving,setSaving]=useState(false);
  const [analyzing,setAnalyzing]=useState(false);
  const [error,setError]=useState('');
  const [aiError,setAiError]=useState('');
  const [savedId,setSavedId]=useState('');
  const [analysis,setAnalysis]=useState<Analysis|null>(null);
  const scope=(journalKinds.find(x=>x.value===kind)?.audience||'KELOMPOK') as Audience;
  const options=journalKinds.filter(k=>scopes.includes(k.audience as Audience));
  const availableClasses=classes.filter(c=>c.audience===scope);
  const availableActivities=activities.filter(a=>a.audience===scope);
  const selectedAgenda=agendaOptions.find(a=>a.id===agendaId);
  const selectedActivity=availableActivities.find(a=>a.id===activityId);
  const isMeeting=kind==='PENGURUS'||/musyawarah|rapat|notulen/i.test([selectedAgenda?.title,selectedActivity?.name].filter(Boolean).join(' '));
  useEffect(()=>{
    setActivityId(previous=>activities.some(a=>a.id===previous&&a.audience===scope)?previous:activities.find(a=>a.audience===scope)?.id||'');
  },[scope,activities]);
  useEffect(()=>{
    let alive=true;
    if(!fromAgenda||!date){setAgendaOptions([]);return;}
    const from=date+'T00:00:00+07:00',to=date+'T23:59:59+07:00';
    fetch('/api/agenda?'+new URLSearchParams({from,to}),{cache:'no-store'})
      .then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error||'Agenda gagal dimuat.');return v})
      .then(v=>{if(alive)setAgendaOptions(Array.isArray(v)?v.filter((a:AgendaRow)=>a.audience===scope&&a.status!=='CANCELLED'):[])})
      .catch(e=>{if(alive){setAgendaOptions([]);setError(e.message)}});
    return()=>{alive=false};
  },[fromAgenda,date,scope]);
  useEffect(()=>{
    Promise.all([
      fetch('/api/auth/me').then(r=>r.json()),
      fetch('/api/classes').then(r=>r.json()),
      fetch('/api/activity-types').then(r=>r.json())
    ]).then(([u,c,a])=>{
      setRole(u.role||'VIEWER');
      const allowed=(Array.isArray(u.write_scopes)?u.write_scopes:writeScopesForRole(u.role||'VIEWER')) as Audience[];
      setScopes(allowed);setClasses(Array.isArray(c)?c:[]);setActivities(Array.isArray(a)?a:[]);
      const requested=new URLSearchParams(window.location.search).get('kind');
      const first=journalKinds.find(x=>x.value===requested&&allowed.includes(x.audience as Audience))||
        journalKinds.find(x=>allowed.includes(x.audience as Audience));
      if(first)setKind(first.value);
      setReady(true);
    }).catch(()=>{setError('Data awal tidak dapat dimuat.');setReady(true)});
  },[]);
  useEffect(()=>{
    let alive=true;
    setSelectedEvent('');
    if(!date||!scope){setEvents([]);return;}
    fetch('/api/attendance?'+new URLSearchParams({from:date,to:date,audience:scope}),{cache:'no-store'})
      .then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error||'Presensi gagal dimuat');return v})
      .then(v=>{if(alive)setEvents(Array.isArray(v)?v:[])}).catch(()=>{if(alive)setEvents([])});
    return()=>{alive=false};
  },[date,scope]);
  const matching=useMemo(()=>events.filter(e=>e.state!=='CANCELLED'&&(!classId||e.class_id===classId)&&(fromAgenda?!!agendaId&&e.agenda_id===agendaId:e.agenda_id==null&&!!activityId&&e.activity_type_id===activityId)),[events,classId,activityId,fromAgenda,agendaId]);
  const event=matching.find(x=>x.id===selectedEvent)||matching.length===1?matching.find(x=>x.id===selectedEvent)||matching[0]:null;
  const classRequired=scope==='CABERAWIT'||scope==='MUDA_MUDI';
  async function analyze(id:string){
    setAnalyzing(true);setAiError('');
    try{
      const r=await fetch('/api/journals/'+id+'/analyze',{method:'POST'});
      const v=await r.json();if(!r.ok)throw Error(v.error||'Analisis belum bisa dijalankan.');
      setAnalysis(v.analysis);
    }catch(e){setAiError((e as Error).message)}finally{setAnalyzing(false)}
  }
  async function save(){
    if(saving||!scopes.includes(scope))return;
    if(!date){setError('Pilih tanggal jurnal.');return;}
    if(isMeeting&&!proposal.trim()&&!decisions.trim()&&!meetingNotes.trim()){setError('Isi usulan, keputusan, atau catatan musyawarah.');return;}
    if(!isMeeting&&!summary.trim()&&!material.trim()){setError('Tuliskan isi jurnal atau materi kegiatan terlebih dahulu.');return;}
    if(startedAt&&endedAt&&startedAt===endedAt){setError('Jam mulai dan selesai tidak boleh sama.');return;}
    if(fromAgenda&&!selectedAgenda){setError('Pilih agenda khusus terlebih dahulu.');return;}
    if(!fromAgenda&&!activityId){setError('Pilih jenis kegiatan terlebih dahulu.');return;}
    if(classRequired&&!classId&&!selectedAgenda?.class_id){setError('Pilih kelas supaya jurnal sesuai dengan peserta dan target.');return;}
    if(matching.length>1&&!selectedEvent){setError('Ada beberapa presensi di hari itu. Pilih pertemuan yang tepat.');return;}
    setSaving(true);setError('');
    try{
      const e=event;
      const linkedClass=classId||selectedAgenda?.class_id||'';
      const classroom=availableClasses.find(c=>c.id===linkedClass);
      const body={
        journal_kind:kind,journal_date:date,title:title.trim()||'Jurnal '+(selectedAgenda?.title||availableActivities.find(a=>a.id===activityId)?.name||journalKinds.find(x=>x.value===kind)?.label||'kegiatan')+' - '+date,
        event_id:e?.id||null,agenda_id:e?.agenda_id||selectedAgenda?.id||null,class_id:linkedClass||null,activity_type_id:e?.activity_type_id||selectedAgenda?.activity_type_id||activityId||null,
        started_at:startedAt||null,ended_at:endedAt||null,
        material:isMeeting?null:material.trim()||null,
        summary:isMeeting?proposal.trim()||null:summary.trim()||null,
        decisions:isMeeting?decisions.trim()||null:null,
        notes:isMeeting?meetingNotes.trim()||null:null,
        obstacles:isMeeting?null:obstacles.trim()||null,
        follow_up:isMeeting?null:followUp.trim()||null,
        assessment:{free_form:true,source:'TEACHER_TEXT',meeting_minutes:isMeeting,proposal:isMeeting?proposal.trim():null,class_assessment:{level_id:classroom?.level_id||null}},
        progress:[],revision:0,state:'COMPLETED'
      };
      const response=await fetch('/api/journals',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const result=await response.json();if(!response.ok)throw Error(result.error||'Jurnal gagal disimpan.');
      if(!result.id)throw Error('Respons penyimpanan belum memberi ID. Periksa riwayat sebelum mengulangi.');
      setSavedId(result.id);
      if(!isMeeting)await analyze(result.id);
    }catch(e){setError((e as Error).message)}finally{setSaving(false)}
  }
  if(!ready)return <div className="fj-shell"><div className="card section">Memuat formulir jurnal…</div></div>;
  if(!options.length)return <div className="fj-shell"><p className="notice">Akun ini belum diberi izin menulis jurnal.</p><Link href="/jurnal">Kembali ke Jurnal</Link></div>;

  return <main className="fj-shell">
    <Link href="/jurnal" className="fj-back"><ArrowLeft size={17}/> Kembali ke Jurnal</Link>
    <header className="fj-header"><span><BookOpen size={18}/> CATATAN GURU</span><h1>Tulis Jurnal</h1></header>
    {!savedId?<section className="fj-panel">
      <div className="fj-row">
        <label>Jenis kegiatan<select value={kind} onChange={e=>{setKind(e.target.value);setClassId('');setActivityId('');setSelectedEvent('');setFromAgenda(false);setAgendaId('')}}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
        <label>Tanggal<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
        {classRequired&&<label>Kelas<select value={classId} onChange={e=>{setClassId(e.target.value);setSelectedEvent('')}}><option value="">Pilih kelas</option>{availableClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
        <label>Kegiatan<select value={fromAgenda?'AGENDA':activityId} onChange={e=>{const value=e.target.value;setFromAgenda(value==='AGENDA');setAgendaId('');setSelectedEvent('');setActivityId(value==='AGENDA'?'':value);}}>
          <option value="" disabled>Pilih kegiatan</option>{availableActivities.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}<option value="AGENDA">Lainnya — dari agenda khusus</option>
        </select></label>
        {fromAgenda&&<label>Agenda khusus<select value={agendaId} onChange={e=>{const value=e.target.value;setAgendaId(value);setSelectedEvent('');const a=agendaOptions.find(x=>x.id===value);if(a?.class_id)setClassId(a.class_id);}}><option value="">Pilih agenda yang sudah dibuat</option>{agendaOptions.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select></label>}
      </div>
      {matching.length>0&&<div className="fj-attendance">
        <CheckCircle2 size={18}/><div><strong>Presensi tanggal ini ditemukan</strong></div>
        {matching.length>1&&<select aria-label="Pilih presensi terkait" value={selectedEvent} onChange={e=>setSelectedEvent(e.target.value)}><option value="">Pilih pertemuan</option>{matching.map(e=><option value={e.id} key={e.id}>{e.title}</option>)}</select>}
      </div>}
      <label className="fj-field">Judul<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Judul kegiatan"/></label>
      <div className="fj-row">
        <label>Jam mulai<input type="time" value={startedAt} onChange={e=>setStartedAt(e.target.value)}/></label>
        <label>Jam selesai<input type="time" value={endedAt} onChange={e=>setEndedAt(e.target.value)}/></label>
      </div>
      {isMeeting?<>
        <label className="fj-field">Usulan<textarea rows={3} value={proposal} onChange={e=>setProposal(e.target.value)} placeholder="Usulan yang disampaikan"/></label>
        <label className="fj-field">Keputusan<textarea rows={3} value={decisions} onChange={e=>setDecisions(e.target.value)} placeholder="Keputusan musyawarah"/></label>
        <label className="fj-field">Catatan<textarea rows={4} value={meetingNotes} onChange={e=>setMeetingNotes(e.target.value)} placeholder="Catatan penting"/></label>
      </>:<>
        <label className="fj-field">Materi<textarea rows={2} value={material} onChange={e=>setMaterial(e.target.value)} placeholder="Materi kegiatan"/></label>
        <label className="fj-field"><strong>Catatan kegiatan</strong><textarea rows={7} value={summary} onChange={e=>setSummary(e.target.value)} placeholder="Isi jurnal"/></label>
        <details className="fj-optional"><summary>Tambahan</summary>
          <label className="fj-field">Kendala<textarea rows={2} value={obstacles} onChange={e=>setObstacles(e.target.value)} placeholder="Kendala"/></label>
          <label className="fj-field">Rencana tindak lanjut<textarea rows={2} value={followUp} onChange={e=>setFollowUp(e.target.value)} placeholder="Tindak lanjut"/></label>
        </details>
      </>}
      {error&&<div className="fj-error" role="alert">{error}</div>}
      <div className="fj-actions"><Link href="/jurnal" className="fj-secondary">Batal</Link><button type="button" className="fj-primary" disabled={saving} onClick={()=>void save()}>{saving?<LoaderCircle size={19}/>:<FileText size={19}/>} {saving?'Menyimpan…':'Simpan jurnal'}</button></div>
    </section>:<section className="fj-panel">
      <div className="fj-success"><CheckCircle2 size={38}/><h2>Jurnal berhasil disimpan</h2></div>
      {analyzing&&<div className="fj-status"><Sparkles size={19}/> Groq sedang membaca jurnal dan mencari target yang relevan…</div>}
      {aiError&&<div className="fj-hint" role="status">Analisis AI belum tersedia: {aiError} <button type="button" onClick={()=>void analyze(savedId)} disabled={analyzing}><RefreshCw size={15}/> Coba lagi</button></div>}
      {!isMeeting&&analysis&&<div className="fj-ai">
        <h3><Sparkles size={18}/> Analisis AI</h3>
        <p>{analysis.summary}</p>
        {analysis.matches.length>0?<div className="fj-matches">{analysis.matches.map(x=><article key={x.target_id}><strong>{x.title}</strong><span>{x.relation==='DIAJARKAN'?'Materi tercatat diajarkan':x.relation==='INDIKASI'?'Kemungkinan terkait':'Belum terbukti'}</span><p>{x.reason}</p><blockquote>“{x.quote}”</blockquote></article>)}</div>:<div className="fj-hint">Target belum cocok.</div>}
        {analysis.suggestion&&<p className="fj-suggestion"><strong>Saran tindak lanjut:</strong> {analysis.suggestion}</p>}
        
      </div>}
      <div className="fj-actions"><Link className="fj-secondary" href={"/jurnal/hasil/"+savedId}>Lihat hasil dan AI</Link><Link className="fj-secondary" href="/jurnal/riwayat">Riwayat</Link><Link className="fj-primary" href="/jurnal/tulis">Tulis jurnal baru</Link></div>
    </section>}
  </main>;
}
