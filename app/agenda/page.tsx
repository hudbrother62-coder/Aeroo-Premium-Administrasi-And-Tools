'use client';

import {FormEvent,useEffect,useMemo,useState} from 'react';

type Activity={id:string;name:string;audience:string};
type Agenda={id:string;title:string;starts_at:string;ends_at?:string;location?:string;activity_types?:{name?:string}};

function monthKey(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}

export default function AgendaPage(){
  const[today]=useState(new Date());
  const[month,setMonth]=useState(new Date(today.getFullYear(),today.getMonth(),1));
  const[data,setData]=useState<Agenda[]>([]);
  const[activities,setActivities]=useState<Activity[]>([]);
  const[show,setShow]=useState(false);
  const[error,setError]=useState('');
  const[form,setForm]=useState({title:'',date:new Date().toISOString().slice(0,10),start:'08:00',end:'',activity_type_id:'',location:'',notes:''});

  const load=async()=>{
    const key=monthKey(month);
    const last=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    const q=new URLSearchParams({from:key+'-01T00:00:00',to:key+'-'+String(last).padStart(2,'0')+'T23:59:59'});
    try{
      const[a,t]=await Promise.all([fetch('/api/agenda?'+q).then(r=>r.json()),fetch('/api/activity-types').then(r=>r.json())]);
      setData(a);setActivities(t);setError('');
    }catch{setError('Agenda belum dapat dimuat.')}
  };
  useEffect(()=>{void load()},[month]);

  async function save(e:FormEvent){
    e.preventDefault();
    const starts_at=new Date(`${form.date}T${form.start}:00`).toISOString();
    const ends_at=form.end?new Date(`${form.date}T${form.end}:00`).toISOString():null;
    const r=await fetch('/api/agenda',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:form.title,starts_at,ends_at,activity_type_id:form.activity_type_id||null,location:form.location||null,notes:form.notes||null})});
    const j=await r.json();if(!r.ok){setError(j.error||'Gagal menyimpan agenda.');return}
    setShow(false);setForm(v=>({...v,title:'',end:'',location:'',notes:''}));await load();
  }

  const cells=useMemo(()=>{
    const first=new Date(month.getFullYear(),month.getMonth(),1);
    const offset=(first.getDay()+6)%7;
    const last=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    const out:Array<{date:string;day:number;events:Agenda[]}|null>=Array(offset).fill(null);
    for(let d=1;d<=last;d++){
      const date=`${monthKey(month)}-${String(d).padStart(2,'0')}`;
      out.push({date,day:d,events:data.filter(x=>x.starts_at.slice(0,10)===date)});
    }
    return out;
  },[month,data]);

  return <>
    <div className="pageHeader"><div><h1>Agenda</h1></div><button className="btn writeOnly" onClick={()=>setShow(v=>!v)}>{show?'Tutup':'+ Agenda'}</button></div>
    {show&&<form className="card writeOnly" onSubmit={save}>
      <div className="formGrid">
        <label>Tanggal<input className="input" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
        <label>Judul<input className="input" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/></label>
        <label>Mulai<input className="input" type="time" value={form.start} onChange={e=>setForm({...form,start:e.target.value})}/></label>
        <label>Selesai<input className="input" type="time" value={form.end} onChange={e=>setForm({...form,end:e.target.value})}/></label>
        <label>Jenis<select className="select" value={form.activity_type_id} onChange={e=>setForm({...form,activity_type_id:e.target.value})}><option value="">Pilih</option>{activities.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label>Lokasi<input className="input" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label>
      </div>
      <div className="formActions"><button className="btn">Simpan</button></div>
    </form>}
    {error&&<div className="notice error section">{error}</div>}
    <section className="card section">
      <div className="calendarHead">
        <button className="btn ghost" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>‹</button>
        <h2 style={{margin:0}}>{month.toLocaleDateString('id-ID',{month:'long',year:'numeric'})}</h2>
        <button className="btn ghost" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>›</button>
      </div>
      <div className="calendarGrid">
        {['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(x=><div className="calendarDayName" key={x}>{x}</div>)}
        {cells.map((c,i)=>c?<div className="calendarCell" key={c.date} onDoubleClick={()=>{setForm(v=>({...v,date:c.date}));setShow(true)}}>
          <div className="calendarDate">{c.day}</div>
          {c.events.slice(0,3).map(e=><div className="calendarEvent" title={e.title} key={e.id}>{new Date(e.starts_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})} {e.title}</div>)}
          {c.events.length>3&&<div className="itemMeta">+{c.events.length-3} lainnya</div>}
        </div>:<div key={'x'+i}/>)}
      </div>
    </section>
  </>;
}
