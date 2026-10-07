'use client';
import {FormEvent,useEffect,useState} from 'react';

type Role='ADMIN'|'DEWAN_GURU'|'KELOMPOK'|'VIEWER';
type TeamUser={id:string;username:string;display_name:string|null;role:Role;active:boolean;created_at:string};
type Visit={id:string;display_name:string|null;device:string;visited_at:string};
type Scope={audience:string;can_read:boolean;can_write:boolean};
type Permission={permission:string;allowed:boolean};
type ClassScope={class_id:string;can_read:boolean;can_write:boolean;classes?:{name?:string}|null}|null;
type CabClass={id:string;name:string};

const roleInfo:Record<Role,{label:string;desc:string;pages:string[]}>={
  ADMIN:{label:'Admin',desc:'Akses penuh seluruh data, akun, audit dan pengaturan.',pages:['Semua menu','Semua Caberawit','Semua data & laporan']},
  DEWAN_GURU:{label:'Dewan Guru',desc:'Dipisah per kelas Caberawit. Bisa diberi akses seluruh Caberawit secara khusus.',pages:['Database sesuai kelas','Presensi sesuai kelas','Jurnal sesuai kelas','Target & progres sesuai akses','Catatan']},
  KELOMPOK:{label:'Operator Kelompok',desc:'Kelola operasional Kelompok, Ibu-Ibu dan Pengurus. Scope lain harus diizinkan Admin.',pages:['Database','Agenda','Presensi','Jurnal','Dapukan & Pengurus','Rekap','Catatan']},
  VIEWER:{label:'Viewer',desc:'Baca saja. Tidak dapat mengubah data.',pages:['Beranda','Database','Presensi','Jurnal','Agenda','Rekap','Laporan']},
};
const audiences=[['KELOMPOK','Semua Anggota'],['CABERAWIT','Caberawit'],['MUDA_MUDI','Muda-Mudi'],['IBU_IBU','Ibu-Ibu'],['PENGURUS','Pengurus']] as const;
const permissionLabels:Record<string,string>={
  'person.read':'Lihat anggota','person.write':'Kelola anggota',
  'agenda.read':'Lihat agenda','agenda.write':'Kelola agenda',
  'attendance.read':'Lihat presensi','attendance.write':'Kelola presensi',
  'journal.read':'Lihat jurnal','journal.write':'Kelola jurnal',
  'target.read':'Lihat target','target.write':'Kelola target',
  'position.read':'Lihat pengurus','position.write':'Kelola pengurus','decision.write':'Kelola keputusan',
  'report.read':'Lihat laporan','report.publish':'Publikasi laporan',
  'note.read':'Lihat catatan bersama','note.write':'Kelola catatan bersama',
  'import.manage':'Kelola import','archive.manage':'Kelola arsip','user.manage':'Kelola akun','settings.manage':'Pengaturan sistem'
};
function defaults(role:Role):Scope[]{
  const read=role==='ADMIN'?audiences.map(x=>x[0]):role==='KELOMPOK'?['KELOMPOK','MUDA_MUDI','IBU_IBU','PENGURUS']:role==='VIEWER'?['KELOMPOK','CABERAWIT','MUDA_MUDI','IBU_IBU']:[];
  const write=role==='ADMIN'?audiences.map(x=>x[0]):role==='KELOMPOK'?['KELOMPOK','IBU_IBU','PENGURUS']:[];
  return audiences.map(([audience])=>({audience,can_read:read.includes(audience as any),can_write:write.includes(audience as any)}));
}

export default function TeamPage(){
  const[data,setData]=useState<TeamUser[]>([]),[visits,setVisits]=useState<Visit[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const[showForm,setShowForm]=useState(false),[form,setForm]=useState({username:'',display_name:'',password:'',role:'VIEWER' as Role}),[saving,setSaving]=useState(false);
  const[editUser,setEditUser]=useState<TeamUser|null>(null),[editForm,setEditForm]=useState({display_name:'',role:'VIEWER' as Role,active:true,new_password:''}),[editSaving,setEditSaving]=useState(false);
  const[accessUser,setAccessUser]=useState<TeamUser|null>(null),[scopes,setScopes]=useState<Scope[]>([]),[permStates,setPermStates]=useState<Record<string,'inherit'|'allow'|'deny'>>({}),[availablePerms,setAvailablePerms]=useState<string[]>([]),[accessSaving,setAccessSaving]=useState(false);
  const[cabClasses,setCabClasses]=useState<CabClass[]>([]),[cabMode,setCabMode]=useState<'ONE'|'ALL'|'NONE'>('NONE'),[classScope,setClassScope]=useState<ClassScope>(null);

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
  function openEdit(user:TeamUser){setEditUser(user);setEditForm({display_name:user.display_name||'',role:user.role,active:user.active,new_password:''});setError('')}
  async function saveEdit(){if(!editUser)return;setEditSaving(true);setError('');const r=await fetch('/api/team/'+editUser.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({...editForm,new_password:editForm.new_password||null})});const j=await r.json();setEditSaving(false);if(!r.ok){setError(j.error||'Gagal memperbarui akun.');return}setEditUser(null);await load()}
  async function setActive(user:TeamUser,active:boolean){const r=await fetch('/api/team/'+user.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({display_name:user.display_name??'',role:user.role,active,new_password:null})});const j=await r.json();if(!r.ok){setError(j.error||'Gagal memperbarui akun.');return}await load()}

  async function openAccess(user:TeamUser){
    setError('');const r=await fetch('/api/team/'+user.id+'/access',{cache:'no-store'});const j=await r.json();if(!r.ok){setError(j.error||'Akses tidak dapat dimuat.');return}
    const explicit=j.scopes as Scope[];const nextScopes=explicit.length?audiences.map(([a])=>explicit.find(x=>x.audience===a)||{audience:a,can_read:false,can_write:false}):defaults(user.role);
    setScopes(nextScopes);setAvailablePerms(j.available_permissions||[]);setPermStates(Object.fromEntries((j.permissions as Permission[]).map(x=>[x.permission,x.allowed?'allow':'deny'])));
    setCabClasses(j.caberawit_classes||[]);setClassScope(j.class_scope||null);
    const globalCab=nextScopes.find(x=>x.audience==='CABERAWIT');
    setCabMode(user.role!=='DEWAN_GURU'?'NONE':globalCab?.can_read||globalCab?.can_write?'ALL':j.class_scope?'ONE':'NONE');
    setAccessUser(user);
  }
  function updateScope(audience:string,key:'can_read'|'can_write',value:boolean){setScopes(v=>v.map(x=>x.audience===audience?{...x,[key]:value,...(key==='can_write'&&value?{can_read:true}:{})}:x))}
  function setCaberawitMode(mode:'ONE'|'ALL'|'NONE'){
    setCabMode(mode);
    if(mode==='ALL'){setClassScope(null);setScopes(v=>v.map(x=>x.audience==='CABERAWIT'?{...x,can_read:true,can_write:true}:x))}
    else {setScopes(v=>v.map(x=>x.audience==='CABERAWIT'?{...x,can_read:false,can_write:false}:x));if(mode==='NONE')setClassScope(null)}
  }
  async function saveAccess(){
    if(!accessUser)return;setAccessSaving(true);setError('');
    const permissions=Object.entries(permStates).filter(([,v])=>v!=='inherit').map(([permission,v])=>({permission,allowed:v==='allow'}));
    const normalizedClass=accessUser.role==='DEWAN_GURU'&&cabMode==='ONE'&&classScope?.class_id?{class_id:classScope.class_id,can_read:true,can_write:classScope.can_write!==false}:null;
    const r=await fetch('/api/team/'+accessUser.id+'/access',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({scopes,class_scope:normalizedClass,permissions})});const j=await r.json();setAccessSaving(false);
    if(!r.ok){setError(j.error||'Akses gagal disimpan.');return}setAccessUser(null);
  }

  return <><div className="pageHeader"><div><h1>Akses</h1><p>Role menentukan menu dasar. Scope menentukan data yang benar-benar boleh dibaca atau diubah.</p></div><button className="btn" onClick={()=>setShowForm(v=>!v)}>{showForm?'Tutup':'+ Akun'}</button></div>
    <section className="roleMatrix">{(Object.keys(roleInfo) as Role[]).map(r=><article className="card rolePolicyCard" key={r}><strong>{roleInfo[r].label}</strong><p>{roleInfo[r].desc}</p><div className="chips">{roleInfo[r].pages.map(x=><span className="chip" key={x}>{x}</span>)}</div></article>)}</section>
    {showForm&&<form onSubmit={createUser} className="card section"><div className="formGrid"><label>Nama<input className="input" value={form.display_name} onChange={e=>setForm({...form,display_name:e.target.value})}/></label><label>Username<input className="input" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} required/></label><label>Password<input className="input" type="password" minLength={8} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/></label><label>Role<select className="select" value={form.role} onChange={e=>setForm({...form,role:e.target.value as Role})}><option value="DEWAN_GURU">Dewan Guru</option><option value="KELOMPOK">Operator Kelompok</option><option value="VIEWER">Viewer</option><option value="ADMIN">Admin</option></select></label></div><button className="btn section" disabled={saving}>{saving?'Menyimpan…':'Buat Akun'}</button></form>}
    {error&&<div className="notice error section">{error}</div>}
    <section className="section"><div className="cardHead"><h2>Daftar Akun</h2><span className="itemMeta">{loading?'Memuat…':data.length+' akun'}</span></div><div className="list">{data.map(user=><div className="item row between" key={user.id}><div className="row"><div className="avatar">{user.username.slice(0,2).toUpperCase()}</div><div><div className="itemTitle">{user.display_name||user.username}</div><div className="itemMeta">@{user.username} · {roleInfo[user.role].label}</div></div></div><div className="row accountActions"><button className="smallAction" onClick={()=>openEdit(user)}>Edit</button><button className="smallAction" onClick={()=>void openAccess(user)}>Atur Akses</button><button className={user.active?'smallAction':'smallAction danger'} onClick={()=>void setActive(user,!user.active)}>{user.active?'Nonaktifkan':'Aktifkan'}</button></div></div>)}</div></section>
    <section className="section"><div className="cardHead"><h2>Kunjungan Viewer</h2></div><div className="tableWrap"><table className="table"><thead><tr><th>Waktu</th><th>Nama</th><th>Perangkat</th></tr></thead><tbody>{visits.map(v=><tr key={v.id}><td>{new Date(v.visited_at).toLocaleString('id-ID')}</td><td>{v.display_name||'Anonim'}</td><td>{v.device.slice(0,90)}</td></tr>)}{!visits.length&&<tr><td colSpan={3}>Belum ada kunjungan.</td></tr>}</tbody></table></div></section>

    {editUser&&<div className="dialogBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!editSaving)setEditUser(null)}}><div className="dialogCard accountEditDialog" role="dialog" aria-modal="true"><div className="cardHead"><div><h2>Edit Akun</h2><span className="itemMeta">@{editUser.username}</span></div><button className="smallAction" onClick={()=>setEditUser(null)} disabled={editSaving}>Tutup</button></div><div className="formGrid"><label>Nama<input className="input" value={editForm.display_name} onChange={e=>setEditForm({...editForm,display_name:e.target.value})}/></label><label>Role<select className="select" value={editForm.role} onChange={e=>setEditForm({...editForm,role:e.target.value as Role})}><option value="ADMIN">Admin</option><option value="DEWAN_GURU">Dewan Guru</option><option value="KELOMPOK">Operator Kelompok</option><option value="VIEWER">Viewer</option></select></label><label>Status<select className="select" value={editForm.active?'ACTIVE':'INACTIVE'} onChange={e=>setEditForm({...editForm,active:e.target.value==='ACTIVE'})}><option value="ACTIVE">Aktif</option><option value="INACTIVE">Nonaktif</option></select></label><label>Password baru<input className="input" type="password" minLength={8} value={editForm.new_password} onChange={e=>setEditForm({...editForm,new_password:e.target.value})} placeholder="Kosongkan jika tidak diubah"/></label></div><div className="formActions"><button className="btn" disabled={editSaving} onClick={()=>void saveEdit()}>{editSaving?'Menyimpan…':'Simpan Akun'}</button></div></div></div>}

    {accessUser&&<div className="dialogBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!accessSaving)setAccessUser(null)}}><div className="dialogCard accessDialog" role="dialog" aria-modal="true"><div className="cardHead"><div><h2>{accessUser.display_name||accessUser.username}</h2><span className="itemMeta">{roleInfo[accessUser.role].label} · {roleInfo[accessUser.role].desc}</span></div><button className="smallAction" onClick={()=>setAccessUser(null)}>Tutup</button></div>
      {accessUser.role==='DEWAN_GURU'&&<section className="section card accessSubCard"><div className="cardHead"><div><h3>Akses Caberawit</h3><p className="itemMeta">Satu Dewan Guru hanya memegang satu kelas. Akses seluruh Caberawit harus dipilih khusus.</p></div></div><div className="accessModeGrid"><button type="button" className={cabMode==='ONE'?'smallAction active':'smallAction'} onClick={()=>setCaberawitMode('ONE')}>Satu kelas</button><button type="button" className={cabMode==='ALL'?'smallAction active':'smallAction'} onClick={()=>setCaberawitMode('ALL')}>Seluruh Caberawit</button><button type="button" className={cabMode==='NONE'?'smallAction active':'smallAction'} onClick={()=>setCaberawitMode('NONE')}>Tidak ada</button></div>{cabMode==='ONE'&&<div className="formGrid section"><label>Kelas Caberawit<select className="select" value={classScope?.class_id||''} onChange={e=>setClassScope(e.target.value?{class_id:e.target.value,can_read:true,can_write:true}:null)}><option value="">Pilih kelas</option>{cabClasses.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label><input type="checkbox" checked={classScope?.can_write!==false} onChange={e=>setClassScope(v=>v?{...v,can_write:e.target.checked,can_read:true}:v)}/> Boleh mengisi presensi, jurnal, progres dan catatan kelas</label></div>}</section>}
      <h3>Lingkup Program</h3><div className="scopeTable section">{scopes.map(x=><div className="scopeRow" key={x.audience}><strong>{audiences.find(a=>a[0]===x.audience)?.[1]||x.audience}</strong><label><input type="checkbox" checked={x.can_read} disabled={accessUser.role==='DEWAN_GURU'&&x.audience==='CABERAWIT'} onChange={e=>updateScope(x.audience,'can_read',e.target.checked)}/> Baca</label><label><input type="checkbox" checked={x.can_write} disabled={accessUser.role==='DEWAN_GURU'&&x.audience==='CABERAWIT'} onChange={e=>updateScope(x.audience,'can_write',e.target.checked)}/> Tulis</label></div>)}</div>
      <details className="section"><summary>Permission per fitur</summary><div className="permissionGrid section">{availablePerms.map(p=><label key={p}>{permissionLabels[p]||p}<select className="select" value={permStates[p]||'inherit'} onChange={e=>setPermStates(v=>({...v,[p]:e.target.value as any}))}><option value="inherit">Ikuti role</option><option value="allow">Izinkan</option><option value="deny">Tolak</option></select></label>)}</div></details>
      <div className="formActions"><button className="btn" disabled={accessSaving||(accessUser.role==='DEWAN_GURU'&&cabMode==='ONE'&&!classScope?.class_id)} onClick={()=>void saveAccess()}>{accessSaving?'Menyimpan…':'Simpan Akses'}</button></div>
    </div></div>}
  </>;
}
