'use client';

import {FormEvent,useEffect,useMemo,useState} from 'react';
import * as XLSX from 'xlsx';
import {CalendarPlus,ChevronLeft,ChevronRight,Download,MapPin,UserRound,Clock3} from 'lucide-react';

type Activity={id:string;name:string;audience:string};
type Agenda={id:string;title:string;starts_at:string;ends_at?:string;location?:string;presenter?:string;notes?:string;activity_type_id?:string;activity_types?:{name?:string}};
const dateKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const monthKey=(d:Date)=>dateKey(d).slice(0,7);
const localDay=(iso:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
const time=(iso:string)=>new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));

export default function AgendaPage(){
  const[today]=useState(()=>new Date());
  const[month,setMonth]=useState(new Date(today.getFullYear(),today.getMonth(),1));
  const[selected,setSelected]=useState(dateKey(today));
  const[data,setData]=useState<Agenda[]>([]),[activities,setActivities]=useState<Activity[]>([]);
  const[show,setShow]=useState(false),[busy,setBusy]=useState(false),[editId,setEditId]=useState(''),[canWrite,setCanWrite]=useState(false),[isOwner,setIsOwner]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const[form,setForm]=useState({title:'',date:dateKey(today),start:'08:00',end:'',activity_type_id:'',location:'',presenter:'',notes:''});

  async function load(){
    const key=monthKey(month),last=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    const q=new URLSearchParams({from:key+'-01T00:00:00+07:00',to:key+'-'+String(last).padStart(2,'0')+'T23:59:59+07:00'});
    try{
      const [a,t,u]=await Promise.all([fetch('/api/agenda?'+q),fetch('/api/activity-types'),fetch('/api/auth/me')]);
      if(!a.ok||!t.ok||!u.ok)throw new Error('Agenda tidak dapat dimuat.');
      setData(await a.json());setActivities(await t.json());const role=(await u.json()).role;setCanWrite(role!=='VIEWER');setIsOwner(role==='ADMIN');setError('');
    }catch(e){setError(e instanceof Error?e.message:'Agenda tidak dapat dimuat.')}
  }
  useEffect(()=>{void load()},[month]);
  function changeMonth(offset:number){const d=new Date(month.getFullYear(),month.getMonth()+offset,1);setMonth(d);setSelected(dateKey(d))}
  function openFor(date:string){setEditId('');setForm({title:'',date,start:'08:00',end:'',activity_type_id:'',location:'',presenter:'',notes:''});setShow(true)}
  function editEvent(e:Agenda){const day=localDay(e.starts_at);setEditId(e.id);setForm({title:e.title,date:day,start:time(e.starts_at).replace('.',':'),end:e.ends_at?time(e.ends_at).replace('.',':'):'',activity_type_id:e.activity_type_id||'',location:e.location||'',presenter:e.presenter||'',notes:e.notes||''});setShow(true)}
  async function save(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');setMessage('');
    if(form.end&&form.end<=form.start){setError('Jam selesai harus setelah jam mulai.');setBusy(false);return}
    const payload={title:form.title,starts_at:new Date(`${form.date}T${form.start}:00+07:00`).toISOString(),ends_at:form.end?new Date(`${form.date}T${form.end}:00+07:00`).toISOString():null,activity_type_id:form.activity_type_id||null,location:form.location||null,presenter:form.presenter||null,notes:form.notes||null};
    const r=await fetch('/api/agenda'+(editId?'/'+editId:''),{method:editId?'PATCH':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const j=await r.json();setBusy(false);if(!r.ok){setError(j.error||'Gagal menyimpan agenda.');return}
    setShow(false);setSelected(form.date);setMonth(new Date(Number(form.date.slice(0,4)),Number(form.date.slice(5,7))-1,1));setMessage('Agenda tersimpan.');await load();
  }
  async function remove(e:Agenda){if(!confirm(`Hapus agenda “${e.title}”?`))return;const r=await fetch('/api/agenda/'+e.id,{method:'DELETE'});if(!r.ok){setError((await r.json()).error||'Gagal menghapus agenda.');return}setMessage('Agenda dihapus.');await load()}
  function exportExcel(){
    const rows=data.map(e=>({Tanggal:localDay(e.starts_at),'Jam mulai':time(e.starts_at),'Jam selesai':e.ends_at?time(e.ends_at):'',Kegiatan:e.title,Jenis:e.activity_types?.name||'',Pemateri:e.presenter||'',Tempat:e.location||'',Catatan:e.notes||''}));
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows.length?rows:[{Tanggal:'',Kegiatan:'Belum ada agenda'}]),'Agenda');XLSX.writeFile(wb,`agenda-${monthKey(month)}.xlsx`);
  }
  const cells=useMemo(()=>{
    const offset=(new Date(month.getFullYear(),month.getMonth(),1).getDay()+6)%7;
    const out:Array<{date:string;day:number;events:Agenda[]}|null>=Array(offset).fill(null);
    const last=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    for(let d=1;d<=last;d++){const day=`${monthKey(month)}-${String(d).padStart(2,'0')}`;out.push({date:day,day:d,events:data.filter(e=>localDay(e.starts_at)===day)})}return out;
  },[month,data]);
  const selectedEvents=data.filter(e=>localDay(e.starts_at)===selected);

  return <>
    <div className="pageHeader"><div><div className="eyebrow">Rencana kegiatan</div><h1>Agenda</h1><p>Jadwal, pemateri, waktu, dan tempat dalam satu bulan.</p></div><div className="row"><button className="btn ghost" onClick={exportExcel}><Download size={17}/>Excel</button>{canWrite&&<button className="btn" onClick={()=>openFor(selected)}><CalendarPlus size={17}/>Tambah</button>}</div></div>
    {message&&<div className="notice success" role="status">{message}</div>}{error&&<div className="notice error" role="alert">{error}</div>}
    <section className="card section agendaPanel"><div className="calendarHead"><button className="smallAction" onClick={()=>changeMonth(-1)} aria-label="Bulan sebelumnya"><ChevronLeft/></button><div><h2>{month.toLocaleDateString('id-ID',{month:'long',year:'numeric'})}</h2><small>{data.length} kegiatan terencana</small></div><button className="smallAction" onClick={()=>changeMonth(1)} aria-label="Bulan berikutnya"><ChevronRight/></button></div>
      <div className="calendarGrid agendaCalendar">{['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(x=><div className="calendarDayName" key={x}>{x}</div>)}{cells.map((c,i)=>c?<button type="button" className={'calendarCell agendaCell'+(selected===c.date?' selected':'')+(c.date===dateKey(today)?' today':'')} key={c.date} onClick={()=>setSelected(c.date)}><span className="calendarDate">{c.day}</span><span className="agendaCount">{c.events.length?`${c.events.length} agenda`:''}</span>{c.events.slice(0,2).map(e=><span className="calendarEvent" key={e.id}>{time(e.starts_at)} {e.title}</span>)}</button>:<span key={'e'+i}/>)}</div>
    </section>
    <section className="section"><div className="cardHead"><div><h2>{new Date(selected+'T12:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'})}</h2><p>{selectedEvents.length} agenda pada tanggal ini</p></div>{canWrite&&<button className="btn secondary" onClick={()=>openFor(selected)}>+ Tanggal ini</button>}</div>
      <div className="agendaList">{selectedEvents.map(e=><article className="agendaItem" key={e.id}><div className="agendaTime">{time(e.starts_at)}{e.ends_at&&<small>– {time(e.ends_at)}</small>}</div><div className="agendaInfo"><span className="badge">{e.activity_types?.name||'Kegiatan'}</span><h3>{e.title}</h3><div className="agendaMeta">{e.presenter&&<span><UserRound size={15}/>{e.presenter}</span>}{e.location&&<span><MapPin size={15}/>{e.location}</span>}{e.ends_at&&<span><Clock3 size={15}/>{time(e.starts_at)}–{time(e.ends_at)}</span>}</div>{e.notes&&<p>{e.notes}</p>}</div>{canWrite&&<div className="agendaEdit"><button className="smallAction" onClick={()=>editEvent(e)}>Edit</button>{isOwner&&<button className="smallAction danger" onClick={()=>void remove(e)}>Hapus</button>}</div>}</article>)}{!selectedEvents.length&&<div className="emptyState">Belum ada agenda pada tanggal ini.</div>}</div>
    </section>
    {show&&<div className="dialogBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShow(false)}}><form className="dialogCard" onSubmit={save} role="dialog" aria-modal="true" aria-label="Form agenda"><div className="cardHead"><h2>{editId?'Edit agenda':'Tambah agenda'}</h2><button type="button" className="smallAction" onClick={()=>setShow(false)}>Tutup</button></div><div className="formGrid"><label>Tanggal<input className="input" type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Kegiatan<input className="input" required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Mulai<input className="input" type="time" required value={form.start} onChange={e=>setForm({...form,start:e.target.value})}/></label><label>Selesai<input className="input" type="time" value={form.end} onChange={e=>setForm({...form,end:e.target.value})}/></label><label>Jenis<select className="select" value={form.activity_type_id} onChange={e=>setForm({...form,activity_type_id:e.target.value})}><option value="">Pilih jenis</option>{activities.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Pemateri<input className="input" value={form.presenter} onChange={e=>setForm({...form,presenter:e.target.value})}/></label><label>Tempat<input className="input" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label><label className="span2">Catatan<textarea className="textarea" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label></div>{error&&<div className="notice error">{error}</div>}<div className="formActions"><button className="btn" disabled={busy}>{busy?'Menyimpan…':'Simpan agenda'}</button></div></form></div>}
  </>;
}
