'use client';
import {FormEvent,useEffect,useState} from 'react';

type Role='ADMIN'|'DEWAN_GURU'|'KELOMPOK'|'VIEWER';
type TeamUser={id:string;username:string;display_name:string|null;role:Role;active:boolean;created_at:string};
type Visit={id:string;display_name:string|null;device:string;visited_at:string};
type Scope={audience:string;can_read:boolean;can_write:boolean};
type Permission={permission:string;allowed:boolean};

const roleInfo:Record<Role,{label:string;desc:string}>={
  ADMIN:{label:'Admin',desc:'Akses sistem penuh.'},
  DEWAN_GURU:{label:'Dewan Guru',desc:'Kelola Caberawit dan Muda-Mudi sesuai scope.'},
  KELOMPOK:{label:'Operator',desc:'Kelola operasional Kelompok Pengorgan dan Ibu-Ibu sesuai scope.'},
  VIEWER:{label:'Viewer',desc:'Baca saja pada data yang diizinkan.'},
};
const audiences=[['KELOMPOK','Semua Anggota'],['CABERAWIT','Caberawit'],['MUDA_MUDI','Muda-Mudi'],['IBU_IBU','Ibu-Ibu'],['PENGURUS','Pengurus']] as const;
const permissionLabels:Record<string,string>={
  'person.read':'Lihat anggota','person.write':'Kelola anggota',
  'attendance.read':'Lihat presensi','attendance.write':'Kelola presensi',
  'journal.read':'Lihat jurnal','journal.write':'Kelola jurnal',
  'target.read':'Lihat target','target.write':'Kelola target',
  'report.read':'Lihat laporan','report.publish':'Publikasi laporan',
  'archive.manage':'Kelola arsip','user.manage':'Kelola akun','settings.manage':'Pengaturan sistem'
};
function defaults(role:Role):Scope[]{
  const read=role==='ADMIN'?audiences.map(x=>x[0]):role==='DEWAN_GURU'?['CABERAWIT','MUDA_MUDI']:role==='KELOMPOK'?['KELOMPOK','MUDA_MUDI','IBU_IBU','PENGURUS']:role==='VIEWER'?['KELOMPOK','CABERAWIT','MUDA_MUDI','IBU_IBU']:[];
  const write=role==='ADMIN'?audiences.map(x=>x[0]):role==='DEWAN_GURU'?['CABERAWIT','MUDA_MUDI']:role==='KELOMPOK'?['KELOMPOK','IBU_IBU','PENGURUS']:[];
  return audiences.map(([audience])=>({audience,can_read:read.includes(audience as any),can_write:write.includes(audience as any)}));
}

export default function TeamPage(){
  const[data,setData]=useState<TeamUser[]>([]),[visits,setVisits]=useState<Visit[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const[showForm,setShowForm]=useState(false),[form,setForm]=useState({username:'',display_name:'',password:'',role:'VIEWER' as Role}),[saving,setSaving]=useState(false);
  const[accessUser,setAccessUser]=useState<TeamUser|null>(null),[scopes,setScopes]=useState<Scope[]>([]),[permStates,setPermStates]=useState<Record<string,'inherit'|'allow'|'deny'>>({}),[availablePerms,setAvailablePerms]=useState<string[]>([]),[accessSaving,setAccessSaving]=useState(false);

  async function load(){
    setLoading(true);setError('');
    const r=await fetch('/api/team');const j=await r.json();
    if(!r.ok){setError(j.error||'Akses tidak dapat dimuat.');setLoading(false);return}
    setData(j);setLoading(false);
    fetch('/api/viewer-visits').then(r=>r.json()).then(v=>Array.isArray(v)&&setVisits(v)).catch(()=>{});
  }
  useEffect(()=>{void load()},[]);

  async function createUser(e:FormEvent){
    e.preventDefault();setSaving(true);setError('');
    try{const r=await fetch('/api/team',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(form)});const j=await r.json();if(!r.ok)throw Error(j.error||'Gagal membuat akun.');setForm({username:'',display_name:'',password:'',role:'VIEWER'});setShowForm(false);await load()}
    catch(e){setError(e instanceof Error?e.message:'Gagal membuat akun.')}finally{setSaving(false)}
  }
  async function setActive(user:TeamUser,active:boolean){
    const r=await fetch('/api/team/'+user.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({display_name:user.display_name??'',role:user.role,active,new_password:null})});const j=await r.json();
    if(!r.ok){setError(j.error||'Gagal memperbarui akun.');return}await load();
  }
  async function openAccess(user:TeamUser){
    setError('');const r=await fetch('/api/team/'+user.id+'/access',{cache:'no-store'});const j=await r.json();if(!r.ok){setError(j.error||'Akses tidak dapat dimuat.');return}
    const explicit=j.scopes as Scope[];setScopes(explicit.length?audiences.map(([a])=>explicit.find(x=>x.audience===a)||{audience:a,can_read:false,can_write:false}):defaults(user.role));
    setAvailablePerms(j.available_permissions||[]);
    setPermStates(Object.fromEntries((j.permissions as Permission[]).map(x=>[x.permission,x.allowed?'allow':'deny'])));
    setAccessUser(user);
  }
  function updateScope(audience:string,key:'can_read'|'can_write',value:boolean){
    setScopes(v=>v.map(x=>x.audience===audience?{...x,[key]:value,...(key==='can_write'&&value?{can_read:true}:{})}:x));
  }
  async function saveAccess(){
    if(!accessUser)return;setAccessSaving(true);setError('');
    const permissions=Object.entries(permStates).filter(([,v])=>v!=='inherit').map(([permission,v])=>({permission,allowed:v==='allow'}));
    const r=await fetch('/api/team/'+accessUser.id+'/access',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({scopes,permissions})});const j=await r.json();setAccessSaving(false);
    if(!r.ok){setError(j.error||'Akses gagal disimpan.');return}setAccessUser(null);
  }

  return <><div className="pageHeader"><h1>Akses</h1><button className="btn" onClick={()=>setShowForm(v=>!v)}>{showForm?'Tutup':'+ Akun'}</button></div>
    {showForm&&<form onSubmit={createUser} className="card section"><div className="formGrid"><label>Nama<input className="input" value={form.display_name} onChange={e=>setForm({...form,display_name:e.target.value})}/></label><label>Username<input className="input" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} required/></label><label>Password<input className="input" type="password" minLength={8} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/></label><label>Role<select className="select" value={form.role} onChange={e=>setForm({...form,role:e.target.value as Role})}><option value="DEWAN_GURU">Dewan Guru</option><option value="KELOMPOK">Operator</option><option value="VIEWER">Viewer</option><option value="ADMIN">Admin</option></select></label></div><button className="btn section" disabled={saving}>{saving?'Menyimpan…':'Buat Akun'}</button></form>}
    {error&&<div className="notice error section">{error}</div>}
    <section className="section"><div className="cardHead"><h2>Daftar Akun</h2><span className="itemMeta">{loading?'Memuat…':data.length+' akun'}</span></div><div className="list">{data.map(user=><div className="item row between" key={user.id}><div className="row"><div className="avatar">{user.username.slice(0,2).toUpperCase()}</div><div><div className="itemTitle">{user.display_name||user.username}</div><div className="itemMeta">@{user.username} · {roleInfo[user.role].label}</div></div></div><div className="row"><button className="smallAction" onClick={()=>void openAccess(user)}>Atur Akses</button><button className={user.active?'smallAction':'smallAction danger'} onClick={()=>void setActive(user,!user.active)}>{user.active?'Aktif':'Nonaktif'}</button></div></div>)}</div></section>
    <section className="section"><div className="cardHead"><h2>Kunjungan Viewer</h2></div><div className="tableWrap"><table className="table"><thead><tr><th>Waktu</th><th>Nama</th><th>Perangkat</th></tr></thead><tbody>{visits.map(v=><tr key={v.id}><td>{new Date(v.visited_at).toLocaleString('id-ID')}</td><td>{v.display_name||'Anonim'}</td><td>{v.device.slice(0,90)}</td></tr>)}{!visits.length&&<tr><td colSpan={3}>Belum ada kunjungan.</td></tr>}</tbody></table></div></section>

    {accessUser&&<div className="dialogBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!accessSaving)setAccessUser(null)}}><div className="dialogCard accessDialog" role="dialog" aria-modal="true"><div className="cardHead"><div><h2>{accessUser.display_name||accessUser.username}</h2><span className="itemMeta">{roleInfo[accessUser.role].label}</span></div><button className="smallAction" onClick={()=>setAccessUser(null)}>Tutup</button></div>
      <h3>Lingkup</h3><div className="scopeTable section">{scopes.map(x=><div className="scopeRow" key={x.audience}><strong>{audiences.find(a=>a[0]===x.audience)?.[1]||x.audience}</strong><label><input type="checkbox" checked={x.can_read} onChange={e=>updateScope(x.audience,'can_read',e.target.checked)}/> Baca</label><label><input type="checkbox" checked={x.can_write} onChange={e=>updateScope(x.audience,'can_write',e.target.checked)}/> Tulis</label></div>)}</div>
      <details className="section"><summary>Permission Lanjutan</summary><div className="permissionGrid section">{availablePerms.map(p=><label key={p}>{permissionLabels[p]||p}<select className="select" value={permStates[p]||'inherit'} onChange={e=>setPermStates(v=>({...v,[p]:e.target.value as any}))}><option value="inherit">Ikuti role</option><option value="allow">Izinkan</option><option value="deny">Tolak</option></select></label>)}</div></details>
      <div className="formActions"><button className="btn" disabled={accessSaving} onClick={()=>void saveAccess()}>{accessSaving?'Menyimpan…':'Simpan Akses'}</button></div>
    </div></div>}
  </>;
}
