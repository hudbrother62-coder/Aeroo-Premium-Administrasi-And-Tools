'use client';

import {FormEvent,useEffect,useMemo,useState} from 'react';

type Activity={id:string;name:string;audience:string};
type ClassRow={id:string;name:string;audience:string};
type Member={id:string;name:string;meta?:string};
type TargetRow={id:string;title:string;class_id?:string;levels?:{name?:string}};

const kinds=[['KELOMPOK','Kelompok'],['IBU_IBU','Ibu-Ibu'],['PENGURUS','Pengurus'],['CABERAWIT_CLASS','Caberawit Kelas'],['CABERAWIT_INDIVIDUAL','Caberawit Individu']] as const;

export default function Page(){
  const today=new Date().toISOString().slice(0,10);
  const[activities,setActivities]=useState<Activity[]>([]);
  const[classes,setClasses]=useState<ClassRow[]>([]);
  const[members,setMembers]=useState<Member[]>([]);
  const[targets,setTargets]=useState<TargetRow[]>([]);
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');
  const[form,setForm]=useState({
    journal_kind:'KELOMPOK',journal_date:today,title:'',activity_type_id:'',class_id:'',member_id:'',
    started_at:'',ended_at:'',material:'',summary:'',result:'',achievement:'',obstacles:'',improvement_plan:'',decisions:'',follow_up:'',notes:'',
    target_id:'',progress_value:'',progress_note:''
  });

  useEffect(()=>{Promise.all([fetch('/api/activity-types').then(r=>r.json()),fetch('/api/classes').then(r=>r.json()),fetch('/api/targets').then(r=>r.json())]).then(([a,c,t])=>{setActivities(a);setClasses(c);setTargets(t)})},[]);
  useEffect(()=>{
    if(form.journal_kind!=='CABERAWIT_INDIVIDUAL'){setMembers([]);return}
    const q=new URLSearchParams({audience:'CABERAWIT'});if(form.class_id)q.set('class_id',form.class_id);
    fetch('/api/participants?'+q).then(r=>r.json()).then(setMembers);
  },[form.journal_kind,form.class_id]);

  const cabClasses=useMemo(()=>classes.filter(c=>c.audience==='CABERAWIT'),[classes]);
  const currentAudience=form.journal_kind==='IBU_IBU'?'IBU_IBU':form.journal_kind==='PENGURUS'?'PENGURUS':form.journal_kind.startsWith('CABERAWIT')?'CABERAWIT':'KELOMPOK';
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
      progress:form.journal_kind==='CABERAWIT_INDIVIDUAL'&&form.member_id&&form.progress_note?{
        member_id:form.member_id,target_id:form.target_id||null,progress_value:form.progress_value||null,
        progress_note:form.progress_note,follow_up:form.follow_up||null
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
        <label>Jenis kegiatan<select className="select" value={form.activity_type_id} onChange={e=>set('activity_type_id',e.target.value)}><option value="">Pilih</option>{currentActivities.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label>

        {form.journal_kind.startsWith('CABERAWIT')&&<label>Kelas<select className="select" value={form.class_id} onChange={e=>set('class_id',e.target.value)}><option value="">Pilih kelas</option>{cabClasses.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>}
        {form.journal_kind==='CABERAWIT_INDIVIDUAL'&&<label>Individu<select className="select" value={form.member_id} onChange={e=>set('member_id',e.target.value)}><option value="">Pilih</option>{members.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select></label>}
        <label>Mulai<input className="input" type="time" value={form.started_at} onChange={e=>set('started_at',e.target.value)}/></label>
        <label>Selesai<input className="input" type="time" value={form.ended_at} onChange={e=>set('ended_at',e.target.value)}/></label>

        {(form.journal_kind==='KELOMPOK'||form.journal_kind==='IBU_IBU'||form.journal_kind==='CABERAWIT_CLASS')&&<label className="span2">Materi<textarea className="textarea" value={form.material} onChange={e=>set('material',e.target.value)}/></label>}
        {form.journal_kind==='CABERAWIT_CLASS'&&<><label>Capaian<textarea className="textarea" value={form.achievement} onChange={e=>set('achievement',e.target.value)}/></label><label>Rencana perbaikan<textarea className="textarea" value={form.improvement_plan} onChange={e=>set('improvement_plan',e.target.value)}/></label></>}
        {form.journal_kind==='PENGURUS'&&<><label className="span2">Notulensi<textarea className="textarea" value={form.summary} onChange={e=>set('summary',e.target.value)}/></label><label>Keputusan<textarea className="textarea" value={form.decisions} onChange={e=>set('decisions',e.target.value)}/></label><label>Pelaksanaan / hasil<textarea className="textarea" value={form.result} onChange={e=>set('result',e.target.value)}/></label></>}
        {form.journal_kind==='CABERAWIT_INDIVIDUAL'&&<>
          <label>Target<select className="select" value={form.target_id} onChange={e=>set('target_id',e.target.value)}><option value="">Tanpa target khusus</option>{targetOptions.map(t=><option value={t.id} key={t.id}>{t.title}</option>)}</select></label>
          <label>Nilai progres<input className="input" type="number" min="0" max="100" value={form.progress_value} onChange={e=>set('progress_value',e.target.value)}/></label>
          <label className="span2">Catatan progres<textarea className="textarea" value={form.progress_note} onChange={e=>set('progress_note',e.target.value)} required/></label>
        </>}
        <label>Kendala<textarea className="textarea" value={form.obstacles} onChange={e=>set('obstacles',e.target.value)}/></label>
        <label>Tindak lanjut<textarea className="textarea" value={form.follow_up} onChange={e=>set('follow_up',e.target.value)}/></label>
      </div>
      {error&&<div className="notice error section">{error}</div>}
      <div className="formActions"><a className="btn ghost" href="/jurnal">Batal</a><button className="btn" disabled={saving}>{saving?'Menyimpan…':'Simpan'}</button></div>
    </form>
  </>;
}
