'use client';

import { FormEvent, useEffect, useState } from 'react';

export default function LoginPage() {
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    fetch('/api/auth/me').then(r=>{if(r.ok) window.location.href='/'});
  },[]);

  async function submit(e:FormEvent){
    e.preventDefault();
    setLoading(true);setError('');
    try{
      const r=await fetch('/api/auth/login',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({username,password})
      });
      const j=await r.json();
      if(!r.ok) throw new Error(j.error||'Login gagal.');
      window.location.href='/';
    }catch(e){
      setError(e instanceof Error?e.message:'Login gagal.');
    }finally{setLoading(false)}
  }

  return <main className="loginPage">
    <section className="loginVisual">
      <div className="loginBrandMark">A</div>
      <div className="eyebrow" style={{color:'rgba(255,255,255,.72)'}}>AEROO Premium Administrasi</div>
      <h1>Administrasi kelompok dalam satu sistem yang rapi.</h1>
      <p>Database, presensi, jurnal, perkembangan, rekap, dan laporan dengan akses sesuai peran tim.</p>
      <div className="loginPills">
        <span>Database terpusat</span><span>Akses berbasis peran</span><span>Mobile-first</span>
      </div>
    </section>

    <section className="loginPanel">
      <div className="loginCard">
        <div className="loginMiniBrand"><span className="brandMark"><span>A</span></span><div><strong>AEROO Premium</strong><small>Administrasi & Tools</small></div></div>
        <div style={{marginTop:28}}>
          <div className="eyebrow">Masuk ke aplikasi</div>
          <h2 style={{margin:'0 0 8px',fontSize:28,letterSpacing:'-.035em'}}>Selamat datang</h2>
          <p className="muted" style={{margin:0,lineHeight:1.6}}>Gunakan akun yang sudah dibuat oleh admin. Tidak tersedia pendaftaran umum.</p>
        </div>

        <form onSubmit={submit} className="loginForm">
          <label>Username
            <input className="input" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Masukkan username" />
          </label>
          <label>Password
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Masukkan password" />
          </label>
          {error&&<div className="notice error" role="alert">{error}</div>}
          <button className="btn" disabled={loading} type="submit" style={{width:'100%',minHeight:50}}>{loading?'Memeriksa akun…':'Masuk ke Aeroo'}</button>
        </form>
        <p className="loginHint">Akses aplikasi dikelola melalui menu <strong>Tim Akses</strong> oleh akun admin.</p>
      </div>
    </section>
  </main>;
}
