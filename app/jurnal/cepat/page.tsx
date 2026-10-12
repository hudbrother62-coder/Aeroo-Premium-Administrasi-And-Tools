'use client';

import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {
  ArrowLeft,ArrowRight,BookOpenCheck,CalendarDays,Check,CheckCircle2,
  ChevronDown,ClipboardCheck,FileText,HelpCircle,Search,UsersRound,X
} from 'lucide-react';
import {jakartaDate} from '@/lib/domain';
import {writeScopesForRole,type Audience} from '@/lib/access';
import {teacherGuidance} from '@/app/target/targetGuidance';
import {eligibleForTarget,getAttendanceId,recordedAssessments} from './logic';
import './cepat.css';

type Group='CABERAWIT'|'MUDA_MUDI';
type Mode='CLASS'|'INDIVIDUAL';
type ClassRow={id:string;name:string;audience:string;level_id?:string|null};
type LevelRow={id:string;name:string};
type TargetRow={
  id:string;title:string;version_id?:string|null;level_id?:string|null;
  class_id?:string|null;target_month?:string|null;
  levels?:{name?:string}|null;
  source_metadata?:{subject?:string;aspect?:string;parent?:string};
};
type EventRow={id:string;title:string;event_date:string;audience:string;class_id?:string|null;level_id?:string|null;state?:string;agenda_id?:string|null};
type Attendee={participant_key?:string;member_id?:string;member_name_snapshot?:string;status?:string|null;level_id_snapshot?:string|null;class_id_snapshot?:string|null};
type EventDetail=EventRow&{attendance_records?:Attendee[];activity_type_id?:string|null};
type Assessment={value:string;note:string};

const programLabel:Record<Group,string>={CABERAWIT:'Caberawit',MUDA_MUDI:'Muda-Mudi'};
const kindLabel:Record<Mode,string>={CLASS:'Catat kegiatan',INDIVIDUAL:'Nilai anak'};
const scoreOptions=[
  {value:'',label:'Belum dinilai'},
  {value:'0',label:'0% — Belum bisa'},
  {value:'25',label:'25% — Masih dibimbing'},
  {value:'50',label:'50% — Mulai bisa'},
  {value:'75',label:'75% — Hampir mandiri'},
  {value:'100',label:'100% — Sudah bisa'},
];
function monthsMatch(target:TargetRow,date:string){return !target.target_month||target.target_month.slice(0,7)===date.slice(0,7);}
function safeDateLabel(date:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return date;return new Date(date+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});}

export default function EasyJournalPage(){
  const [step,setStep]=useState(1);
  const [group,setGroup]=useState<Group>('CABERAWIT');
  const [mode,setMode]=useState<Mode>('CLASS');
  const [classes,setClasses]=useState<ClassRow[]>([]);
  const [levels,setLevels]=useState<LevelRow[]>([]);
  const [targets,setTargets]=useState<TargetRow[]>([]);
  const [versions,setVersions]=useState<Array<{id:string;title:string}>>([]);
  const [events,setEvents]=useState<EventRow[]>([]);
  const [scopes,setScopes]=useState<Audience[]>([]);
  const [roleLoaded,setRoleLoaded]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busyEvent,setBusyEvent]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [successId,setSuccessId]=useState('');

  const [eventId,setEventId]=useState('');
  const [event,setEvent]=useState<EventDetail|null>(null);
  const [classId,setClassId]=useState('');
  const [levelId,setLevelId]=useState('');
  const [date,setDate]=useState(jakartaDate());
  const [selectedTarget,setSelectedTarget]=useState('');
  const [search,setSearch]=useState('');
  const [notes,setNotes]=useState('');
  const [followUp,setFollowUp]=useState('');
  const [scores,setScores]=useState<Record<string,Assessment>>({});
  const [showHelp,setShowHelp]=useState(false);
  const targetFromLink=useRef('');

  useEffect(()=>{
    let mounted=true;
    Promise.allSettled([
      fetch('/api/auth/me').then(r=>r.json()),
      fetch('/api/classes').then(r=>r.json()),
      fetch('/api/levels').then(r=>r.json()),
      fetch('/api/targets').then(r=>r.json()),
      fetch('/api/attendance').then(r=>r.json()),
      fetch('/api/targets/import').then(r=>r.json())
    ]).then(results=>{
      if(!mounted)return;
      const unpack=(i:number)=>results[i].status==='fulfilled'?(results[i] as PromiseFulfilledResult<any>).value:null;
      const user=unpack(0);
      const permitted=Array.isArray(user?.write_scopes)?user.write_scopes:writeScopesForRole(user?.role||'VIEWER');
      const approved=permitted.filter((g:string)=>g==='CABERAWIT'||g==='MUDA_MUDI') as Audience[];
      setScopes(approved);setRoleLoaded(true);
      setClasses(Array.isArray(unpack(1))?unpack(1):[]);
      setLevels(Array.isArray(unpack(2))?unpack(2):[]);
      setTargets(Array.isArray(unpack(3))?unpack(3):[]);
      setEvents(Array.isArray(unpack(4))?unpack(4):[]);
      setVersions(Array.isArray(unpack(5))?unpack(5):[]);
      setGroup(g=>approved.includes(g)?g:approved.includes('MUDA_MUDI')?'MUDA_MUDI':'CABERAWIT');
      const q=new URLSearchParams(window.location.search);
      targetFromLink.current=q.get('target_id')||'';
      const requestedGroup=q.get('audience');
      if((requestedGroup==='CABERAWIT'||requestedGroup==='MUDA_MUDI')&&approved.includes(requestedGroup))setGroup(requestedGroup);
      if(q.get('mode')==='score')setMode('INDIVIDUAL');
      const preset=q.get('event_id');
      if(preset)setEventId(preset);
      setLoading(false);
    }).catch(()=>{if(mounted){setError('Data awal tidak dapat dimuat.');setLoading(false)}});
    return()=>{mounted=false};
  },[]);

  useEffect(()=>{
    if(!eventId){setEvent(null);setBusyEvent(false);return;}
    const controller=new AbortController();
    setBusyEvent(true);setError('');
    fetch('/api/attendance/'+encodeURIComponent(eventId),{signal:controller.signal})
      .then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error||'Pertemuan gagal dibuka.');return v as EventDetail})
      .then(v=>{
        if(controller.signal.aborted)return;
        if(v.audience!==group){setError('Pertemuan tidak cocok dengan kelompok yang dipilih.');setEvent(null);return;}
        setEvent(v);setDate(v.event_date);setClassId(v.class_id||'');
        setLevelId(v.level_id||classes.find(c=>c.id===v.class_id)?.level_id||'');
        setSelectedTarget('');setSearch('');setScores({});
      })
      .catch(e=>{if(!controller.signal.aborted){setEvent(null);setError(e instanceof Error?e.message:'Pertemuan tidak dapat dibuka.')}})
      .finally(()=>{if(!controller.signal.aborted)setBusyEvent(false)});
    return()=>controller.abort();
  },[eventId,group,classes]);

  const canWrite=roleLoaded&&scopes.includes(group);
  const myClasses=classes.filter(c=>c.audience===group);
  const myEvents=events.filter(e=>e.audience===group&&e.state!=='CANCELLED')
    .sort((a,b)=>b.event_date.localeCompare(a.event_date)).slice(0,200);
  const targetLevel=event?.level_id||levelId||myClasses.find(c=>c.id===classId)?.level_id||'';
  const versionId=versions[0]?.id;
  const availableTargets=useMemo(()=>targets
    .filter(t=>(!versionId||t.version_id===versionId)&&
      monthsMatch(t,date)&&
      (group==='MUDA_MUDI'?t.levels?.name==='Remaja':t.levels?.name!=='Remaja')&&
      (!targetLevel||!t.level_id||t.level_id===targetLevel)&&
      (!classId||!t.class_id||t.class_id===classId))
    .sort((a,b)=>(a.source_metadata?.subject||'').localeCompare(b.source_metadata?.subject||'','id')||a.title.localeCompare(b.title,'id')),
    [targets,versionId,group,targetLevel,classId,date]);
  useEffect(()=>{
    if(!targetLevel||!targetFromLink.current)return;
    const linked=availableTargets.find(t=>t.id===targetFromLink.current);
    if(linked){setSelectedTarget(linked.id);targetFromLink.current='';}
  },[targetLevel,availableTargets]);
  const chosen=availableTargets.find(t=>t.id===selectedTarget)||null;
  const searchResult=availableTargets.filter(t=>!search.trim()||
    [t.title,t.source_metadata?.subject,t.source_metadata?.aspect,t.source_metadata?.parent]
      .some(p=>(p||'').toLocaleLowerCase('id-ID').includes(search.trim().toLocaleLowerCase('id-ID')))).slice(0,80);
  const present=(event?.attendance_records||[]).filter(p=>p.status==='H'&&Boolean(getAttendanceId(p)));
  const assessable=chosen?present.filter(p=>eligibleForTarget(p,chosen)):[];
  const savedRows=chosen?recordedAssessments(assessable,scores,chosen.id):[];
  const hints=chosen?teacherGuidance({title:chosen.title,subject:chosen.source_metadata?.subject,parent:chosen.source_metadata?.parent,level:chosen.levels?.name}):null;

  function resetGroup(next:Group){setGroup(next);setEventId('');setEvent(null);setClassId('');setLevelId('');setSelectedTarget('');setScores({});setError('')}
  function updateClass(next:string){setClassId(next);setLevelId(myClasses.find(c=>c.id===next)?.level_id||'');setEventId('');setEvent(null);setSelectedTarget('');setScores({})}
  function updateScore(id:string,value:string){setScores(old=>({...old,[id]:{value,note:old[id]?.note||''}}))}
  function updateNote(id:string,note:string){setScores(old=>({...old,[id]:{value:old[id]?.value||'',note}}))}
  function showStepTwo(){
    if(!canWrite){setError('Akun ini belum memiliki izin mengisi jurnal untuk program tersebut.');return;}
    setError('');setStep(2);
  }
  function showStepThree(){
    if(mode==='INDIVIDUAL'&&(!event||busyEvent)){setError('Pilih pertemuan yang sudah mempunyai presensi terlebih dahulu.');return;}
    if(mode==='CLASS'&&!classId){setError('Pilih kelas terlebih dahulu.');return;}
    if(!targetLevel){setError('Pilih jenjang pembelajaran agar target sesuai kelas.');return;}
    if(!chosen){setError('Pilih satu target pembelajaran terlebih dahulu.');return;}
    if(mode==='INDIVIDUAL'&&!assessable.length){setError('Tidak ada peserta hadir yang sesuai dengan jenjang target ini. Periksa presensi dan kelas peserta.');return;}
    setError('');setStep(3);
  }

  async function save(){
    if(!chosen||!canWrite||saving)return;
    if(mode==='INDIVIDUAL'&&!event){setError('Pertemuan presensi wajib dipilih.');return;}
    if(mode==='INDIVIDUAL'&&!savedRows.length){setError('Pilih nilai setidaknya untuk satu anak, atau gunakan “Catat kegiatan” bila belum ada penilaian.');return;}
    setSaving(true);setError('');
    try{
      const kind=group+'_'+mode;
      const count=savedRows.length;
      const title=(mode==='CLASS'?'Pembelajaran: ':'Penilaian: ')+chosen.title;
      const progress=mode==='INDIVIDUAL'?savedRows:[];
      const body={
        journal_kind:kind,journal_date:date,title,activity_type_id:event?.activity_type_id||null,
        class_id:classId||null,member_id:null,event_id:event?.id||null,agenda_id:event?.agenda_id||null,
        material:chosen.title,summary:notes.trim(),follow_up:followUp.trim(),
        assessment:{
          materials:[{topic:chosen.title,status:'SEBAGIAN',page:'',note:''}],
          class_assessment:mode==='CLASS'?{
            target_id:chosen.id,target_title:chosen.title,level_id:targetLevel,
            achievement:'',observation:notes.trim(),obstacles:'',improvement_plan:followUp.trim(),follow_up:followUp.trim()
          }:null,
          quick_entry:true,assessed_count:count
        },
        state:'COMPLETED',revision:0,progress
      };
      const response=await fetch('/api/journals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const result=await response.json();
      if(!response.ok)throw Error(result.error||'Gagal menyimpan. Periksa kelas, presensi, dan target.');
      if(!result.id)throw Error('Server belum mengembalikan nomor jurnal. Periksa Riwayat Jurnal sebelum mengirim ulang.');
      setSuccessId(result.id);setStep(4);
    }catch(e){setError(e instanceof Error?e.message:'Jurnal gagal disimpan.')}
    finally{setSaving(false);}
  }

  if(loading)return <main className="ej-shell"><div className="ej-loading">Memuat formulir mudah…</div></main>;

  return <main className="ej-shell">
    <div className="ej-heading">
      <Link href="/jurnal" className="ej-back"><ArrowLeft size={17}/> Kembali ke Jurnal</Link>
      <div className="ej-heading-top">
        <div><div className="ej-eyebrow"><BookOpenCheck size={16}/> MODE MUDAH</div>
          <h1>{step===4?'Jurnal berhasil disimpan':'Isi Jurnal & Nilai Anak'}</h1>
          <p>Cukup pilih kegiatan, tentukan materi, lalu catat hasilnya. Semua akan tersimpan di jurnal yang sama.</p>
        </div>
        <Link className="ej-advanced" href="/jurnal/buat">Formulir lengkap <ArrowRight size={15}/></Link>
      </div>
    </div>

    <ol className="ej-steps" aria-label="Tahapan mengisi jurnal">
      {['Kegiatan','Target','Hasil','Selesai'].map((label,index)=><li key={label} className={step===index+1?'current':step>index+1?'finished':''}>
        <span>{step>index+1?<Check size={16}/>:index+1}</span><strong>{label}</strong>
      </li>)}
    </ol>
    {error&&<div className="ej-alert" role="alert">{error}<button type="button" aria-label="Tutup peringatan" onClick={()=>setError('')}><X size={16}/></button></div>}

    {step===1&&<section className="ej-panel">
      <div className="ej-section-heading"><span className="ej-kicker">LANGKAH 1 DARI 3</span><h2>Mau mencatat apa hari ini?</h2><p>Pilih sesuai kegiatan yang sedang dilakukan.</p></div>
      <label className="ej-label">Program pembelajaran</label>
      <div className="ej-segment">
        {(['CABERAWIT','MUDA_MUDI'] as const).map(g=><button type="button" key={g} disabled={!scopes.includes(g)} className={group===g?'active':''} onClick={()=>resetGroup(g)}>{programLabel[g]}{!scopes.includes(g)&&<small> Tidak ada akses</small>}</button>)}
      </div>
      <div className="ej-choice-list">
        <button type="button" className={mode==='CLASS'?'selected':''} onClick={()=>setMode('CLASS')}>
          <span className="ej-choice-icon"><BookOpenCheck size={24}/></span>
          <span><strong>Catat kegiatan kelas</strong><small>Materi yang diajarkan, hasil kegiatan, dan catatan guru. Belum memberi nilai anak.</small></span>
          <CheckCircle2 size={22} className="ej-choice-check"/>
        </button>
        <button type="button" className={mode==='INDIVIDUAL'?'selected':''} onClick={()=>setMode('INDIVIDUAL')}>
          <span className="ej-choice-icon"><UsersRound size={24}/></span>
          <span><strong>Nilai anak sekaligus</strong><small>Satu pertemuan, satu target, pilih nilai untuk beberapa anak yang hadir.</small></span>
          <CheckCircle2 size={22} className="ej-choice-check"/>
        </button>
      </div>
      <div className="ej-info"><HelpCircle size={17}/><p>Memilih “Nilai anak” tidak membuat nilai otomatis. Guru tetap menentukan siapa yang sudah diamati dan diberi nilai.</p></div>
      <div className="ej-actions"><span/><button className="ej-primary" onClick={showStepTwo} disabled={!canWrite}>Lanjut pilih kegiatan <ArrowRight size={18}/></button></div>
    </section>}

    {step===2&&<section className="ej-panel">
      <div className="ej-section-heading"><span className="ej-kicker">LANGKAH 2 DARI 3</span>
        <h2>Pilih pertemuan dan target</h2>
        <p>Target yang ditampilkan disesuaikan dengan jenjang dan kelas, supaya guru tidak perlu mencari dari semua materi.</p></div>
      <div className="ej-fields">
        <label className="ej-field">Pertemuan presensi {mode==='INDIVIDUAL'?'(wajib)':'(jika ada)'}
          <select value={eventId} onChange={e=>{setEventId(e.target.value);setSelectedTarget('');setScores({})}}>
            <option value="">{mode==='INDIVIDUAL'?'Pilih pertemuan yang sudah diabsen':'Tidak ada / catat tanpa presensi'}</option>
            {myEvents.map(e=><option value={e.id} key={e.id}>{safeDateLabel(e.event_date)} · {e.title}</option>)}
          </select>
          <small>{busyEvent?'Mengambil daftar peserta…':mode==='INDIVIDUAL'?'Hanya anak berstatus Hadir yang dapat dinilai.':'Pilih pertemuan untuk mengisi tanggal dan kelas otomatis.'}</small>
        </label>
        {!eventId&&<label className="ej-field">Kelas
          <select value={classId} onChange={e=>updateClass(e.target.value)}><option value="">Pilih kelas</option>
            {myClasses.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
          </select>
        </label>}
        {eventId&&event&&<div className="ej-selected-meeting"><CheckCircle2 size={18}/><span><strong>{event.title}</strong><small>{safeDateLabel(event.event_date)} · {present.length} peserta hadir</small></span></div>}
        {!targetLevel&&<label className="ej-field">Jenjang
          <select value={levelId} onChange={e=>{setLevelId(e.target.value);setSelectedTarget('')}}><option value="">Pilih jenjang</option>
            {levels.filter(l=>group==='MUDA_MUDI'?l.name==='Remaja':l.name!=='Remaja').map(l=><option value={l.id} key={l.id}>{l.name}</option>)}
          </select>
        </label>}
        <label className="ej-field">Tanggal jurnal
          <input type="date" value={date} disabled={!!event} onChange={e=>{setDate(e.target.value);setSelectedTarget('')}}/>
        </label>
      </div>
      {mode==='INDIVIDUAL'&&!myEvents.length&&<div className="ej-info"><ClipboardCheck size={18}/><p>Belum ada pertemuan yang dapat dipilih. <Link href="/presensi">Isi presensi terlebih dahulu</Link>, lalu kembali ke halaman ini.</p></div>}
      <div className="ej-target-picker">
        <div className="ej-target-heading"><label className="ej-label" htmlFor="ej-search">Target yang dipelajari</label><small>{availableTargets.length} target sesuai kelas dan jenjang</small></div>
        <div className="ej-search"><Search size={18}/><input id="ej-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ketik nama materi, misalnya doa atau tata krama"/></div>
        <div className="ej-target-results" role="group" aria-label="Pilih satu target">
          {searchResult.map(t=><button type="button" key={t.id} className={selectedTarget===t.id?'chosen':''} onClick={()=>{setSelectedTarget(t.id);setScores({})}}>
            <span><strong>{t.title}</strong><small>{t.source_metadata?.subject||t.source_metadata?.aspect||'Target pembelajaran'}</small></span>
            <span className="ej-target-radio">{selectedTarget===t.id&&<Check size={16}/>}</span>
          </button>)}
          {!searchResult.length&&<div className="ej-empty">Tidak ada target yang cocok. Periksa jenjang atau kata kunci.</div>}
        </div>
        {availableTargets.length>80&&!search&&<small className="ej-search-hint">Menampilkan 80 target pertama. Ketik nama materi di atas untuk mencari yang lainnya.</small>}
        {chosen&&hints&&<details className="ej-tip"><summary><HelpCircle size={17}/> Lihat panduan singkat mengajar <ChevronDown size={16}/></summary>
          <div><p><strong>Gambaran:</strong> {hints.focus}</p><p><strong>Contoh kegiatan:</strong> {hints.activity}</p><p><strong>Amati:</strong> {hints.evidence}</p></div>
        </details>}
      </div>
      <div className="ej-actions"><button type="button" className="ej-back-btn" onClick={()=>{setStep(1);setError('')}}>Kembali</button>
        <button type="button" className="ej-primary" disabled={busyEvent} onClick={showStepThree}>Lanjut isi hasil <ArrowRight size={18}/></button></div>
    </section>}

    {step===3&&<section className="ej-panel">
      <div className="ej-section-heading"><span className="ej-kicker">LANGKAH 3 DARI 3</span><h2>{mode==='CLASS'?'Bagaimana kegiatan hari ini?':'Siapa yang sudah dinilai?'}</h2>
        <p>{mode==='CLASS'?'Catat singkat saja. Tidak perlu menulis laporan panjang.':'Pilih nilai untuk anak yang sudah diamati. Tidak perlu mengisi semua anak sekaligus.'}</p></div>
      <div className="ej-selection-summary">
        <BookOpenCheck size={20}/><div><strong>{chosen?.title}</strong><span>{programLabel[group]} · {safeDateLabel(date)} · {myClasses.find(c=>c.id===classId)?.name||'Pertemuan terpilih'}</span></div>
        <button type="button" onClick={()=>setStep(2)}>Ubah</button>
      </div>
      {mode==='INDIVIDUAL'&&<>
        <div className="ej-score-heading"><h3>Peserta hadir yang sesuai target</h3><span>{savedRows.length} dari {assessable.length} dinilai</span></div>
        <div className="ej-score-list">{assessable.map((p,i)=>{
          const id=getAttendanceId(p),answer=scores[id]||{value:'',note:''};
          return <div className="ej-score-row" key={id}>
            <div className="ej-score-row-top"><span className="ej-person-number">{i+1}</span><strong>{p.member_name_snapshot||'Peserta '+(i+1)}</strong>
              <span className={answer.value===''?'ej-not-scored':'ej-scored'}>{answer.value===''?'Belum dinilai':answer.value+'%'}</span>
            </div>
            <label className="ej-field">Nilai perkembangan
              <select aria-label={'Nilai perkembangan '+(p.member_name_snapshot||'peserta')} value={answer.value} onChange={e=>updateScore(id,e.target.value)}>
                {scoreOptions.map(opt=><option value={opt.value} key={opt.value}>{opt.label}</option>)}
              </select>
            </label>
            {answer.value!==''&&<details className="ej-note"><summary>Tambah catatan anak (opsional) <ChevronDown size={15}/></summary>
              <textarea aria-label={'Catatan '+(p.member_name_snapshot||'peserta')} rows={2} value={answer.note} onChange={e=>updateNote(id,e.target.value)} placeholder="Contoh: sudah hafal bagian awal, perlu mengulang bagian akhir"/>
            </details>}
          </div>;
        })}</div>
        <div className="ej-info"><HelpCircle size={17}/><p>Angka adalah tingkat penguasaan target, bukan nilai kehadiran. Anak yang belum dinilai tetap kosong dan tidak dianggap mendapat nilai 0.</p></div>
      </>}
      <label className="ej-field ej-wide">{mode==='CLASS'?'Catatan kegiatan (opsional)':'Catatan umum guru (opsional)'}
        <textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder={mode==='CLASS'?'Apa yang sudah diajarkan? Apa hasilnya?':'Catatan singkat tentang pembelajaran hari ini'}/>
      </label>
      <label className="ej-field ej-wide">Rencana pertemuan berikutnya (opsional)
        <textarea rows={2} value={followUp} onChange={e=>setFollowUp(e.target.value)} placeholder="Contoh: mengulang materi yang belum lancar"/>
      </label>
      <div className="ej-confirm">
        <CheckCircle2 size={20}/><div><strong>Siap disimpan sebagai jurnal selesai</strong>
        <p>Materi dan catatan tersimpan di jurnal. {mode==='INDIVIDUAL'?'Nilai peserta yang dipilih akan terhubung dengan target dan laporan progres.':'Tidak ada nilai individu yang diisi otomatis.'}</p></div>
      </div>
      <div className="ej-actions"><button type="button" className="ej-back-btn" disabled={saving} onClick={()=>setStep(2)}>Kembali</button>
        <button type="button" className="ej-primary" disabled={saving||!canWrite} onClick={()=>void save()}>{saving?'Menyimpan…':'Simpan jurnal'} <Check size={19}/></button></div>
    </section>}

    {step===4&&<section className="ej-panel ej-success">
      <div className="ej-success-mark"><CheckCircle2 size={38}/></div>
      <h2>Berhasil! Jurnal sudah tersimpan.</h2>
      <p>Semua data ada dalam Riwayat Jurnal. {mode==='INDIVIDUAL'?'Nilai yang diisi ikut masuk sebagai sumber progres tiap anak.':'Kegiatan kelas tersimpan tanpa memberi nilai otomatis kepada anak.'}</p>
      <div className="ej-success-actions"><Link className="ej-primary" href={'/jurnal/buat?journal_id='+encodeURIComponent(successId)}>Lihat jurnal <ArrowRight size={17}/></Link>
        <Link className="ej-back-btn" href="/jurnal/riwayat">Riwayat jurnal</Link>
        <Link className="ej-back-btn" href="/target?tab=progress">Lihat progres</Link></div>
      <button type="button" className="ej-again" onClick={()=>{setStep(1);setSuccessId('');setNotes('');setFollowUp('');setScores({});setSelectedTarget('');setSearch('');setError('')}}>+ Isi jurnal lainnya</button>
    </section>}
    <div className="ej-footer-tip"><HelpCircle size={15}/> Butuh kolom lengkap atau mengedit jurnal lama? Gunakan <Link href="/jurnal/buat">formulir lengkap</Link>. <button type="button" onClick={()=>setShowHelp(v=>!v)}>{showHelp?'Tutup bantuan':'Cara menggunakan'}</button></div>
    {showHelp&&<div className="ej-help"><strong>Cara menggunakan</strong><p>1. Pilih “Catat kegiatan” atau “Nilai anak”. 2. Pilih pertemuan dan target. 3. Tulis hasilnya atau beri nilai peserta yang hadir. 4. Simpan. Untuk menilai anak, buat presensi dahulu. Tidak ada nilai yang diberikan otomatis.</p></div>}
  </main>;
}
