'use client';

import Link from 'next/link';
import {FormEvent,useEffect,useState} from 'react';

type Login={id:number;username:string;success:boolean;user_agent?:string;created_at:string};

export default function SettingsPage(){
  const[group,setGroup]=useState({name:'Kelompok Zam Zam',address:'',contact:'',timezone:'Asia/Jakarta'});
  const[manual,setManual]=useState({title:'Panduan Penggunaan AEROO',content:''});
  const[logins,setLogins]=useState<Login[]>([]);
  const[saved,setSaved]=useState('');
  const[error,setError]=useState('');

  useEffect(()=>{
    Promise.all([fetch('/api/settings').then(r=>r.json()),fetch('/api/login-history').then(r=>r.json())]).then(([s,l])=>{
      if(s.group_info)setGroup({...group,...s.group_info});
      if(s.usage_manual)setManual({...manual,...s.usage_manual});
      setLogins(Array.isArray(l)?l:[]);
    });
  },[]);

  async function save(e:FormEvent){e.preventDefault();setSaved('');setError('');const r=await fetch('/api/settings',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({group_info:group,usage_manual:manual})});const j=await r.json();if(!r.ok){setError(j.error||'Gagal menyimpan.');return}setSaved('Pengaturan tersimpan.');}

  return <>
    <div className="pageHeader"><div><h1>Pengaturan</h1></div><Link className="btn ghost" href="/tim-akses">Kelola Tim Akses</Link></div>
    <form className="card" onSubmit={save}>
      <h2>Informasi Kelompok Zam Zam</h2>
      <div className="formGrid">
        <label>Nama kelompok<input className="input" value={group.name} onChange={e=>setGroup({...group,name:e.target.value})}/></label>
        <label>Kontak<input className="input" value={group.contact} onChange={e=>setGroup({...group,contact:e.target.value})}/></label>
        <label className="span2">Alamat<textarea className="textarea" value={group.address} onChange={e=>setGroup({...group,address:e.target.value})}/></label>
      </div>
      <div className="section"><h2>Penggunaan Web Aplikasi</h2><textarea className="textarea" value={manual.content} onChange={e=>setManual({...manual,content:e.target.value})}/></div>
      {saved&&<div className="notice section">{saved}</div>}{error&&<div className="notice error section">{error}</div>}
      <div className="formActions"><button className="btn">Simpan Pengaturan</button></div>
    </form>
    <section className="section">
      <div className="cardHead"><div><h2>Riwayat Login</h2><p>100 aktivitas login terbaru.</p></div></div>
      <div className="tableWrap"><table className="table"><thead><tr><th>Waktu</th><th>Akun</th><th>Status</th><th>Perangkat</th></tr></thead><tbody>
        {logins.map(x=><tr key={x.id}><td>{new Date(x.created_at).toLocaleString('id-ID')}</td><td>{x.username}</td><td>{x.success?'Berhasil':'Gagal'}</td><td>{x.user_agent?.slice(0,80)||'-'}</td></tr>)}
        {!logins.length&&<tr><td colSpan={4}>Belum ada riwayat login.</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
