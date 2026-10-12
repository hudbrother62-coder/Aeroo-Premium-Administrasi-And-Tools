'use client';

import Link from 'next/link';
import {writeScopesForRole,audienceLabels,type Audience} from '@/lib/access';
import {jakartaDate,slugByAudience} from '@/lib/domain';
import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import {CalendarPlus,ChevronLeft,ChevronRight,Download,MapPin,UserRound,Clock3,BookOpen,ClipboardCheck,Search,RotateCw} from 'lucide-react';

type Activity={id:string;name:string;audience:string};
type Agenda={routine_id?:string|null;audience:string;class_id?:string;level_id?:string;participant_ids?:string[];person_in_charge?:string;attendance_enabled?:boolean;journal_required?:boolean;documentation_required?:boolean;target_tracking_enabled?:boolean;status?:string;series_id?:string;recurrence?:string;revision:number;attendance_event_id?:string|null;journal_id?:string|null;id:string;title:string;starts_at:string;ends_at?:string;location?:string;presenter?:string;notes?:string;activity_type_id?:string;activity_types?:{name?:string}};
const dateKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const monthKey=(d:Date)=>dateKey(d).slice(0,7);
const localDay=(iso:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
const time=(iso:string)=>new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));

export default function AgendaContent({mode}:{mode:'list'|'calendar'}){
  const[today]=useState(()=>new Date(jakartaDate()+'T12:00:00'));
  const[month,setMonth]=useState(new Date(today.getFullYear(),today.getMonth(),1));
  const[selected,setSelected]=useState(jakartaDate());const[statusFilter,setStatusFilter]=useState('ALL'),[search,setSearch]=useState(''),[loading,setLoading]=useState(true),[role,setRole]=useState('VIEWER'),[scopedWrite,setScopedWrite]=useState<Audience[]|null>(null),[classes,setClasses]=useState<any[]>([]),[levels,setLevels]=useState<any[]>([]),[people,setPeople]=useState<any[]>([]),[scope,setScope]=useState('this'),[revision,setRevision]=useState(0);
  const[data,setData]=useState<Agenda[]>([]),[activities,setActivities]=useState<Activity[]>([]),[formDataLoaded,setFormDataLoaded]=useState(false);
  const[show,setShow]=useState(false),[busy,setBusy]=useState(false),[editId,setEditId]=useState(''),[canWrite,setCanWrite]=useState(false),[isOwner,setIsOwner]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const agendaRequest=useRef(0);
  const defaults={audience:'KELOMPOK',class_id:'',level_id:'',participant_ids:[] as string[],person_in_charge:'',attendance_enabled:true,journal_required:false,documentation_required:false,target_tracking_enabled:false,status:'SCHEDULED',recurrence:'once',repeat_until:''};
  const[form,setForm]=useState({...defaults,title:'',date:dateKey(today),start:'08:00',end:'',activity_type_id:'',location:'',presenter:'',notes:''});

  async function loadAgenda(targetMonth=month){
    const ticket=++agendaRequest.current;
    setLoading(true);
    const key=monthKey(targetMonth),last=new Date(targetMonth.getFullYear(),targetMonth.getMonth()+1,0).getDate();
    const q=new URLSearchParams({from:key+'-01T00:00:00+07:00',to:key+'-'+String(last).padStart(2,'0')+'T23:59:59+07:00'});
    try{
      const response=await fetch('/api/agenda?'+q,{cache:'no-store'});
      const result=await response.json();
      if(!response.ok||!Array.isArray(result))throw new Error(result.error||'Agenda tidak dapat dimuat.');
      if(ticket===agendaRequest.current){setData(result);setError('')}
    }catch(e){if(ticket===agendaRequest.current)setError(e instanceof Error?e.message:'Agenda tidak dapat dimuat.')}
    finally{if(ticket===agendaRequest.current)setLoading(false)}
  }
  async function loadIdentity(){
    try{
      const [t,u]=await Promise.all([fetch('/api/activity-types'),fetch('/api/auth/me')]);
      if(!t.ok||!u.ok)throw new Error('Konfigurasi agenda tidak dapat dimuat.');
      const [types,user]=await Promise.all([t.json(),u.json()]);
      const currentRole=user.role;setActivities(types);setRole(currentRole);setScopedWrite(Array.isArray(user.write_scopes)?user.write_scopes:null);setCanWrite((Array.isArray(user.write_scopes)?user.write_scopes:writeScopesForRole(currentRole)).length>0&&user.permissions?.['agenda.write']!==false);setIsOwner(currentRole==='ADMIN');
    }catch(e){setError(e instanceof Error?e.message:'Konfigurasi agenda tidak dapat dimuat.')}
  }
  async function ensureFormData(){
    if(formDataLoaded)return;
    const [k,l,p]=await Promise.all([fetch('/api/classes'),fetch('/api/levels'),fetch('/api/members?mode=list')]);
    if(!k.ok||!l.ok||!p.ok)throw new Error('Data form agenda tidak dapat dimuat.');
    const [kv,lv,pv]=await Promise.all([k.json(),l.json(),p.json()]);
    setClasses(kv);setLevels(lv);setPeople(pv);setFormDataLoaded(true);
  }
  useEffect(()=>{void loadIdentity()},[]);
  useEffect(()=>{void loadAgenda()},[month]);
  useEffect(()=>{if(new URLSearchParams(window.location.search).get('create')==='1'&&role!=='VIEWER')void openFor(jakartaDate())},[role]);
  function changeMonth(offset:number){const d=new Date(month.getFullYear(),month.getMonth()+offset,1);setMonth(d);setSelected(dateKey(d))}
  async function openFor(date:string){try{await ensureFormData();setEditId('');setRevision(0);setScope('this');const allowed=(scopedWrite??writeScopesForRole(role));setForm({...defaults,audience:allowed[0]||'KELOMPOK',title:'',date,start:'08:00',end:'',activity_type_id:'',location:'',presenter:'',notes:''});setShow(true)}catch(e){setError(e instanceof Error?e.message:'Form agenda tidak dapat dibuka.')}}
  async function editEvent(e:Agenda){try{await ensureFormData()}catch(err){setError(err instanceof Error?err.message:'Form agenda tidak dapat dibuka.');return}const day=localDay(e.starts_at);setEditId(e.id);setRevision(e.revision);setScope('this');setForm({...defaults,audience:e.audience,class_id:e.class_id||'',level_id:e.level_id||'',participant_ids:e.participant_ids||[],person_in_charge:e.person_in_charge||'',attendance_enabled:e.attendance_enabled!==false,journal_required:!!e.journal_required,documentation_required:!!e.documentation_required,target_tracking_enabled:!!e.target_tracking_enabled,status:e.status||'SCHEDULED',recurrence:e.recurrence||'once',title:e.title,date:day,start:time(e.starts_at).replace('.',':'),end:e.ends_at?time(e.ends_at).replace('.',':'):'',activity_type_id:e.activity_type_id||'',location:e.location||'',presenter:e.presenter||'',notes:e.notes||''});setShow(true)}
  async function save(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');setMessage('');
    if(form.end&&form.end<=form.start){setError('Jam selesai harus setelah jam mulai.');setBusy(false);return}
    const payload={...form,revision,scope,class_id:form.class_id||null,level_id:form.level_id||null,title:form.title,starts_at:new Date(`${form.date}T${form.start}:00+07:00`).toISOString(),ends_at:form.end?new Date(`${form.date}T${form.end}:00+07:00`).toISOString():null,activity_type_id:form.activity_type_id||null,location:form.location||null,presenter:form.presenter||null,notes:form.notes||null};
    const r=await fetch('/api/agenda'+(editId?'/'+editId:''),{method:editId?'PATCH':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const j=await r.json();setBusy(false);if(!r.ok){setError(j.error||'Gagal menyimpan agenda.');return}
    setShow(false);setSelected(form.date);const targetMonth=new Date(Number(form.date.slice(0,4)),Number(form.date.slice(5,7))-1,1);setMonth(targetMonth);setMessage('Agenda tersimpan dan siap digunakan untuk presensi atau jurnal.');await loadAgenda(targetMonth);
  }
  async function remove(e:Agenda){if(!confirm(`Batalkan agenda “${e.title}”? Absensi dan jurnal tetap tersimpan.`))return;const r=await fetch('/api/agenda/'+e.id,{method:'DELETE'});if(!r.ok){setError((await r.json()).error||'Gagal menghapus agenda.');return}setMessage('Agenda dibatalkan; tidak dihitung sebagai Alfa.');await loadAgenda()}
  async function downloadTemplate(){
    const XLSX=await import('xlsx');
    const rows=[{Tanggal:jakartaDate(),'Jam mulai':'19:30','Jam selesai':'21:00',Kegiatan:'Contoh kegiatan',Jenis:'',PIC:'',Pemateri:'',Tempat:'',Catatan:''}];
    const ws=XLSX.utils.json_to_sheet(rows);ws['!cols']=[{wch:14},{wch:12},{wch:12},{wch:30},{wch:18},{wch:20},{wch:20},{wch:24},{wch:36}];
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Template Agenda');XLSX.writeFile(wb,'template-agenda-simpul.xlsx');
  }
  async function exportExcel(){
    const XLSX=await import('xlsx');
    const rows=data.map(e=>({Tanggal:localDay(e.starts_at),'Jam mulai':time(e.starts_at),'Jam selesai':e.ends_at?time(e.ends_at):'',Kegiatan:e.title,Jenis:e.activity_types?.name||'',PIC:e.person_in_charge||'',Pemateri:e.presenter||'',Tempat:e.location||'',Catatan:e.notes||''}));
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows.length?rows:[{Tanggal:'',Kegiatan:'Belum ada agenda'}]),'Agenda');XLSX.writeFile(wb,`agenda-${monthKey(month)}.xlsx`);
  }
  const cells=useMemo(()=>{
    const offset=(new Date(month.getFullYear(),month.getMonth(),1).getDay()+6)%7;
    const out:Array<{date:string;day:number;events:Agenda[]}|null>=Array(offset).fill(null);
    const last=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    for(let d=1;d<=last;d++){const day=`${monthKey(month)}-${String(d).padStart(2,'0')}`;out.push({date:day,day:d,events:data.filter(e=>localDay(e.starts_at)===day)})}return out;
  },[month,data]);
  const selectedEvents=data.filter(e=>localDay(e.starts_at)===selected);
  const sortedEvents=useMemo(()=>[...data].sort((a,b)=>a.starts_at.localeCompare(b.starts_at)),[data]);
  const displayedEvents=useMemo(()=>sortedEvents.filter(e=>{
    const text=(e.title+' '+(e.location||'')+' '+(e.person_in_charge||'')+' '+(e.presenter||'')).toLocaleLowerCase('id-ID');
    return (statusFilter==='ALL'||(e.status||'SCHEDULED')===statusFilter)&&text.includes(search.trim().toLocaleLowerCase('id-ID'));
  }),[sortedEvents,statusFilter,search]);
  const canEdit=(e:Agenda)=>canWrite&&(scopedWrite??writeScopesForRole(role)).includes(e.audience as Audience);
  const attendanceHref=(e:Agenda)=>'/presensi/buat?'+(e.attendance_event_id?'event_id='+e.attendance_event_id:'agenda_id='+e.id);
  const journalHref=(e:Agenda)=>'/jurnal/buat?'+(e.journal_id?'journal_id='+e.journal_id:'agenda_id='+e.id);
  const statusText=(value?:string)=>value==='CANCELLED'?'Dibatalkan':value==='COMPLETED'?'Selesai':value==='ACTIVE'?'Berlangsung':value==='LOCKED'?'Terkunci':value==='DRAFT'?'Draf':'Terjadwal';

  return <>
    <div className="pageHeader agendaNewHeader">
      <div><h1>{mode==='calendar'?'Kalender Kegiatan':'Daftar & Kelola Agenda'}</h1><p>{mode==='calendar'?'Pilih tanggal untuk melihat kegiatan yang sudah dijadwalkan.':'Kelola jadwal dan lanjutkan ke presensi atau jurnal dari kegiatan yang sama.'}</p></div>
      <div className="row agendaHeaderActions">
        <button type="button" className="btn ghost" onClick={()=>void downloadTemplate()}><Download size={16}/>Template Excel</button>
        <button type="button" className="btn ghost" onClick={()=>void exportExcel()}><Download size={16}/>Ekspor Excel</button>
        {canWrite&&<button type="button" className="btn" onClick={()=>void openFor(mode==='calendar'?selected:jakartaDate())}><CalendarPlus size={17}/>Tambah agenda</button>}
      </div>
    </div>
    <nav className="agendaTwoNav" aria-label="Subnavigasi agenda">
      <Link href="/agenda/kalender" aria-current={mode==='calendar'?'page':undefined} className={mode==='calendar'?'active':''}><CalendarPlus size={17}/><span>Kalender</span></Link>
      <Link href="/agenda" aria-current={mode==='list'?'page':undefined} className={mode==='list'?'active':''}><ClipboardCheck size={17}/><span>Daftar & Kelola</span></Link>
    </nav>
    {message&&<div className="notice success" role="status">{message}</div>}
    {error&&<div className="notice error" role="alert">{error}</div>}
    <div className="agendaFilters">
      <label>Bulan <input aria-label="Pilih bulan agenda" className="input" type="month" value={monthKey(month)} onChange={e=>{if(!e.target.value)return;const next=new Date(e.target.value+'-01T12:00:00');setMonth(next);setSelected(e.target.value+'-01')}}/></label>
      {mode==='list'&&<>
        <label>Cari kegiatan <span className="agendaSearch"><Search size={16}/><input className="input" type="search" placeholder="Nama, tempat, atau PIC" value={search} onChange={e=>setSearch(e.target.value)}/></span></label>
        <label>Status <select className="select" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ALL">Semua status</option><option value="DRAFT">Draf</option><option value="SCHEDULED">Terjadwal</option><option value="ACTIVE">Berlangsung</option><option value="COMPLETED">Selesai</option><option value="LOCKED">Terkunci</option><option value="CANCELLED">Dibatalkan</option></select></label>
      </>}
      <button type="button" className="smallAction agendaRefresh" title="Muat ulang agenda" aria-label="Muat ulang agenda" onClick={()=>void loadAgenda()}><RotateCw size={18}/></button>
    </div>
    {loading?<div className="card agendaLoading" role="status"><div className="skeleton" style={{height:80}}/>Memuat jadwal…</div>:mode==='calendar'?<div className="agendaCalendarWorkspace">
      <section className="card section agendaPanel agendaCompactCalendar">
        <div className="calendarHead">
          <button type="button" className="smallAction" onClick={()=>changeMonth(-1)} aria-label="Bulan sebelumnya"><ChevronLeft/></button>
          <div><h2>{month.toLocaleDateString('id-ID',{month:'long',year:'numeric'})}</h2><small>{data.filter(e=>e.status!=='CANCELLED').length} kegiatan aktif</small></div>
          <button type="button" className="smallAction" onClick={()=>changeMonth(1)} aria-label="Bulan berikutnya"><ChevronRight/></button>
        </div>
        <div className="calendarGrid agendaCalendar">{['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(d=><div className="calendarDayName" key={d}>{d}</div>)}{cells.map((c,i)=>c?<button type="button" className={'calendarCell agendaCell'+(selected===c.date?' selected':'')+(c.date===jakartaDate()?' today':'')} key={c.date} aria-label={c.date+': '+c.events.length+' agenda'} aria-pressed={selected===c.date} onClick={()=>setSelected(c.date)}>
          <span className="calendarDate">{c.day}</span>{c.events.length>0&&<span className="agendaDots" aria-hidden="true">{c.events.slice(0,3).map(e=><i key={e.id} className={e.status==='CANCELLED'?'cancelled':''}/>)}</span>}
          <span className="agendaCount">{c.events.length?c.events.length:''}</span>
        </button>:<span key={'empty-'+i}/>)}</div>
      </section>
      <section className="card section agendaDayPanel" aria-label="Kegiatan pada tanggal terpilih">
        <div className="cardHead agendaSelectedHeader"><div><h2>{new Date(selected+'T12:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h2><p>{selectedEvents.length} kegiatan pada tanggal ini</p></div>{canWrite&&<button type="button" className="btn secondary" onClick={()=>void openFor(selected)}>+ Tanggal ini</button>}</div>
        <div className="agendaCards agendaDayEvents">{selectedEvents.map(e=><article className="agendaEntry" key={e.id}>
          <div className="agendaEntryTime"><Clock3 size={16}/><strong>{time(e.starts_at)}</strong>{e.ends_at&&<small>– {time(e.ends_at)}</small>}</div>
          <div className="agendaEntryBody"><div className="agendaEntryTop"><h3>{e.title}{e.routine_id&&<small title="Dibuat otomatis dari jadwal mingguan"> · Rutin</small>}</h3><span className={'agendaStatus '+(e.status||'SCHEDULED').toLowerCase()}>{statusText(e.status)}</span></div>
            <div className="agendaMeta">{e.location&&<span><MapPin size={15}/>{e.location}</span>}{(e.person_in_charge||e.presenter)&&<span><UserRound size={15}/>{e.person_in_charge||e.presenter}</span>}</div>
            {e.notes&&<p className="agendaDescription">{e.notes}</p>}
            <div className="agendaEntryActions">{canEdit(e)&&e.status!=='CANCELLED'&&<>{e.attendance_enabled!==false&&<Link href={attendanceHref(e)} className="btn secondary"><ClipboardCheck size={15}/>{e.attendance_event_id?'Buka presensi':'Mulai presensi'}</Link>}<Link href={journalHref(e)} className="btn ghost"><BookOpen size={15}/>{e.journal_id?'Buka jurnal':'Isi jurnal'}</Link></>}{canEdit(e)&&<button type="button" className="smallAction" onClick={()=>void editEvent(e)}>Edit</button>}{canEdit(e)&&e.status!=='CANCELLED'&&<button type="button" className="smallAction danger" onClick={()=>void remove(e)}>Batalkan</button>}</div>
          </div></article>)}
          {!selectedEvents.length&&<div className="agendaEmpty"><CalendarPlus size={24}/><strong>Belum ada kegiatan pada tanggal ini</strong><span>Pilih tanggal lain atau tambahkan agenda baru.</span>{canWrite&&<button className="btn secondary" type="button" onClick={()=>void openFor(selected)}>Tambah kegiatan</button>}</div>}
          {!selectedEvents.length&&data.some(e=>e.status!=='CANCELLED')&&<div className="agendaNearby">
            <div className="agendaNearbyHead"><strong>Kegiatan lain bulan ini</strong><Link href="/agenda">Lihat semua</Link></div>
            {sortedEvents.filter(e=>e.status!=='CANCELLED').slice(0,4).map(e=><button type="button" key={e.id} className="agendaNearbyItem" onClick={()=>setSelected(localDay(e.starts_at))}>
              <span>{new Date(localDay(e.starts_at)+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short'})}</span>
              <strong>{e.title}</strong>
              <small>{time(e.starts_at)}</small>
              <ChevronRight size={15}/>
            </button>)}
          </div>}</div>
      </section>
    </div>:<section className="section agendaCards">
      <div className="agendaListTitle"><div><h2>Jadwal {month.toLocaleDateString('id-ID',{month:'long',year:'numeric'})}</h2><p>{displayedEvents.length} dari {data.length} kegiatan</p></div></div>
      {displayedEvents.map(e=><article className="agendaEntry" key={e.id}>
        <div className="agendaEntryTime"><strong>{new Date(localDay(e.starts_at)+'T12:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short'})}</strong><small>{time(e.starts_at)}{e.ends_at?'–'+time(e.ends_at):''}</small></div>
        <div className="agendaEntryBody">
          <div className="agendaEntryTop"><div><h3>{e.title}{e.routine_id&&<small title="Dibuat otomatis dari jadwal mingguan"> · Rutin</small>}</h3><small>{e.activity_types?.name||'Kegiatan'} · {audienceLabels[e.audience as Audience]||e.audience}</small></div><span className={'agendaStatus '+(e.status||'SCHEDULED').toLowerCase()}>{statusText(e.status)}</span></div>
          <div className="agendaMeta">{e.location&&<span><MapPin size={15}/>{e.location}</span>}{(e.person_in_charge||e.presenter)&&<span><UserRound size={15}/>{e.person_in_charge||e.presenter}</span>}</div>
          <div className="agendaEntryActions">{canEdit(e)&&e.status!=='CANCELLED'&&<>{e.attendance_enabled!==false&&<Link href={attendanceHref(e)} className="btn secondary"><ClipboardCheck size={15}/>{e.attendance_event_id?'Buka presensi':'Mulai presensi'}</Link>}<Link href={journalHref(e)} className="btn ghost"><BookOpen size={15}/>{e.journal_id?'Buka jurnal':'Isi jurnal'}</Link></>}{canEdit(e)&&<button type="button" className="smallAction" onClick={()=>void editEvent(e)}>Edit</button>}{canEdit(e)&&e.status!=='CANCELLED'&&<button type="button" className="smallAction danger" onClick={()=>void remove(e)}>Batalkan</button>}</div>
        </div>
      </article>)}
      {!displayedEvents.length&&<div className="agendaEmpty"><CalendarPlus size={26}/><strong>{data.length?'Tidak ada agenda yang sesuai filter':'Belum ada agenda pada bulan ini'}</strong><span>{data.length?'Coba ubah pencarian atau status kegiatan.':'Mulai dengan menambahkan kegiatan atau pilih bulan lainnya.'}</span>{canWrite&&!data.length&&<button className="btn" type="button" onClick={()=>void openFor(jakartaDate())}>Tambah agenda pertama</button>}{data.length>0&&<button className="btn ghost" type="button" onClick={()=>{setSearch('');setStatusFilter('ALL')}}>Reset filter</button>}</div>}
    </section>}
    {show&&<div className="dialogBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShow(false)}}><form className="dialogCard" onSubmit={save} role="dialog" aria-modal="true" aria-label="Form agenda"><div className="cardHead"><h2>{editId?'Edit kegiatan':'Tambah kegiatan'}</h2><button type="button" className="smallAction" onClick={()=>setShow(false)}>Tutup</button></div><p className="agendaFormIntro">Isi nama, tanggal, waktu, dan lingkup. Pengaturan tambahan bisa dibuka jika diperlukan.</p><div className="formGrid"><label>Tanggal<input className="input" type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Kegiatan<input className="input" required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Mulai<input className="input" type="time" required value={form.start} onChange={e=>setForm({...form,start:e.target.value})}/></label><label>Selesai<input className="input" type="time" value={form.end} onChange={e=>setForm({...form,end:e.target.value})}/></label><label>Lingkup<select className="select" value={form.audience} onChange={e=>setForm({...form,audience:e.target.value,class_id:'',level_id:'',activity_type_id:'',participant_ids:[]})}>{(scopedWrite??writeScopesForRole(role)).map(a=><option key={a} value={a}>{audienceLabels[a]}</option>)}</select></label><details className="agendaAdvanced span2"><summary>Pengaturan lanjutan — peserta, perulangan, dan kebutuhan kegiatan</summary><div className="formGrid"><label>Jenjang<select className="select" value={form.level_id} onChange={e=>setForm({...form,level_id:e.target.value,class_id:'',participant_ids:[]})}><option value="">Semua jenjang</option>{['CABERAWIT','MUDA_MUDI'].includes(form.audience)&&levels.map(l=><option value={l.id} key={l.id}>{l.name}</option>)}</select></label><label>Kelas<select className="select" value={form.class_id} onChange={e=>setForm({...form,class_id:e.target.value,level_id:classes.find(k=>k.id===e.target.value)?.level_id||form.level_id,participant_ids:[]})}><option value="">Semua kelas</option>{classes.filter(k=>k.audience===form.audience&&(!form.level_id||k.level_id===form.level_id)).map(k=><option value={k.id} key={k.id}>{k.name}</option>)}</select></label><label>PIC<input className="input" value={form.person_in_charge} onChange={e=>setForm({...form,person_in_charge:e.target.value})}/></label><label>Status<select className="select" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{[['DRAFT','Draf'],['SCHEDULED','Terjadwal'],['ACTIVE','Berlangsung'],['COMPLETED','Selesai'],['LOCKED','Terkunci'],['CANCELLED','Dibatalkan']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><div className="eventRequirements span2"><label><input type="checkbox" checked={form.attendance_enabled} onChange={e=>setForm({...form,attendance_enabled:e.target.checked})}/> Presensi</label><label><input type="checkbox" checked={form.journal_required} onChange={e=>setForm({...form,journal_required:e.target.checked})}/> Jurnal</label><label><input type="checkbox" checked={form.documentation_required} onChange={e=>setForm({...form,documentation_required:e.target.checked})}/> Dokumentasi</label><label><input type="checkbox" checked={form.target_tracking_enabled} onChange={e=>setForm({...form,target_tracking_enabled:e.target.checked})}/> Target / Progres</label></div>{!editId&&<><label>Pengulangan<select className="select" value={form.recurrence} onChange={e=>setForm({...form,recurrence:e.target.value})}>{[['once','Sekali'],['daily','Harian'],['weekly','Mingguan'],['monthly','Bulanan']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>{form.recurrence!=='once'&&<label>Sampai tanggal<input className="input" type="date" required min={form.date} value={form.repeat_until} onChange={e=>setForm({...form,repeat_until:e.target.value})}/></label>}</>}{editId&&data.find(e=>e.id===editId)?.series_id&&!data.find(e=>e.id===editId)?.routine_id&&<label>Ubah<select className="select" value={scope} onChange={e=>setScope(e.target.value)}><option value="this">Pertemuan ini</option><option value="future">Ini dan berikutnya</option><option value="all">Seluruh rangkaian</option></select></label>}<label className="span2">Peserta khusus<select className="select" multiple value={form.participant_ids} onChange={e=>setForm({...form,participant_ids:Array.from(e.target.selectedOptions,o=>o.value)})}>{people.filter(p=>p.member_memberships?.some((m:any)=>(m.effective??m.active)&&m.categories?.slug===slugByAudience[form.audience]&&(!form.class_id||m.class_id===form.class_id)&&(!form.level_id||m.level_id===form.level_id))).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Jenis<select className="select" value={form.activity_type_id} onChange={e=>setForm({...form,activity_type_id:e.target.value})}><option value="">Pilih jenis</option>{activities.filter(a=>a.audience===form.audience).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Pemateri<input className="input" value={form.presenter} onChange={e=>setForm({...form,presenter:e.target.value})}/></label><label>Tempat<input className="input" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label><label className="span2">Catatan<textarea className="textarea" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label></div></details></div>{error&&<div className="notice error">{error}</div>}<div className="formActions"><button className="btn" disabled={busy}>{busy?'Menyimpan…':'Simpan agenda'}</button></div></form></div>}
  </>;
}
