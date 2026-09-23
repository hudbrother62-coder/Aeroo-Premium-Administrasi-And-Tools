'use client';

import {FormEvent,useEffect,useMemo,useState} from 'react';
import {audienceLabels,writeScopesForRole,type Audience,type Role} from '@/lib/access';

type Activity={id:string;name:string;audience:string};
type Level={id:string;name:string};
type ClassRow={id:string;name:string;audience:string;level_id?:string};
type Participant={id:string;name:string;type:'member';meta:string};
type Status='H'|'I'|'A';

export default function Page(){
  const[activities,setActivities]=useState<Activity[]>([]);
  const[levels,setLevels]=useState<Level[]>([]);
  const[classes,setClasses]=useState<ClassRow[]>([]);
  const[role,setRole]=useState<Role|null>(null);
  const[ready,setReady]=useState(false);
  const[people,setPeople]=useState<Participant[]>([]);
  const[status,setStatus]=useState<Record<string,Status>>({});
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');
  const today=new Date().toISOString().slice(0,10);
  const[form,setForm]=useState({title:'',event_date:today,event_time:'',audience:'KELOMPOK' as Audience,activity_type_id:'',level_id:'',class_id:'',notes:''});

  const allowed=useMemo(()=>writeScopesForRole(role),[role]);

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
      setRole(nextRole);
      const scopes=writeScopesForRole(nextRole);
      if(scopes.length)setForm(v=>({...v,audience:scopes[0]}));
      setReady(true);
    }).catch(()=>{setError('Akses presensi belum dapat dimuat.');setReady(true)});
  },[]);

  useEffect(()=>{
    if(!ready||!allowed.includes(form.audience))return;
    const params=new URLSearchParams({audience:form.audience});
    if(form.level_id)params.set('level_id',form.level_id);
    if(form.class_id)params.set('class_id',form.class_id);
    fetch('/api/participants?'+params).then(r=>r.json()).then((p:Participant[])=>{
      const rows=Array.isArray(p)?p:[];
      setPeople(rows);
      setStatus(Object.fromEntries(rows.map(x=>[x.id,'H'])));
    }).catch(()=>setPeople([]));
  },[ready,allowed,form.audience,form.level_id,form.class_id]);

  useEffect(()=>{
    if(form.audience==='PENGURUS'){
      const mus=activities.find(a=>a.audience==='PENGURUS'&&a.name.toLowerCase().includes('musyawarah'));
      if(mus)setForm(v=>({...v,activity_type_id:mus.id,title:v.title||'Musyawarah Pengurus'}));
    }
  },[form.audience,activities]);

  const matching=useMemo(()=>activities.filter(a=>a.audience===form.audience||a.audience==='CUSTOM'),[activities,form.audience]);
  const classOptions=useMemo(()=>classes.filter(c=>c.audience===form.audience),[classes,form.audience]);

  async function save(e:FormEvent){
    e.preventDefault();setSaving(true);setError('');
    const records=people.map(p=>({member_id:p.id,status:status[p.id]??'H'}));
    const payload={...form,event_time:form.event_time||null,activity_type_id:form.activity_type_id||null,level_id:form.level_id||null,class_id:form.class_id||null,notes:form.notes||null,records};
    const r=await fetch('/api/attendance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const j=await r.json();
    if(!r.ok){setError(j.error||'Gagal menyimpan presensi.');setSaving(false);return}
    window.location.href='/presensi';
  }
  const count=(s:Status)=>Object.values(status).filter(v=>v===s).length;

  if(ready&&!allowed.length){
    return <>
      <div className="pageHeader"><div><h1>Buat Presensi</h1></div></div>
      <div className="notice scopeNotice"><div><strong>Akses hanya-baca</strong><span>Akun ini tidak diberi hak input presensi.</span></div></div>
    </>;
  }

  return <>
    <div className="pageHeader"><div><h1>Buat Presensi</h1><p>Form otomatis mengikuti akses akun.</p></div></div>
    {role&&<div className="notice scopeNotice"><div><strong>Ruang input</strong><span>{allowed.map(a=>audienceLabels[a]).join(' · ')}</span></div></div>}
    <form onSubmit={save} className="section">
      <section className="card">
        <div className="formGrid">
          <label>Tanggal<input className="input" type="date" required value={form.event_date} onChange={e=>setForm({...form,event_date:e.target.value})}/></label>
          <label>Kategori<select className="select" value={form.audience} onChange={e=>setForm({...form,audience:e.target.value as Audience,activity_type_id:'',level_id:'',class_id:''})}>
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
      </section>

      <section className="section">
        <div className="cardHead"><div><h2>Peserta</h2><p>{people.length} orang</p></div><button type="button" className="btn ghost" onClick={()=>setStatus(Object.fromEntries(people.map(x=>[x.id,'H'])))}>Semua H</button></div>
        <div className="list">
          {people.map(p=><div className="item att" key={p.id}><div><div className="itemTitle">{p.name}</div><div className="itemMeta">{p.meta}</div></div>{(['H','I','A'] as Status[]).map(s=><button type="button" className={status[p.id]===s?'on':''} key={s} onClick={()=>setStatus({...status,[p.id]:s})}>{s}</button>)}</div>)}
          {!people.length&&<div className="emptyState">Belum ada peserta pada kategori, jenjang, atau kelas ini.</div>}
        </div>
      </section>

      {error&&<div className="notice error section">{error}</div>}
      <div className="stickyAction row between"><div><strong>{count('H')} H</strong><span> · {count('I')} I · {count('A')} A</span></div><button className="btn" disabled={saving||!people.length}>{saving?'Menyimpan…':'Simpan Presensi'}</button></div>
    </form>
  </>;
}
