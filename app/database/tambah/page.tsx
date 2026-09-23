'use client';

import {FormEvent,useEffect,useMemo,useState} from 'react';

type Cat={id:string;name:string;slug:string};
type Level={id:string;name:string};
type ClassRow={id:string;name:string;audience:string;levels?:{name?:string}};

export default function Page(){
  const[cats,setCats]=useState<Cat[]>([]);
  const[levels,setLevels]=useState<Level[]>([]);
  const[classes,setClasses]=useState<ClassRow[]>([]);
  const[role,setRole]=useState('');
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');
  const[form,setForm]=useState({name:'',gender:'',birth_place:'',birth_date:'',phone:'',address:'',level_id:'',class_id:'',notes:'',category_ids:[] as string[]});

  useEffect(()=>{Promise.all([fetch('/api/categories').then(r=>r.json()),fetch('/api/levels').then(r=>r.json()),fetch('/api/classes').then(r=>r.json()),fetch('/api/auth/me').then(r=>r.json())]).then(([c,l,k,u])=>{setCats(c);setLevels(l);setClasses(k);setRole(u.role??'')})},[]);
  const toggle=(id:string)=>setForm(v=>({...v,category_ids:v.category_ids.includes(id)?v.category_ids.filter(x=>x!==id):[...v.category_ids,id]}));
  const visibleCats=useMemo(()=>role==='DEWAN_GURU'?cats.filter(c=>['caberawit','muda-mudi'].includes(c.slug)):cats,[cats,role]);
  const selectedSlugs=useMemo(()=>cats.filter(c=>form.category_ids.includes(c.id)).map(c=>c.slug),[cats,form.category_ids]);
  const classOptions=useMemo(()=>classes.filter(c=>selectedSlugs.includes('caberawit')?c.audience==='CABERAWIT':selectedSlugs.includes('muda-mudi')?c.audience==='MUDA_MUDI':false),[classes,selectedSlugs]);

  async function save(e:FormEvent){
    e.preventDefault();setSaving(true);setError('');
    const payload={...form,gender:form.gender||null,birth_place:form.birth_place||null,birth_date:form.birth_date||null,phone:form.phone||null,address:form.address||null,level_id:form.level_id||null,class_id:form.class_id||null,notes:form.notes||null};
    const r=await fetch('/api/members',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const j=await r.json();
    if(!r.ok){setError(j.error||'Gagal menyimpan data.');setSaving(false);return}
    window.location.href='/database';
  }

  return <>
    <div className="pageHeader"><div><h1>Tambah Data</h1></div></div>
    <form className="card" onSubmit={save}>
      <div className="formGrid">
        <label>Nama lengkap<input className="input" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
        <label>Jenis kelamin<select className="select" value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}><option value="">Pilih</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></label>
        <label>Tempat lahir<input className="input" value={form.birth_place} onChange={e=>setForm({...form,birth_place:e.target.value})}/></label>
        <label>Tanggal lahir<input className="input" type="date" value={form.birth_date} onChange={e=>setForm({...form,birth_date:e.target.value})}/></label>
        <label>Nomor HP<input className="input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
        <label>Jenjang<select className="select" value={form.level_id} onChange={e=>setForm({...form,level_id:e.target.value})}><option value="">Tanpa jenjang</option>{levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        {classOptions.length>0&&<label>Kelas<select className="select" value={form.class_id} onChange={e=>setForm({...form,class_id:e.target.value})}><option value="">Pilih kelas</option>{classOptions.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
        <label className="span2">Alamat<textarea className="textarea" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
      </div>
      <div className="section"><h2>Kategori</h2><div className="chips">{visibleCats.map(c=><button type="button" key={c.id} className={form.category_ids.includes(c.id)?'chip active':'chip'} onClick={()=>toggle(c.id)}>{c.name}</button>)}</div></div>
      {error&&<div className="notice error section">{error}</div>}
      <div className="formActions"><a className="btn ghost" href="/database">Batal</a><button className="btn" disabled={saving}>{saving?'Menyimpan…':'Simpan'}</button></div>
    </form>
  </>;
}
