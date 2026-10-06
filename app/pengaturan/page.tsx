'use client';

import Link from 'next/link';
import {FormEvent,useEffect,useState} from 'react';

type Login={id:number;username:string;success:boolean;user_agent?:string;created_at:string};
type Health={checked_at:string;summary:any;checks:Array<{key:string;label:string;status:'OK'|'WARN'|'ERROR';detail:string}>};

export default function SettingsPage(){
  const[group,setGroup]=useState({name:'Kelompok Pengorgan',address:'',contact:'',timezone:'Asia/Jakarta'});
  const[manual,setManual]=useState({title:'Panduan Penggunaan AIRO',content:''});
  const[logins,setLogins]=useState<Login[]>([]);
  const[health,setHealth]=useState<Health|null>(null);
  const[saved,setSaved]=useState('');
  const[error,setError]=useState('');

  useEffect(()=>{
    Promise.all([fetch('/api/settings').then(r=>r.json()),fetch('/api/login-history').then(r=>r.json()),fetch('/api/system-health').then(r=>r.ok?r.json():null)]).then(([s,l,h])=>{
      if(s.group_info)setGroup({...group,...s.group_info});
      if(s.usage_manual)setManual({...manual,...s.usage_manual});
      setLogins(Array.isArray(l)?l:[]);
      if(h?.checks)setHealth(h);
    });
  },[]);

  async function save(e:FormEvent){e.preventDefault();setSaved('');setError('');const r=await fetch('/api/settings',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({group_info:group,usage_manual:manual})});const j=await r.json();if(!r.ok){setError(j.error||'Gagal menyimpan.');return}setSaved('Pengaturan tersimpan.');}

  return <>
    <div className="pageHeader"><div><h1>Pengaturan</h1></div><Link className="btn ghost" href="/tim-akses">Akses</Link></div>
    <form className="card" onSubmit={save}>
      <h2>Kelompok Pengorgan</h2>
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
      <div className="cardHead"><h2>System Health</h2><button className="smallAction" onClick={async()=>{const r=await fetch('/api/system-health',{cache:'no-store'});if(r.ok)setHealth(await r.json())}}>Periksa</button></div>
      <div className="healthGrid">
        {health?.checks.map(x=><div className="healthCard" key={x.key}><div className="row between"><strong>{x.label}</strong><span className={x.status==='OK'?'badge successBadge':'badge warningBadge'}>{x.status}</span></div><p>{x.detail}</p></div>)}
        {!health&&<div className="emptyState">Status sistem belum tersedia.</div>}
      </div>
    </section>
    <section className="section">
      <div className="cardHead"><h2>Riwayat Login</h2></div>
      <div className="tableWrap"><table className="table"><thead><tr><th>Waktu</th><th>Akun</th><th>Status</th><th>Perangkat</th></tr></thead><tbody>
        {logins.map(x=><tr key={x.id}><td>{new Date(x.created_at).toLocaleString('id-ID')}</td><td>{x.username}</td><td>{x.success?'Berhasil':'Gagal'}</td><td>{x.user_agent?.slice(0,80)||'-'}</td></tr>)}
        {!logins.length&&<tr><td colSpan={4}>Belum ada riwayat login.</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
