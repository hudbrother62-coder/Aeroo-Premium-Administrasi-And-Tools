'use client';

import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import {ClipboardCheck} from 'lucide-react';
import {audienceLabels,writeScopesForRole,type Audience,type Role} from '@/lib/access';
import {jakartaDate} from '@/lib/domain';
import '@/app/presensi/routine.css';

type Activity={id:string;name:string;audience:string};
type ClassRow={id:string;name:string;audience:string;level_id?:string};
type AgendaRow={id:string;title:string;starts_at:string;audience:Audience;class_id?:string|null;level_id?:string|null;status?:string;attendance_enabled?:boolean;attendance_event_id?:string|null};
type Participant={id:string;name:string;type:'member';meta:string;gender?:'L'|'P'|null};
import {AttendanceSaveQueue,attendancePendingKey,persistAttendancePending,moveAttendancePending,type AttendanceStatus,type AttendanceRow,type AttendanceValue} from '@/lib/attendance-save';
type Status=AttendanceStatus;
type Preset='KELOMPOK'|'CABERAWIT'|'CUSTOM';

export default function Page({embedded=false}:{embedded?:boolean}){
  const[activities,setActivities]=useState<Activity[]>([]);
  const[classes,setClasses]=useState<ClassRow[]>([]);
  const[agendas,setAgendas]=useState<AgendaRow[]>([]);
  const[agendaLoading,setAgendaLoading]=useState(false);
  const[role,setRole]=useState<Role|null>(null);const[scopedWrite,setScopedWrite]=useState<Audience[]|null>(null);
  const[ready,setReady]=useState(false);
  const[people,setPeople]=useState<Participant[]>([]);
  const[status,setStatus]=useState<Record<string,Status>>({});
  const[saving,setSaving]=useState(false);
  const[eventId,setEventId]=useState('');const[recovery,setRecovery]=useState<Array<{key:string;pending:any}>>([]);const[notes,setNotes]=useState<Record<string,string>>({});const[sync,setSync]=useState<Record<string,string>>({});const[conflicts,setConflicts]=useState<Record<string,AttendanceRow>>({});const[search,setSearch]=useState('');const[audit,setAudit]=useState<Record<string,any[]>>({});const[undo,setUndo]=useState<Record<string,AttendanceValue>|null>(null);const queue=useRef<AttendanceSaveQueue|null>(null);const statusRef=useRef(status);const notesRef=useRef(notes);statusRef.current=status;notesRef.current=notes;
  const[error,setError]=useState('');
  const[preset,setPreset]=useState<Preset>('CUSTOM');
  const[useAgenda,setUseAgenda]=useState(false);
  const[genderFilter,setGenderFilter]=useState<'ALL'|'L'|'P'>('ALL');
  const today=jakartaDate();
  const[form,setForm]=useState({title:'Kegiatan Kelompok',event_date:today,event_time:'',audience:'KELOMPOK' as Audience,activity_type_id:'',level_id:'',class_id:'',agenda_id:'',teacher_name:'',notes:''});

  const allowed=useMemo(()=>scopedWrite??writeScopesForRole(role),[role,scopedWrite]);

  useEffect(()=>{
    Promise.all([
      fetch('/api/activity-types').then(r=>r.json()),
      fetch('/api/classes').then(r=>r.json()),
      fetch('/api/auth/me').then(r=>r.json())
    ]).then(([a,c,u])=>{
      setActivities(Array.isArray(a)?a:[]);
      setClasses(Array.isArray(c)?c:[]);
      const nextRole=(u.role??'VIEWER') as Role;
      setRole(nextRole);setScopedWrite(Array.isArray(u.write_scopes)?u.write_scopes:null);
      const scopes=Array.isArray(u.write_scopes)?u.write_scopes:writeScopesForRole(nextRole);
      const requested=new URLSearchParams(window.location.search).get('preset');
      if(requested==='kelompok'&&scopes.includes('KELOMPOK')){
        const activity=(Array.isArray(a)?a:[]).find((x:Activity)=>x.audience==='KELOMPOK'&&x.name==='Pengajian Kelompok');
        setPreset('KELOMPOK');setForm(v=>({...v,audience:'KELOMPOK',activity_type_id:activity?.id||'',title:'Kegiatan Kelompok',level_id:'',class_id:'',teacher_name:''}));
      }else if(requested==='caberawit'&&scopes.includes('CABERAWIT')){
        const activity=(Array.isArray(a)?a:[]).find((x:Activity)=>x.audience==='CABERAWIT'&&x.name==='Pengajian Caberawit');
        setPreset('CABERAWIT');setForm(v=>({...v,audience:'CABERAWIT',activity_type_id:activity?.id||'',title:'Pengajian Caberawit',level_id:'',class_id:'',teacher_name:''}));
      }else if(scopes.length){const group=scopes[0]==='KELOMPOK';const activity=(Array.isArray(a)?a:[]).find((x:Activity)=>x.audience==='KELOMPOK'&&x.name==='Pengajian Kelompok');setForm(v=>({...v,audience:scopes[0],title:group?'Kegiatan Kelompok':'',activity_type_id:group?(activity?.id||''):''}));}
      setReady(true);
    }).catch(()=>{setError('Akses presensi belum dapat dimuat.');setReady(true)});
  },[]);

  useEffect(()=>{
    if(!ready||eventId||!form.event_date)return;
    let active=true;setAgendaLoading(true);
    const from=form.event_date+'T00:00:00+07:00';const to=form.event_date+'T23:59:59+07:00';
    fetch('/api/agenda?'+new URLSearchParams({from,to}).toString()).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||'Gagal membaca agenda.');return j;})
      .then(j=>{if(active)setAgendas(Array.isArray(j)?j:[])}).catch(e=>{if(active){setAgendas([]);setError(e.message)}})
      .finally(()=>{if(active)setAgendaLoading(false)});
    return()=>{active=false};
  },[ready,form.event_date,eventId]);

  async function openEvent(id:string){
    const response=await fetch('/api/attendance/'+id);const event=await response.json();if(!response.ok)throw new Error(event.error||'Daftar belum dapat dimuat.');
    setEventId(id);const inferred:Preset=event.audience==='KELOMPOK'&&event.title==='Pengajian Kelompok'?'KELOMPOK':event.audience==='CABERAWIT'&&String(event.title||'').startsWith('Pengajian Caberawit')?'CABERAWIT':'CUSTOM';setPreset(inferred);setForm({title:event.title,event_date:event.event_date,event_time:event.event_time||'',audience:event.audience,activity_type_id:event.activity_type_id||'',level_id:event.level_id||'',class_id:event.class_id||'',agenda_id:event.agenda_id||'',teacher_name:event.teacher_name||'',notes:event.notes||''});
    const rows=event.attendance_records||[];setPeople(rows.map((r:any)=>({id:r.participant_key,name:r.member_name_snapshot||'Peserta',type:'member',meta:[r.class_name_snapshot,r.level_name_snapshot].filter(Boolean).join(' · '),gender:r.gender||null})));setStatus(Object.fromEntries(rows.map((r:any)=>[r.participant_key,r.status])));setNotes(Object.fromEntries(rows.map((r:any)=>[r.participant_key,r.notes||''])));setAudit(Object.fromEntries(rows.map((r:any)=>[r.participant_key,r.attendance_changes||[]])));
    const writerId=crypto.randomUUID();const marker='attendance-writer:'+id;const priorWriter=sessionStorage.getItem(marker);sessionStorage.setItem(marker,writerId);const storageKey=attendancePendingKey(id,writerId);const priorKey=priorWriter?attendancePendingKey(id,priorWriter):'attendance-pending:'+id;const nextQueue=new AttendanceSaveQueue(async(key,value,revision)=>{const r=await fetch('/api/attendance/'+id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({participant_key:key,revision,...value})});const data=await r.json();if(!r.ok&&r.status!==409)throw new Error(data.error);return data},(key,state,record)=>{setSync(v=>({...v,[key]:state}));if(state==='conflict'&&record)setConflicts(v=>({...v,[key]:record}));if(state==='saved'&&record){setStatus(v=>({...v,[key]:record.status}));setNotes(v=>({...v,[key]:record.notes||''}))}},pending=>{try{persistAttendancePending(localStorage,storageKey,pending)}catch{setError('Perubahan belum dapat disimpan di perangkat. Jangan tutup halaman.')}},()=>navigator.onLine);
    rows.forEach((r:any)=>nextQueue.seed(r.participant_key,{status:r.status,notes:r.notes||'',revision:r.revision??0}));queue.current=nextQueue;setSync({});setConflicts({});
    try{const pending=moveAttendancePending(localStorage,priorKey,storageKey);for(const key of Object.keys(pending)){if(!rows.some((r:any)=>r.participant_key===key))continue;const recoveredRevision=pending[key].revision;if(typeof recoveredRevision==='number'&&Number.isInteger(recoveredRevision))nextQueue.seed(key,{status:pending[key].status,notes:pending[key].notes||'',revision:recoveredRevision});setStatus(v=>({...v,[key]:pending[key].status}));setNotes(v=>({...v,[key]:pending[key].notes||''}));nextQueue.enqueue(key,pending[key])}const foreign=Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter((key):key is string=>!!key&&key.startsWith('attendance-pending:'+id+':')&&key!==storageKey);setRecovery(foreign.map(key=>({key,pending:JSON.parse(localStorage.getItem(key)||'{}')})))}catch{setError('Perubahan perangkat tidak dapat dimuat.')}
  }
  useEffect(()=>{if(!ready)return;const q=new URLSearchParams(window.location.search);const id=q.get('event_id');const agenda=q.get('agenda_id');if(id)void openEvent(id).catch(e=>setError(e.message));else if(agenda)void fetch('/api/attendance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({agenda_id:agenda})}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error);await openEvent(data.id)}).catch(e=>setError(e.message))},[ready]);
  useEffect(()=>{const retry=()=>queue.current?.retry();window.addEventListener('online',retry);return()=>window.removeEventListener('online',retry)},[]);
  function change(key:string,value:AttendanceValue){setStatus(v=>({...v,[key]:value.status}));setNotes(v=>({...v,[key]:value.notes}));queue.current?.enqueue(key,value)}
  function recoverPending(item:{key:string;pending:any}){for(const [key,value] of Object.entries(item.pending) as Array<[string,any]>){if(!people.some(p=>p.id===key))continue;if(Number.isInteger(value.revision))queue.current?.seed(key,{...value,revision:value.revision});change(key,value)}setRecovery(v=>v.filter(x=>x.key!==item.key))}
  const displayedPeople=people.filter(p=>(form.audience!=='KELOMPOK'||genderFilter==='ALL'||p.gender===genderFilter)&&p.name.toLowerCase().includes(search.toLowerCase()));
  function allPresent(){const pending=displayedPeople.filter(p=>statusRef.current[p.id]==null);if(!pending.length)return;const previous=Object.fromEntries(pending.map(p=>[p.id,{status:statusRef.current[p.id]??null,notes:notesRef.current[p.id]||''}]));setUndo(previous);pending.forEach(p=>change(p.id,{status:'H',notes:notesRef.current[p.id]||''}))}
  function resolve(key:string,keep:boolean){const server=conflicts[key];queue.current?.resolve(key,server,keep);setConflicts(v=>{const next={...v};delete next[key];return next})}

  useEffect(()=>{
    if(form.audience==='PENGURUS'){
      const mus=activities.find(a=>a.audience==='PENGURUS'&&a.name.toLowerCase().includes('musyawarah'));
      if(mus)setForm(v=>({...v,activity_type_id:mus.id,title:v.title||'Musyawarah Pengurus'}));
    }
  },[form.audience,activities]);

  const matching=useMemo(()=>activities.filter(a=>a.audience===form.audience||a.audience==='CUSTOM'),[activities,form.audience]);
  const classOptions=useMemo(()=>classes.filter(c=>c.audience===form.audience),[classes,form.audience]);
  const matchingAgendas=useMemo(()=>agendas.filter(a=>a.audience===form.audience&&a.attendance_enabled!==false&&a.status!=='CANCELLED'&&(!form.level_id||!a.level_id||a.level_id===form.level_id)&&(!form.class_id?!a.class_id:a.class_id===form.class_id)),[agendas,form.audience,form.level_id,form.class_id]);
  const selectedAgenda=matchingAgendas.find(a=>a.id===form.agenda_id);
  const routineAllowed=form.audience==='KELOMPOK'||form.audience==='CABERAWIT';
  const requiredAgenda=form.audience==='KELOMPOK'?false:!routineAllowed||useAgenda;
  useEffect(()=>{if(form.agenda_id&&!matchingAgendas.some(a=>a.id===form.agenda_id))setForm(v=>({...v,agenda_id:''}));},[form.agenda_id,matchingAgendas]);
  const routineDay=useMemo(()=>new Date(form.event_date+'T12:00:00+07:00').getDay(),[form.event_date]);
  const onRoutine=preset==='KELOMPOK'?(routineDay===1||routineDay===5):preset==='CABERAWIT'?(routineDay>=1&&routineDay<=6):true;
  function applyPreset(next:Preset){
    setPreset(next);
    if(next==='KELOMPOK'){
      const activity=activities.find(a=>a.audience==='KELOMPOK'&&a.name==='Pengajian Kelompok');
      setForm(v=>({...v,audience:'KELOMPOK',activity_type_id:activity?.id||'',title:'Kegiatan Kelompok',level_id:'',class_id:'',teacher_name:''}));
    }else if(next==='CABERAWIT'){
      const activity=activities.find(a=>a.audience==='CABERAWIT'&&a.name==='Pengajian Caberawit');
      setForm(v=>({...v,audience:'CABERAWIT',activity_type_id:activity?.id||'',title:'Pengajian Caberawit',level_id:'',class_id:'',teacher_name:''}));
    }else{
      const fallback=allowed[0]||'KELOMPOK';
      setForm(v=>({...v,audience:fallback,activity_type_id:'',title:'',level_id:'',class_id:'',teacher_name:''}));
    }
  }

  async function save(e:FormEvent){
    e.preventDefault();setSaving(true);setError('');
    try{
      if(!form.event_date)throw new Error('Pilih tanggal pertemuan.');
      if(form.audience==='CABERAWIT'&&!form.class_id)throw new Error('Pilih kelas Caberawit terlebih dahulu.');
      if(requiredAgenda&&!selectedAgenda)throw new Error('Pilih agenda yang sesuai tanggal, kegiatan, dan kelas.');
      const activity=matching.find(a=>a.id===form.activity_type_id);
      const payload=requiredAgenda?{agenda_id:selectedAgenda!.id}:{
        event_date:form.event_date,audience:form.audience,activity_type_id:form.activity_type_id||null,
        class_id:form.class_id||null,level_id:null,
        title:form.title.trim()||activity?.name||(form.audience==='CABERAWIT'?'Pembelajaran Caberawit':'Pengajian Kelompok'),
        teacher_name:form.teacher_name||null
      };
      const r=await fetch('/api/attendance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const j=await r.json();if(!r.ok)throw new Error(j.error||'Gagal membuka daftar.');
      await openEvent(j.id);
      window.history.replaceState(null,'','/presensi/buat?event_id='+j.id);
    }catch(e){setError(e instanceof Error?e.message:'Gagal membuka daftar.');}
    finally{setSaving(false);}
  }
  const count=(s:Status)=>Object.values(status).filter(v=>v===s).length;

  if(ready&&!allowed.length){
    return <>
      <div className="pageHeader"><div><h1>Buat Presensi</h1></div></div>
      <div className="notice scopeNotice"><div><strong>Akses hanya-baca</strong><span>Akun ini tidak diberi hak input presensi.</span></div></div>
    </>;
  }

  return <>
    {!embedded&&<div className="pageHeader"><div><h1>{eventId?'Edit Presensi':'Absensi Baru'}</h1></div></div>}
    {!eventId&&<section className="attendanceStartIntro"><div className="attendanceStartIcon"><span>01</span></div><div><h2>Mulai Absensi</h2></div></section>}
    <form onSubmit={e=>{if(eventId)e.preventDefault();else void save(e)}} className="section">
      {!eventId?<section className="card attendanceStartCard">
        <div className="attendanceSteps"><span>1. Tanggal</span><span>2. Kegiatan & kelas</span><span>3. Buka daftar</span><span>4. Tandai presensi</span></div>
        <div className="formGrid attendanceFormGrid">
          <label>1. Tanggal pertemuan<input className="input" type="date" required value={form.event_date} onChange={e=>setForm(v=>({...v,event_date:e.target.value,agenda_id:''}))}/></label>
          <label>2. Lingkup / kategori<select className="select" value={form.audience} onChange={e=>setForm(v=>({...v,audience:e.target.value as Audience,level_id:'',class_id:'',agenda_id:'',title:e.target.value==='KELOMPOK'?'Kegiatan Kelompok':'',activity_type_id:e.target.value==='KELOMPOK'?(activities.find(a=>a.audience==='KELOMPOK'&&a.name==='Pengajian Kelompok')?.id||''):''}))}>
            {allowed.map(v=><option key={v} value={v}>{audienceLabels[v]}</option>)}
          </select></label>
          {(form.audience==='CABERAWIT'||form.audience==='MUDA_MUDI')&&
             <label>Kelas<select className="select" required={form.audience==='CABERAWIT'} value={form.class_id} onChange={e=>setForm(v=>({...v,class_id:e.target.value,level_id:'',agenda_id:''}))}>
               <option value="">{form.audience==='CABERAWIT'?'Pilih kelas':'Semua kelas'}</option>
               {classOptions.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
             </select></label>}
          {routineAllowed&&form.audience!=='KELOMPOK'&&<div className="span2 attendanceRoutineChoice">
            <strong>Bagaimana membuka presensi?</strong>
            <div className="attendanceGenderTabs" role="group" aria-label="Sumber kegiatan">
              <button type="button" className={!useAgenda?'active':''} onClick={()=>setUseAgenda(false)}>Kegiatan rutin (tanpa agenda)</button>
              <button type="button" className={useAgenda?'active':''} onClick={()=>setUseAgenda(true)}>Dari agenda</button>
            </div>
            
          </div>}
          {!requiredAgenda&&form.audience!=='KELOMPOK'&&<label className="span2">Kegiatan rutin<select className="select" value={form.activity_type_id} onChange={e=>setForm(v=>({...v,activity_type_id:e.target.value,title:matching.find(a=>a.id===e.target.value)?.name||v.title}))}>
            <option value="">Kegiatan {form.audience==='CABERAWIT'?'Caberawit':'Kelompok'}</option>
            {matching.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select></label>}
          {requiredAgenda&&<label className="span2">3. Agenda / kegiatan yang akan diabsen<select className="select" required disabled={agendaLoading} value={form.agenda_id} onChange={e=>setForm(v=>({...v,agenda_id:e.target.value}))}>
             <option value="">{agendaLoading?'Memuat agenda…':'Pilih agenda yang tersedia'}</option>
             {matchingAgendas.map(a=><option key={a.id} value={a.id}>{a.title+' · '+new Date(a.starts_at).toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'})}{a.attendance_event_id?' · sudah ada presensi':''}</option>)}
          </select></label>}
        </div>
        {requiredAgenda&&(selectedAgenda?<div className="attendanceSelectedAgenda"><ClipboardCheck size={19}/><div><strong>{selectedAgenda.title}</strong><span>{new Date(selectedAgenda.starts_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})} · Peserta akan mengikuti data agenda.</span></div></div>:!agendaLoading&&<div className="attendanceAgendaHint"><strong>{matchingAgendas.length?'Pilih agenda di atas.':'Belum ada agenda sesuai pilihan.'}</strong><span>{matchingAgendas.length?'Data peserta mengikuti agenda yang kamu pilih.':'Buat agenda dengan tanggal, lingkup dan kelas yang sama terlebih dahulu.'}</span><a href="/agenda">Kelola agenda →</a></div>)}
        {!requiredAgenda&&<div className="attendanceSelectedAgenda"><ClipboardCheck size={19}/><div><strong>Siap membuat presensi rutin</strong></div></div>}
        <div className="attendanceStartActions"><button className="btn" disabled={saving||(requiredAgenda&&(!selectedAgenda||agendaLoading))} type="submit">{saving?'Membuka daftar…':requiredAgenda&&selectedAgenda?.attendance_event_id?'Buka absensi yang sudah ada':'Lanjut ke daftar peserta'} <span aria-hidden="true">→</span></button></div>
      </section>:<section className="card attendanceActiveHeader"><div><span className="attendanceEyebrow">Pertemuan aktif</span><h2>{form.title}</h2><p>{new Date(form.event_date+'T12:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · {audienceLabels[form.audience]}{classes.find(c=>c.id===form.class_id)?.name?' · '+classes.find(c=>c.id===form.class_id)?.name:''}</p></div><a href="/presensi?tab=riwayat" className="btn ghost">Kembali ke Riwayat</a></section>}

      {eventId&&<section className="section">
        <div className="cardHead"><div><h2>Peserta</h2><p>{displayedPeople.length} ditampilkan dari {people.length} orang</p></div><button type="button" className="btn ghost" onClick={allPresent}>Tandai yang tampil Hadir</button></div>
        {form.audience==='KELOMPOK'&&<div className="attendanceGenderTabs" role="group" aria-label="Tampilkan peserta kelompok">
          <button type="button" className={genderFilter==='ALL'?'active':''} onClick={()=>setGenderFilter('ALL')}>Semuanya</button>
          <button type="button" className={genderFilter==='L'?'active':''} onClick={()=>setGenderFilter('L')}>Laki-laki</button>
          <button type="button" className={genderFilter==='P'?'active':''} onClick={()=>setGenderFilter('P')}>Perempuan</button>
        </div>}
        {recovery.map(item=><div className="notice" key={item.key}>Ada perubahan belum tersimpan dari tab atau sesi lain. <button type="button" onClick={()=>recoverPending(item)}>Pulihkan perubahan</button></div>)}
        <input className="input" placeholder="Cari peserta" value={search} onChange={e=>setSearch(e.target.value)}/>
        {undo&&<button type="button" className="btn ghost" onClick={()=>{Object.entries(undo).forEach(([key,value])=>change(key,value));setUndo(null)}}>Urungkan Semua H</button>}
        <div className="list">
          {displayedPeople.map((p,index)=><div className="item" key={p.id}><div className="row between"><div><div className="itemTitle">{index+1}. {p.name}</div><div className="itemMeta">{p.meta} · {status[p.id]??'Belum diisi'}</div></div><div className="attendanceButtons">{(['H','I','A',null] as Status[]).map((value,i)=><button type="button" className={status[p.id]===value?'on':''} key={i} onClick={()=>change(p.id,{status:value,notes:notes[p.id]||''})}>{value??'Belum'}</button>)}</div></div>
            <input className="input" aria-label={`Keterangan ${p.name}`} placeholder="Keterangan (opsional)" maxLength={2000} value={notes[p.id]||''} onChange={e=>change(p.id,{status:status[p.id]??null,notes:e.target.value})}/>
            <div className="itemMeta">{sync[p.id]==='pending'?'Menunggu sinkronisasi…':sync[p.id]==='saving'?'Menyimpan…':sync[p.id]==='saved'?'Tersimpan':sync[p.id]==='error'?'Gagal sinkron; perubahan tetap di perangkat':sync[p.id]==='conflict'?'Konflik: peserta diubah pada perangkat lain':''}</div>
            {(sync[p.id]==='error'||sync[p.id]==='pending')&&<button type="button" className="btn" onClick={()=>queue.current?.retry(p.id)}>{sync[p.id]==='pending'?'Sinkronkan sekarang':'Coba lagi'}</button>}
            {conflicts[p.id]&&<div className="notice error">Data tersimpan: {conflicts[p.id].status??'Belum diisi'} · {conflicts[p.id].notes||'-'}<button type="button" onClick={()=>resolve(p.id,false)}>Gunakan data tersimpan</button><button type="button" onClick={()=>resolve(p.id,true)}>Simpan perubahan saya</button></div>}
            {!!audit[p.id]?.length&&<details><summary>Riwayat perubahan</summary>{audit[p.id].map((a:any)=><div key={a.id}>{a.changed_at} · {a.actor_name||'Petugas'} · {a.old_status??'Kosong'} → {a.new_status??'Kosong'} · {a.new_notes||'-'}</div>)}</details>}
          </div>)}
          {!people.length&&<div className="emptyState">Belum ada peserta pada daftar pertemuan ini.</div>}
        </div>
      </section>}

      {error&&<div className="notice error section">{error}</div>}
      {eventId&&<div className="stickyAction row between"><div><strong>{count('H')} H</strong><span> · {count('I')} I · {count('A')} A · {people.length-count('H')-count('I')-count('A')} belum diisi</span></div><span>{Object.values(sync).some(v=>v==='pending')?'Ada perubahan menunggu sinkronisasi':'Tersimpan otomatis'}</span></div>}
    </form>
  </>;
}
