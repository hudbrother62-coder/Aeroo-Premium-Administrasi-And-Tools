'use client';

import Image from 'next/image';
import {FormEvent,useEffect,useState} from 'react';
import {ArrowRight,CheckCircle2,Link2,NotebookTabs} from 'lucide-react';

export default function LoginPage(){
  const[username,setUsername]=useState('');
  const[password,setPassword]=useState('');
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');

  useEffect(()=>{
    let mounted=true;
    fetch('/api/auth/me').then(async r=>{
      if(!r.ok)return;
      const me=await r.json();
      if(mounted&&me.id&&me.active&&!me.public)window.location.href='/';
    }).catch(()=>{});
    return()=>{mounted=false};
  },[]);

  async function submit(e:FormEvent){
    e.preventDefault();setLoading(true);setError('');
    try{
      const r=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password})});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||'Login gagal');
      window.location.href='/';
    }catch(e){setError(e instanceof Error?e.message:'Login gagal')}
    finally{setLoading(false)}
  }

  return <main className="loginPage">
    <section className="loginBrandPanel">
      <div className="loginOrb loginOrbOne"/>
      <div className="loginOrb loginOrbTwo"/>
      <div className="loginBrandContent">
        <div className="loginLogo"><Image src="/simpul-logo.webp" alt="" width={92} height={92} priority/><span><strong>Simpul</strong><small>Kelompok Pengorgan</small></span></div>
        <h2>Terhubung.<br/>Tertata. Selesai.</h2>
        <div className="loginFeatureRow">
          <span><Link2 size={16}/>Terhubung</span>
          <span><NotebookTabs size={16}/>Administrasi</span>
          <span><CheckCircle2 size={16}/>Tertata</span>
        </div>
      </div>
    </section>
    <section className="loginPanel">
      <form className="loginCard" onSubmit={submit}>
        <div className="loginCardBrand"><Image src="/simpul-logo.webp" alt="" width={54} height={54}/><div><strong>Simpul</strong><span>Masuk ke workspace</span></div></div>
        <div><h1>Masuk</h1><p>Gunakan akun yang sudah diberikan.</p></div>
        <label>Username<input className="input" value={username} autoComplete="username" onChange={e=>setUsername(e.target.value)} autoFocus/></label>
        <label>Password<input className="input" type="password" value={password} autoComplete="current-password" onChange={e=>setPassword(e.target.value)}/></label>
        {error&&<div className="notice error">{error}</div>}
        <button className="btn loginSubmit" disabled={loading}>{loading?'Memeriksa…':<>Masuk <ArrowRight size={17}/></>}</button>
      </form>
    </section>
  </main>;
}
