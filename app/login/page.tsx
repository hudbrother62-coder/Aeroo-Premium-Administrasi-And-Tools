'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useState } from 'react';

export default function LoginPage(){
  const[username,setUsername]=useState('');
  const[password,setPassword]=useState('');
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');

  useEffect(()=>{fetch('/api/auth/me').then(r=>{if(r.ok)window.location.href='/'})},[]);

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
      <Image src="/aeroo-logo.svg" alt="AEROO" width={520} height={450} priority/>
    </section>
    <section className="loginPanel">
      <form className="loginCard" onSubmit={submit}>
        <h1>Masuk</h1>
        <label>Username<input className="input" value={username} autoComplete="username" onChange={e=>setUsername(e.target.value)}/></label>
        <label>Password<input className="input" type="password" value={password} autoComplete="current-password" onChange={e=>setPassword(e.target.value)}/></label>
        {error&&<div className="notice error">{error}</div>}
        <button className="btn" disabled={loading}>{loading?'Memeriksa…':'Masuk'}</button>
      </form>
    </section>
  </main>;
}
