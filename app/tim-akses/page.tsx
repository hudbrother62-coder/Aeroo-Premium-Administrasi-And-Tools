'use client';

import { FormEvent, useEffect, useState } from 'react';

type Role='ADMIN'|'DEWAN_GURU'|'KELOMPOK'|'VIEWER';
type TeamUser={id:string;username:string;display_name:string|null;role:Role;active:boolean;created_at:string};
type Visit={id:string;display_name:string|null;device:string;visited_at:string};

const roleInfo:Record<Role,{label:string;desc:string}> = {
  ADMIN:{label:'Admin',desc:'Akses sistem penuh.'},
  DEWAN_GURU:{label:'Dewan Guru',desc:'Kelola Caberawit dan Muda-Mudi sesuai scope.'},
  KELOMPOK:{label:'Operator',desc:'Kelola operasional Kelompok Pengorgan dan Ibu-Ibu sesuai scope.'},
  VIEWER:{label:'Viewer',desc:'Baca saja pada data yang diizinkan.'},
};

export default function TeamPage(){
  const[data,setData]=useState<TeamUser[]>([]);
  const[visits,setVisits]=useState<Visit[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  const[showForm,setShowForm]=useState(false);
  const[form,setForm]=useState({username:'',display_name:'',password:'',role:'VIEWER' as Role});
  const[saving,setSaving]=useState(false);

  async function load(){
    setLoading(true);setError('');
    const r=await fetch('/api/team');
    const j=await r.json();
    if(!r.ok){setError(j.error||'Tidak dapat membuka Tim Akses.');setLoading(false);return}
    setData(j);setLoading(false);
    fetch('/api/viewer-visits').then(r=>r.json()).then(v=>Array.isArray(v)&&setVisits(v)).catch(()=>{});
  }
  useEffect(()=>{void load()},[]);

  async function createUser(e:FormEvent){
    e.preventDefault();setSaving(true);setError('');
    try{
      const r=await fetch('/api/team',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(form)});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||'Gagal membuat akun.');
      setForm({username:'',display_name:'',password:'',role:'VIEWER'});
      setShowForm(false);
      await load();
    }catch(e){setError(e instanceof Error?e.message:'Gagal membuat akun.')}finally{setSaving(false)}
  }

  async function setActive(user:TeamUser,active:boolean){
    setError('');
    const r=await fetch('/api/team/'+user.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({
      display_name:user.display_name??'',role:user.role,active,new_password:null
    })});
    const j=await r.json();
    if(!r.ok){setError(j.error||'Gagal memperbarui akun.');return}
    await load();
  }

  return <>
    <div className="pageHeader">
      <h1>Akses</h1>
      <button className="btn" onClick={()=>setShowForm(v=>!v)}>{showForm?'Tutup Form':'+ Tambah Akun'}</button>
    </div>

    <div className="grid">
      {(Object.keys(roleInfo) as Role[]).map(role=><div className="card" key={role}>
        <span className="badge">{roleInfo[role].label}</span>
        <p style={{margin:'12px 0 0',fontSize:13,lineHeight:1.6,color:'var(--muted)'}}>{roleInfo[role].desc}</p>
      </div>)}
    </div>

    {showForm&&<form onSubmit={createUser} className="card section">
      <div className="sectionTitle"><h2>Tambah Akun</h2></div>
      <div className="formGrid">
        <label>Nama tampilan<input className="input" value={form.display_name} onChange={e=>setForm({...form,display_name:e.target.value})} placeholder="Contoh: Dewan Guru 1"/></label>
        <label>Username<input className="input" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="Minimal 3 karakter" required/></label>
        <label>Password<input className="input" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Minimal 8 karakter" required/></label>
        <label>Role<select className="select" value={form.role} onChange={e=>setForm({...form,role:e.target.value as Role})}>
          <option value="DEWAN_GURU">Dewan Guru</option><option value="KELOMPOK">Operator</option><option value="VIEWER">Viewer</option><option value="ADMIN">Admin Utama</option>
        </select></label>
      </div>
      <button className="btn" disabled={saving} style={{marginTop:18}}>{saving?'Menyimpan…':'Buat Akun'}</button>
    </form>}

    {error&&<div className="notice error section" role="alert">{error}</div>}

    <section className="section">
      <div className="sectionTitle"><h2>Daftar Akun</h2><span className="itemMeta">{loading?'Memuat…':data.length+' akun'}</span></div>
      <div className="list">
        {loading?[1,2].map(i=><div className="item" key={i}><div className="skeleton" style={{height:56}}/></div>):
        data.map(user=><div className="item row between" key={user.id}>
          <div className="row" style={{minWidth:0}}>
            <div className="avatar">{user.username.slice(0,2).toUpperCase()}</div>
            <div style={{minWidth:0}}><div className="itemTitle">{user.display_name||user.username}</div><div className="itemMeta">@{user.username} · {roleInfo[user.role].label}</div></div>
          </div>
          <button className={user.active?'btn secondary':'btn ghost'} onClick={()=>void setActive(user,!user.active)}>{user.active?'Aktif':'Nonaktif'}</button>
        </div>)}
      </div>
    </section>
    <section className="section"><div className="sectionTitle"><h2>Kunjungan Viewer</h2></div><div className="tableWrap"><table className="table"><thead><tr><th>Waktu</th><th>Nama</th><th>Perangkat</th></tr></thead><tbody>{visits.map(v=><tr key={v.id}><td>{new Date(v.visited_at).toLocaleString('id-ID')}</td><td>{v.display_name||'Anonim'}</td><td>{v.device.slice(0,120)}</td></tr>)}{!visits.length&&<tr><td colSpan={3}>Belum ada kunjungan.</td></tr>}</tbody></table></div></section>
  </>;
}
