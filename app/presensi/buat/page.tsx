'use client';

import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import {audienceLabels,writeScopesForRole,type Audience,type Role} from '@/lib/access';
import {jakartaDate} from '@/lib/domain';

type Activity={id:string;name:string;audience:string};
type Level={id:string;name:string};
type ClassRow={id:string;name:string;audience:string;level_id?:string};
type Participant={id:string;name:string;type:'member';meta:string};
import {AttendanceSaveQueue,attendancePendingKey,persistAttendancePending,moveAttendancePending,type AttendanceStatus,type AttendanceRow,type AttendanceValue} from '@/lib/attendance-save';
type Status=AttendanceStatus;

export default function Page(){
  const[activities,setActivities]=useState<Activity[]>([]);
  const[levels,setLevels]=useState<Level[]>([]);
  const[classes,setClasses]=useState<ClassRow[]>([]);
  const[role,setRole]=useState<Role|null>(null);const[scopedWrite,setScopedWrite]=useState<Audience[]|null>(null);
  const[ready,setReady]=useState(false);
  const[people,setPeople]=useState<Participant[]>([]);
  const[status,setStatus]=useState<Record<string,Status>>({});
  const[saving,setSaving]=useState(false);
  const[eventId,setEventId]=useState('');const[recovery,setRecovery]=useState<Array<{key:string;pending:any}>>([]);const[notes,setNotes]=useState<Record<string,string>>({});const[sync,setSync]=useState<Record<string,string>>({});const[conflicts,setConflicts]=useState<Record<string,AttendanceRow>>({});const[search,setSearch]=useState('');const[audit,setAudit]=useState<Record<string,any[]>>({});const[undo,setUndo]=useState<Record<string,AttendanceValue>|null>(null);const queue=useRef<AttendanceSaveQueue|null>(null);const statusRef=useRef(status);const notesRef=useRef(notes);statusRef.current=status;notesRef.current=notes;
  const[error,setError]=useState('');
  const today=jakartaDate();
  const[form,setForm]=useState({title:'',event_date:today,event_time:'',audience:'KELOMPOK' as Audience,activity_type_id:'',level_id:'',class_id:'',notes:''});

  const allowed=useMemo(()=>scopedWrite??writeScopesForRole(role),[role,scopedWrite]);

  useEffect(()=>{
    Promise.all([
      fetch('/api/activity-types').then(r=>r.json()),
      fetch('/api/levels').then(r=>r.json()),
      fetch('/api/classes').then(r=>r.json()),
      fetch('/api/auth/me').then(r=>r.json())
    ]).then(([a,l,c,u])=>{
      setActivities(Array.isArray(a)?a:[]);
      setLevels(Array.isArray(l)?l:[]);
      setClasses(Array.isArray(c)?c:[]);
      const nextRole=(u.role??'VIEWER') as Role;
      setRole(nextRole);setScopedWrite(Array.isArray(u.write_scopes)?u.write_scopes:null);
      const scopes=Array.isArray(u.write_scopes)?u.write_scopes:writeScopesForRole(nextRole);
      if(scopes.length)setForm(v=>({...v,audience:scopes[0]}));
      setReady(true);
    }).catch(()=>{setError('Akses presensi belum dapat dimuat.');setReady(true)});
  },[]);

  async function openEvent(id:string){
    const response=await fetch('/api/attendance/'+id);const event=await response.json();if(!response.ok)throw new Error(event.error||'Daftar belum dapat dimuat.');
    setEventId(id);setForm({title:event.title,event_date:event.event_date,event_time:event.event_time||'',audience:event.audience,activity_type_id:event.activity_type_id||'',level_id:event.level_id||'',class_id:event.class_id||'',notes:event.notes||''});
    const rows=event.attendance_records||[];setPeople(rows.map((r:any)=>({id:r.participant_key,name:r.member_name_snapshot||'Peserta',type:'member',meta:[r.class_name_snapshot,r.level_name_snapshot].filter(Boolean).join(' · ')})));setStatus(Object.fromEntries(rows.map((r:any)=>[r.participant_key,r.status])));setNotes(Object.fromEntries(rows.map((r:any)=>[r.participant_key,r.notes||''])));setAudit(Object.fromEntries(rows.map((r:any)=>[r.participant_key,r.attendance_changes||[]])));
    const writerId=crypto.randomUUID();const marker='attendance-writer:'+id;const priorWriter=sessionStorage.getItem(marker);sessionStorage.setItem(marker,writerId);const storageKey=attendancePendingKey(id,writerId);const priorKey=priorWriter?attendancePendingKey(id,priorWriter):'attendance-pending:'+id;const nextQueue=new AttendanceSaveQueue(async(key,value,revision)=>{const r=await fetch('/api/attendance/'+id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({participant_key:key,revision,...value})});const data=await r.json();if(!r.ok&&r.status!==409)throw new Error(data.error);return data},(key,state,record)=>{setSync(v=>({...v,[key]:state}));if(state==='conflict'&&record)setConflicts(v=>({...v,[key]:record}));if(state==='saved'&&record){setStatus(v=>({...v,[key]:record.status}));setNotes(v=>({...v,[key]:record.notes||''}))}},pending=>{try{persistAttendancePending(localStorage,storageKey,pending)}catch{setError('Perubahan belum dapat disimpan di perangkat. Jangan tutup halaman.')}},()=>navigator.onLine);
    rows.forEach((r:any)=>nextQueue.seed(r.participant_key,{status:r.status,notes:r.notes||'',revision:r.revision??0}));queue.current=nextQueue;setSync({});setConflicts({});
    try{const pending=moveAttendancePending(localStorage,priorKey,storageKey);for(const key of Object.keys(pending)){if(!rows.some((r:any)=>r.participant_key===key))continue;const recoveredRevision=pending[key].revision;if(typeof recoveredRevision==='number'&&Number.isInteger(recoveredRevision))nextQueue.seed(key,{status:pending[key].status,notes:pending[key].notes||'',revision:recoveredRevision});setStatus(v=>({...v,[key]:pending[key].status}));setNotes(v=>({...v,[key]:pending[key].notes||''}));nextQueue.enqueue(key,pending[key])}const foreign=Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter((key):key is string=>!!key&&key.startsWith('attendance-pending:'+id+':')&&key!==storageKey);setRecovery(foreign.map(key=>({key,pending:JSON.parse(localStorage.getItem(key)||'{}')})))}catch{setError('Perubahan perangkat tidak dapat dimuat.')}
  }
  useEffect(()=>{if(!ready)return;const q=new URLSearchParams(window.location.search);const id=q.get('event_id');const agenda=q.get('agenda_id');if(id)void openEvent(id).catch(e=>setError(e.message));else if(agenda)void fetch('/api/attendance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({agenda_id:agenda})}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error);await openEvent(data.id)}).catch(e=>setError(e.message))},[ready]);
  useEffect(()=>{const retry=()=>queue.current?.retry();window.addEventListener('online',retry);return()=>window.removeEventListener('online',retry)},[]);
  function change(key:string,value:AttendanceValue){setStatus(v=>({...v,[key]:value.status}));setNotes(v=>({...v,[key]:value.notes}));queue.current?.enqueue(key,value)}
  function recoverPending(item:{key:string;pending:any}){for(const [key,value] of Object.entries(item.pending) as Array<[string,any]>){if(!people.some(p=>p.id===key))continue;if(Number.isInteger(value.revision))queue.current?.seed(key,{...value,revision:value.revision});change(key,value)}setRecovery(v=>v.filter(x=>x.key!==item.key))}
  function allPresent(){const pending=people.filter(p=>statusRef.current[p.id]==null);if(!pending.length)return;const previous=Object.fromEntries(pending.map(p=>[p.id,{status:statusRef.current[p.id]??null,notes:notesRef.current[p.id]||''}]));setUndo(previous);pending.forEach(p=>change(p.id,{status:'H',notes:notesRef.current[p.id]||''}))}
  function resolve(key:string,keep:boolean){const server=conflicts[key];queue.current?.resolve(key,server,keep);setConflicts(v=>{const next={...v};delete next[key];return next})}

  useEffect(()=>{
    if(form.audience==='PENGURUS'){
      const mus=activities.find(a=>a.audience==='PENGURUS'&&a.name.toLowerCase().includes('musyawarah'));
      if(mus)setForm(v=>({...v,activity_type_id:mus.id,title:v.title||'Musyawarah Pengurus'}));
    }
  },[form.audience,activities]);

  const matching=useMemo(()=>activities.filter(a=>a.audience===form.audience||a.audience==='CUSTOM'),[activities,form.audience]);
  const classOptions=useMemo(()=>classes.filter(c=>c.audience===form.audience),[classes,form.audience]);

  async function save(e:FormEvent){
    e.preventDefault();setSaving(true);setError('');try{const payload={...form,event_time:form.event_time||null,activity_type_id:form.activity_type_id||null,level_id:form.level_id||null,class_id:form.class_id||null,notes:form.notes||null};const r=await fetch('/api/attendance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const j=await r.json();if(!r.ok)throw new Error(j.error||'Gagal membuka daftar.');await openEvent(j.id);window.history.replaceState(null,'','/presensi/buat?event_id='+j.id)}catch(e){setError(e instanceof Error?e.message:'Gagal membuka daftar.')}finally{setSaving(false)}
  }
  const count=(s:Status)=>Object.values(status).filter(v=>v===s).length;

  if(ready&&!allowed.length){
    return <>
      <div className="pageHeader"><div><h1>Buat Presensi</h1></div></div>
      <div className="notice scopeNotice"><div><strong>Akses hanya-baca</strong><span>Akun ini tidak diberi hak input presensi.</span></div></div>
    </>;
  }

  return <>
    <div className="pageHeader"><h1>Presensi</h1></div>
    {role&&<div className="chips scopeChips">{allowed.map(a=><span className="chip" key={a}>{audienceLabels[a]}</span>)}</div>}
    <form onSubmit={e=>{if(eventId)e.preventDefault();else void save(e)}} className="section">
      <section className="card"><fieldset disabled={!!eventId} style={{border:0,padding:0,margin:0}}>
        <div className="formGrid">
          <label>Tanggal<input className="input" type="date" required value={form.event_date} onChange={e=>setForm({...form,event_date:e.target.value})}/></label>
          <label>Lingkup<select className="select" value={form.audience} onChange={e=>setForm({...form,audience:e.target.value as Audience,activity_type_id:'',level_id:'',class_id:''})}>
            {allowed.map(v=><option key={v} value={v}>{audienceLabels[v]}</option>)}
          </select></label>

          {(form.audience==='CABERAWIT'||form.audience==='MUDA_MUDI')&&<>
            <label>Jenjang<select className="select" value={form.level_id} onChange={e=>setForm({...form,level_id:e.target.value,class_id:''})}>
              <option value="">Semua jenjang</option>{levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
            </select></label>
            <label>Kelas<select className="select" value={form.class_id} onChange={e=>setForm({...form,class_id:e.target.value})}>
              <option value="">Semua kelas</option>{classOptions.filter(c=>!form.level_id||!c.level_id||c.level_id===form.level_id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
          </>}

          <label>Judul kegiatan<input className="input" required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
          <label>Jam<input className="input" type="time" value={form.event_time} onChange={e=>setForm({...form,event_time:e.target.value})}/></label>
          <label className="span2">Jenis kegiatan<select className="select" value={form.activity_type_id} onChange={e=>setForm({...form,activity_type_id:e.target.value})}>
            <option value="">Pilih</option>{matching.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}
          </select></label>
        </div>
      </fieldset>{!eventId&&<button className="btn section" disabled={saving}>{saving?'Membuka…':'Buka daftar'}</button>}</section>

      {eventId&&<section className="section">
        <div className="cardHead"><div><h2>Peserta</h2><p>{people.length} orang</p></div><button type="button" className="btn ghost" onClick={allPresent}>Semua Hadir</button></div>
        {recovery.map(item=><div className="notice" key={item.key}>Ada perubahan belum tersimpan dari tab atau sesi lain. <button type="button" onClick={()=>recoverPending(item)}>Pulihkan perubahan</button></div>)}
        <input className="input" placeholder="Cari peserta" value={search} onChange={e=>setSearch(e.target.value)}/>
        {undo&&<button type="button" className="btn ghost" onClick={()=>{Object.entries(undo).forEach(([key,value])=>change(key,value));setUndo(null)}}>Urungkan Semua H</button>}
        <div className="list">
          {people.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())).map(p=><div className="item" key={p.id}><div className="row between"><div><div className="itemTitle">{p.name}</div><div className="itemMeta">{p.meta} · {status[p.id]??'Belum diisi'}</div></div><div className="attendanceButtons">{(['H','I','A',null] as Status[]).map((value,i)=><button type="button" className={status[p.id]===value?'on':''} key={i} onClick={()=>change(p.id,{status:value,notes:notes[p.id]||''})}>{value??'Belum'}</button>)}</div></div>
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
