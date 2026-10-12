'use client';

import Link from 'next/link';
import {FormEvent,useEffect,useState} from 'react';
import {Archive,FileSearch,ShieldCheck,Upload,Users,Activity,BrainCircuit,KeyRound} from 'lucide-react';

type Login={id:number;username:string;success:boolean;user_agent?:string;created_at:string};
type Health={checked_at:string;summary:any;checks:Array<{key:string;label:string;status:'OK'|'WARN'|'ERROR';detail:string}>};

export default function SettingsPage(){
  const[group,setGroup]=useState({name:'Kelompok Pengorgan',address:'',contact:'',timezone:'Asia/Jakarta'});
  const[manual,setManual]=useState({title:'Panduan Penggunaan Simpul',content:''});
  const[logins,setLogins]=useState<Login[]>([]);
  const[health,setHealth]=useState<Health|null>(null);
  const[saved,setSaved]=useState('');
  const[error,setError]=useState('');
  const[isAdmin,setIsAdmin]=useState(false);
  const[groq,setGroq]=useState({configured:false,model:'openai/gpt-oss-20b',enabled:true,updated_at:null as string|null,models:[] as Array<{id:string;label:string}>});
  const[groqKey,setGroqKey]=useState('');
  const[groqBusy,setGroqBusy]=useState(false);
  const[groqNotice,setGroqNotice]=useState('');

  useEffect(()=>{
    fetch('/api/auth/me').then(r=>r.json()).then(u=>{
      if(u.role==='ADMIN'){setIsAdmin(true);fetch('/api/ai/config',{cache:'no-store'}).then(r=>r.json()).then(v=>{
        if(!v.error)setGroq(v);
      }).catch(()=>{})}
    }).catch(()=>{});
    Promise.all([fetch('/api/settings').then(r=>r.json()),fetch('/api/login-history').then(r=>r.json()),fetch('/api/system-health').then(r=>r.ok?r.json():null)]).then(([s,l,h])=>{
      if(s.group_info)setGroup({...group,...s.group_info});
      if(s.usage_manual)setManual({...manual,...s.usage_manual});
      setLogins(Array.isArray(l)?l:[]);
      if(h?.checks)setHealth(h);
    });
  },[]);

  async function saveGroq(e:FormEvent){
    e.preventDefault();setGroqBusy(true);setGroqNotice('');
    try{
      const r=await fetch('/api/ai/config',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:groqKey,model:groq.model,enabled:groq.enabled})});
      const v=await r.json();if(!r.ok)throw Error(v.error||'Pengaturan AI gagal disimpan.');
      setGroq(v);setGroqKey('');setGroqNotice('Pengaturan Groq tersimpan dengan aman.');
    }catch(e){setGroqNotice((e as Error).message)}finally{setGroqBusy(false)}
  }
  async function testGroq(){
    setGroqBusy(true);setGroqNotice('');
    try{const r=await fetch('/api/ai/config',{method:'POST'});const v=await r.json();if(!r.ok)throw Error(v.error||'Tes gagal');setGroqNotice(v.message)}
    catch(e){setGroqNotice((e as Error).message)}finally{setGroqBusy(false)}
  }
  async function save(e:FormEvent){e.preventDefault();setSaved('');setError('');const r=await fetch('/api/settings',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({group_info:group,usage_manual:manual})});const j=await r.json();if(!r.ok){setError(j.error||'Gagal menyimpan.');return}setSaved('Pengaturan tersimpan.');}

  return <>
    <div className="pageHeader"><div><h1>Pengaturan</h1><p>Konfigurasi aplikasi dan kontrol Super Admin.</p></div></div>
    <section className="card adminControlPanel">
      <div className="cardHead"><div><h2>Kontrol Super Admin</h2><p>Akses cepat untuk pengguna, audit, impor, arsip, dan kesehatan sistem.</p></div><ShieldCheck size={22}/></div>
      <div className="adminControlGrid">
        <Link href="/tim-akses" className="adminControlItem"><Users size={18}/><span><strong>Akses Pengguna</strong><small>Role, izin, dan cakupan data</small></span></Link>
        <Link href="/audit" className="adminControlItem"><FileSearch size={18}/><span><strong>Audit Aktivitas</strong><small>Riwayat perubahan administrasi</small></span></Link>
        <Link href="/impor" className="adminControlItem"><Upload size={18}/><span><strong>Import Center</strong><small>Kelola impor data terstruktur</small></span></Link>
        <Link href="/arsip" className="adminControlItem"><Archive size={18}/><span><strong>Arsip</strong><small>Pulihkan atau tinjau data nonaktif</small></span></Link>
        <button type="button" className="adminControlItem" onClick={async()=>{const r=await fetch('/api/system-health',{cache:'no-store'});if(r.ok)setHealth(await r.json())}}><Activity size={18}/><span><strong>Periksa Sistem</strong><small>Refresh status layanan sekarang</small></span></button>
      </div>
    </section>
    {isAdmin&&<form className="card section" onSubmit={saveGroq} autoComplete="off">
      <div className="cardHead"><div><h2><BrainCircuit size={20} style={{verticalAlign:'middle',marginRight:8}}/>AI Groq untuk Jurnal</h2><p>Hanya admin utama yang mengatur API key. Guru cukup menulis jurnal; sistem mencocokkannya dengan target tanpa memberi nilai otomatis.</p></div><KeyRound size={22}/></div>
      <div className="formGrid">
        <label>API Key Groq (disimpan terenkripsi)<input className="input" type="password" name="groq_admin_key" autoComplete="new-password" placeholder={groq.configured?'Sudah tersimpan — kosongkan untuk mempertahankan':'Masukkan key berawalan gsk_'} value={groqKey} onChange={e=>setGroqKey(e.target.value)}/></label>
        <label>Model AI<select className="select" value={groq.model} onChange={e=>setGroq(v=>({...v,model:e.target.value}))}>{(groq.models.length?groq.models:[{id:'openai/gpt-oss-20b',label:'GPT-OSS 20B'}]).map(m=><option value={m.id} key={m.id}>{m.label}</option>)}</select></label>
        <label className="span2"><input type="checkbox" checked={groq.enabled} onChange={e=>setGroq(v=>({...v,enabled:e.target.checked}))}/> Aktifkan analisis jurnal menggunakan AI</label>
      </div>
      <div className="formActions" style={{flexWrap:'wrap'}}>
        <button className="btn" type="submit" disabled={groqBusy}>{groqBusy?'Memproses…':'Simpan pengaturan Groq'}</button>
        <button className="btn ghost" type="button" disabled={groqBusy||!groq.configured} onClick={()=>void testGroq()}>Tes koneksi</button>
      </div>
      <p className="journalFieldHint">Status: {groq.configured?'API key sudah tersimpan':'Belum dikonfigurasi'} · API key tidak ditampilkan kembali setelah disimpan.</p>
      {groqNotice&&<div className="notice" role="status">{groqNotice}</div>}
    </form>}
    <form className="card section" onSubmit={save}>
      <h2>Identitas Kelompok</h2>
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
