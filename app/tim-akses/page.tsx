'use client';

import { FormEvent, useEffect, useState } from 'react';

type Role='ADMIN'|'DEWAN_GURU'|'KELOMPOK'|'VIEWER';
type TeamUser={id:string;username:string;display_name:string|null;role:Role;active:boolean;created_at:string};

const roleInfo:Record<Role,{label:string;desc:string}> = {
  ADMIN:{label:'Admin Utama',desc:'Akses penuh termasuk Tim Akses dan seluruh data.'},
  DEWAN_GURU:{label:'Dewan Guru',desc:'Akses Caberawit dan Muda-Mudi beserta presensi, jurnal, perkembangan, rekap, dan laporan terkait.'},
  KELOMPOK:{label:'Kelompok',desc:'Akses data dan kegiatan Kelompok, termasuk Muda-Mudi dalam konteks kelompok.'},
  VIEWER:{label:'Viewer',desc:'Akses baca tanpa hak menambah, mengubah, atau menghapus data.'},
};

export default function TeamPage(){
  const[data,setData]=useState<TeamUser[]>([]);
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
      <div><div className="eyebrow">Pengaturan Akses</div><h1>Tim Akses</h1><p>Kelola siapa yang dapat masuk ke Aeroo dan batasi menu sesuai tanggung jawabnya.</p></div>
      <button className="btn" onClick={()=>setShowForm(v=>!v)}>{showForm?'Tutup Form':'+ Tambah Akun'}</button>
    </div>

    <div className="grid">
      {(Object.keys(roleInfo) as Role[]).map(role=><div className="card" key={role}>
        <span className="badge">{roleInfo[role].label}</span>
        <p style={{margin:'12px 0 0',fontSize:13,lineHeight:1.6,color:'var(--muted)'}}>{roleInfo[role].desc}</p>
      </div>)}
    </div>

    {showForm&&<form onSubmit={createUser} className="card section">
      <div className="sectionTitle"><div><h2>Tambah akun tim</h2><p>Tidak ada menu daftar. Hanya admin yang dapat membuat akun baru.</p></div></div>
      <div className="formGrid">
        <label>Nama tampilan<input className="input" value={form.display_name} onChange={e=>setForm({...form,display_name:e.target.value})} placeholder="Contoh: Dewan Guru 1"/></label>
        <label>Username<input className="input" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="Minimal 3 karakter" required/></label>
        <label>Password<input className="input" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Minimal 8 karakter" required/></label>
        <label>Role<select className="select" value={form.role} onChange={e=>setForm({...form,role:e.target.value as Role})}>
          <option value="DEWAN_GURU">Dewan Guru</option><option value="KELOMPOK">Kelompok</option><option value="VIEWER">Viewer</option><option value="ADMIN">Admin Utama</option>
        </select></label>
      </div>
      <button className="btn" disabled={saving} style={{marginTop:18}}>{saving?'Menyimpan…':'Buat Akun'}</button>
    </form>}

    {error&&<div className="notice error section" role="alert">{error}</div>}

    <section className="section">
      <div className="sectionTitle"><div><h2>Daftar akun</h2><p>{loading?'Memuat akun…':data.length+' akun terdaftar'}</p></div></div>
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
  </>;
}
