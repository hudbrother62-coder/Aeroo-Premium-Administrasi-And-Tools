'use client';

import {FormEvent,useEffect,useMemo,useState} from 'react';

type Activity={id:string;name:string;audience:string};
type ClassRow={id:string;name:string;audience:string};
type Member={id:string;name:string;meta?:string};
type TargetRow={id:string;title:string;class_id?:string;levels?:{name?:string}};

const kinds=[['KELOMPOK','Kelompok'],['IBU_IBU','Ibu-Ibu'],['PENGURUS','Musyawarah Pengurus'],['CABERAWIT_CLASS','Jabirawit Kelas'],['CABERAWIT_INDIVIDUAL','Jabirawit Individu'],['MUDA_MUDI_INDIVIDUAL','Remaja Individu']] as const;

export default function Page(){
  const today=new Date().toISOString().slice(0,10);
  const[activities,setActivities]=useState<Activity[]>([]);
  const[classes,setClasses]=useState<ClassRow[]>([]);
  const[members,setMembers]=useState<Member[]>([]);
  const[targets,setTargets]=useState<TargetRow[]>([]);
  const[events,setEvents]=useState<Array<{id:string;title:string;event_date:string;audience:string}>>([]);
  const[materials,setMaterials]=useState([{topic:'',page:''}]);
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');
  const[form,setForm]=useState({
    journal_kind:'KELOMPOK',journal_date:today,title:'',activity_type_id:'',class_id:'',member_id:'',
    started_at:'',ended_at:'',material:'',summary:'',result:'',achievement:'',obstacles:'',improvement_plan:'',decisions:'',follow_up:'',notes:'',
    target_id:'',progress_value:'',progress_note:'',meeting_type:'Kelompok',event_id:'',absence:'HADIR',absence_reason:''
  });

  useEffect(()=>{Promise.all([fetch('/api/activity-types').then(r=>r.json()),fetch('/api/classes').then(r=>r.json()),fetch('/api/targets').then(r=>r.json()),fetch('/api/attendance').then(r=>r.json())]).then(([a,c,t,e])=>{setActivities(a);setClasses(c);setTargets(t);setEvents(Array.isArray(e)?e:[])})},[]);
  useEffect(()=>{
    if(!form.journal_kind.endsWith('_INDIVIDUAL')){setMembers([]);return}
    const q=new URLSearchParams({audience:form.journal_kind.startsWith('MUDA_MUDI')?'MUDA_MUDI':'CABERAWIT'});if(form.class_id)q.set('class_id',form.class_id);
    fetch('/api/participants?'+q).then(r=>r.json()).then(setMembers);
  },[form.journal_kind,form.class_id]);

  const cabClasses=useMemo(()=>classes.filter(c=>c.audience===(form.journal_kind.startsWith('MUDA_MUDI')?'MUDA_MUDI':'CABERAWIT')),[classes,form.journal_kind]);
  const currentAudience=form.journal_kind==='IBU_IBU'?'IBU_IBU':form.journal_kind==='PENGURUS'?'PENGURUS':form.journal_kind.startsWith('CABERAWIT')?'CABERAWIT':form.journal_kind.startsWith('MUDA_MUDI')?'MUDA_MUDI':'KELOMPOK';
  const currentActivities=activities.filter(a=>a.audience===currentAudience||a.audience==='CUSTOM');
  const targetOptions=targets.filter(t=>!form.class_id||!t.class_id||t.class_id===form.class_id);

  async function save(e:FormEvent){
    e.preventDefault();setSaving(true);setError('');
    const body={
      journal_kind:form.journal_kind,journal_date:form.journal_date,title:form.title,
      activity_type_id:form.activity_type_id||null,class_id:form.class_id||null,member_id:form.member_id||null,
      started_at:form.started_at||null,ended_at:form.ended_at||null,material:form.material||null,summary:form.summary||null,
      result:form.result||null,achievement:form.achievement||null,obstacles:form.obstacles||null,improvement_plan:form.improvement_plan||null,
      decisions:form.decisions||null,follow_up:form.follow_up||null,notes:form.notes||null,
      event_id:form.event_id||null,
      assessment:{materials:materials.filter(x=>x.topic||x.page),meeting_type:form.journal_kind==='PENGURUS'?form.meeting_type:null,absence:form.absence,absence_reason:form.absence_reason},
      progress:form.journal_kind.endsWith('_INDIVIDUAL')&&form.member_id&&form.absence==='HADIR'&&form.progress_note?{
        member_id:form.member_id,target_id:form.target_id||null,progress_value:form.progress_value||null,
        progress_note:form.progress_note,follow_up:form.follow_up||null,assessment:{materials:materials.filter(x=>x.topic||x.page)}
      }:null
    };
    const r=await fetch('/api/journals',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const j=await r.json();
    if(!r.ok){setError(j.error||'Gagal menyimpan jurnal.');setSaving(false);return}
    window.location.href='/jurnal';
  }

  const set=(k:string,v:string)=>setForm(x=>({...x,[k]:v}));

  return <>
    <div className="pageHeader"><div><h1>Buat Jurnal</h1></div></div>
    <form className="card" onSubmit={save}>
      <div className="formGrid">
        <label>Jenis jurnal<select className="select" value={form.journal_kind} onChange={e=>set('journal_kind',e.target.value)}>{kinds.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
        <label>Tanggal<input className="input" type="date" value={form.journal_date} onChange={e=>set('journal_date',e.target.value)} required/></label>
        <label>Judul<input className="input" value={form.title} onChange={e=>set('title',e.target.value)} required/></label>
        <label>Jenis kegiatan<select className="select" required value={form.activity_type_id} onChange={e=>set('activity_type_id',e.target.value)}><option value="">Pilih</option>{currentActivities.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label>

        {(form.journal_kind.startsWith('CABERAWIT')||form.journal_kind.startsWith('MUDA_MUDI'))&&<label>Kelas<select className="select" value={form.class_id} onChange={e=>set('class_id',e.target.value)}><option value="">Pilih kelas</option>{cabClasses.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>}
        {form.journal_kind.endsWith('_INDIVIDUAL')&&<label>Individu<select className="select" required value={form.member_id} onChange={e=>set('member_id',e.target.value)}><option value="">Pilih</option>{members.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select></label>}
        <label>Mulai<input className="input" type="time" value={form.started_at} onChange={e=>set('started_at',e.target.value)}/></label>
        <label>Selesai<input className="input" type="time" value={form.ended_at} onChange={e=>set('ended_at',e.target.value)}/></label>

        {form.journal_kind==='PENGURUS'&&<><label>Jenis musyawarah<select className="select" value={form.meeting_type} onChange={e=>set('meeting_type',e.target.value)}><option>Kelompok</option><option>Lima Unsur</option><option>Pengajar</option></select></label><label>Ambil kehadiran dari presensi<select className="select" value={form.event_id} onChange={e=>set('event_id',e.target.value)}><option value="">Belum ditautkan</option>{events.filter(x=>x.audience==='PENGURUS'&&x.event_date===form.journal_date).map(x=><option value={x.id} key={x.id}>{x.title}</option>)}</select></label><label className="span2">Usulan<textarea className="textarea" value={form.material} onChange={e=>set('material',e.target.value)}/></label></>}
        <div className="span2"><div className="cardHead"><div><h2>Materi dan halaman terakhir</h2><p>Tambah sebanyak yang diperlukan.</p></div><button type="button" className="btn secondary" onClick={()=>setMaterials(v=>[...v,{topic:'',page:''}])}>+ Materi</button></div>{materials.map((m,i)=><div className="row materialRow" key={i}><input className="input" placeholder="Nama materi" value={m.topic} onChange={e=>setMaterials(v=>v.map((x,k)=>k===i?{...x,topic:e.target.value}:x))}/><input className="input" placeholder="Halaman terakhir" value={m.page} onChange={e=>setMaterials(v=>v.map((x,k)=>k===i?{...x,page:e.target.value}:x))}/>{materials.length>1&&<button type="button" className="smallAction" onClick={()=>setMaterials(v=>v.filter((_,k)=>k!==i))}>Hapus</button>}</div>)}</div>
        {form.journal_kind==='CABERAWIT_CLASS'&&<><label>Capaian<textarea className="textarea" value={form.achievement} onChange={e=>set('achievement',e.target.value)}/></label><label>Rencana perbaikan<textarea className="textarea" value={form.improvement_plan} onChange={e=>set('improvement_plan',e.target.value)}/></label></>}
        {form.journal_kind==='PENGURUS'&&<><label className="span2">Notulensi<textarea className="textarea" value={form.summary} onChange={e=>set('summary',e.target.value)}/></label><label>Keputusan<textarea className="textarea" value={form.decisions} onChange={e=>set('decisions',e.target.value)}/></label><label>Pelaksanaan / hasil<textarea className="textarea" value={form.result} onChange={e=>set('result',e.target.value)}/></label></>}
        {form.journal_kind.endsWith('_INDIVIDUAL')&&<>
          <label>Status<select className="select" value={form.absence} onChange={e=>set('absence',e.target.value)}><option value="HADIR">Hadir</option><option value="IZIN">Izin</option><option value="ALFA">Tidak masuk</option></select></label>
          {form.absence!=='HADIR'&&<label>Alasan / keterangan<input className="input" value={form.absence_reason} onChange={e=>set('absence_reason',e.target.value)}/></label>}
          {form.absence==='HADIR'&&<>
          <label>Target<select className="select" value={form.target_id} onChange={e=>set('target_id',e.target.value)}><option value="">Tanpa target khusus</option>{targetOptions.map(t=><option value={t.id} key={t.id}>{t.title}</option>)}</select></label>
          <label>Nilai progres<input className="input" type="number" min="0" max="100" value={form.progress_value} onChange={e=>set('progress_value',e.target.value)}/></label>
          <label className="span2">Catatan progres<textarea className="textarea" value={form.progress_note} onChange={e=>set('progress_note',e.target.value)} required/></label>
          </>}
        </>}
        <label>Kendala<textarea className="textarea" value={form.obstacles} onChange={e=>set('obstacles',e.target.value)}/></label>
        <label>Tindak lanjut<textarea className="textarea" value={form.follow_up} onChange={e=>set('follow_up',e.target.value)}/></label>
      </div>
      {error&&<div className="notice error section">{error}</div>}
      <div className="formActions"><a className="btn ghost" href="/jurnal">Batal</a><button className="btn" disabled={saving}>{saving?'Menyimpan…':'Simpan'}</button></div>
    </form>
  </>;
}
