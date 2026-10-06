'use client';

import Link from 'next/link';
import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import {Archive,Download,FileUp,RotateCcw,Trash2,Users} from 'lucide-react';
import {type Role} from '@/lib/access';

type Member={member_memberships?:any[];revision?:number;level_id?:string;id:string;name:string;gender?:string;phone?:string;section?:string;status:string;class_id?:string;levels?:{name?:string};classes?:{name?:string};member_categories?:Array<{category_id:string;categories?:{name?:string;slug?:string}}>};
type ClassRow={id:string;name:string;audience:string;level_id?:string};
type Category={id:string;name:string;slug:string};
const tabs=[['ALL','Semua'],['CABERAWIT','Caberawit'],['MUDA_MUDI','Muda-Mudi'],['IBU_IBU','Ibu-Ibu']] as const;

export default function DatabasePage(){
  const[segment,setSegment]=useState('ALL'),[q,setQ]=useState(''),[classId,setClassId]=useState(''),[archived,setArchived]=useState(()=>typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('archived')==='1'),[levelId,setLevelId]=useState(''),[office,setOffice]=useState(''),[levels,setLevels]=useState<any[]>([]);
  const[data,setData]=useState<Member[]>([]),[classes,setClasses]=useState<ClassRow[]>([]),[categories,setCategories]=useState<Category[]>([]);
  const[role,setRole]=useState<Role|null>(null),[selected,setSelected]=useState<string[]>([]),[bulkCategories,setBulkCategories]=useState<string[]>([]),[bulkClass,setBulkClass]=useState('');
  const[showClass,setShowClass]=useState(false),[className,setClassName]=useState(''),[newClassLevel,setNewClassLevel]=useState(''),[showLevel,setShowLevel]=useState(false),[levelName,setLevelName]=useState(''),[edit,setEdit]=useState<Member|null>(null);
  const[editName,setEditName]=useState(''),[editSection,setEditSection]=useState(''),[editClass,setEditClass]=useState('');
  const[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const upload=useRef<HTMLInputElement>(null);
  const canWrite=role==='ADMIN'||role==='DEWAN_GURU'||role==='KELOMPOK';
  const canClass=role==='ADMIN'||role==='DEWAN_GURU';
  const visibleTabs=tabs.filter(([v])=>role==='DEWAN_GURU'?['ALL','CABERAWIT','MUDA_MUDI'].includes(v):role==='KELOMPOK'?['ALL','MUDA_MUDI','IBU_IBU'].includes(v):true);
  const classOptions=useMemo(()=>classes.filter(c=>segment==='ALL'||c.audience===segment),[classes,segment]);
  const allowedCategories=categories.filter(c=>['caberawit','muda-mudi','ibu-ibu'].includes(c.slug)&&(role==='ADMIN'||(role==='DEWAN_GURU'&&['caberawit','muda-mudi'].includes(c.slug))||(role==='KELOMPOK'&&['muda-mudi','ibu-ibu'].includes(c.slug))));

  async function load(){
    setLoading(true);setError('');
    const params=new URLSearchParams({segment,archived:archived?'1':'0'});
    if(q)params.set('q',q);if(classId)params.set('class_id',classId);if(levelId)params.set('level_id',levelId);if(office)params.set('office',office);
    try{
      const [r,c,g,u,l]=await Promise.all([fetch('/api/members?'+params),fetch('/api/classes'),fetch('/api/categories'),fetch('/api/auth/me'),fetch('/api/levels')]);
      if(!r.ok||!c.ok||!g.ok||!u.ok)throw new Error('Data tidak dapat dimuat.');
      setData(await r.json());setClasses(await c.json());setCategories(await g.json());setRole((await u.json()).role);setLevels(await l.json());
    }catch(e){setError(e instanceof Error?e.message:'Gagal memuat database.')}finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[segment,classId,archived,levelId]);
  useEffect(()=>{const create=new URLSearchParams(window.location.search).get('create');if(create==='class')setShowClass(true);if(create==='level')setShowLevel(true)},[]);
  useEffect(()=>setSelected([]),[segment,classId,archived,levelId]);

  async function action(id:string,kind:'archive'|'restore'|'delete'){
    if(!window.confirm(kind==='delete'?'Hapus permanen? Identitas anggota hilang, riwayat kegiatan tetap tersimpan.':kind==='archive'?'Arsipkan anggota ini?':'Pulihkan anggota dari arsip?'))return;
    setBusy(true);setMessage('');setError('');
    const r=await fetch('/api/members/'+id+(kind==='delete'?'?permanent=1':''),{method:kind==='restore'?'PATCH':'DELETE',headers:{'content-type':'application/json'},body:kind==='restore'?JSON.stringify({status:'ACTIVE'}):undefined});
    const j=await r.json();setBusy(false);
    if(!r.ok){setError(j.error||'Tindakan gagal.');return}
    setMessage(kind==='archive'?'Anggota dipindahkan ke arsip.':kind==='restore'?'Anggota dipulihkan.':'Data pribadi dihapus permanen.');await load();
  }
  async function addLevel(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');
    const r=await fetch('/api/levels',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:levelName})});
    const j=await r.json();setBusy(false);
    if(!r.ok){setError(j.error||'Jenjang gagal dibuat.');return}setLevelName('');setShowLevel(false);setMessage('Jenjang berhasil dibuat.');await load();
  }
  async function addClass(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');
    const r=await fetch('/api/classes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:className,level_id:newClassLevel||null,audience:segment==='MUDA_MUDI'?'MUDA_MUDI':'CABERAWIT'})});
    const j=await r.json();setBusy(false);
    if(!r.ok){setError(j.error||'Kelas gagal dibuat.');return}setClassName('');setShowClass(false);setMessage('Kelas berhasil dibuat.');await load();
  }
  async function saveEdit(e:FormEvent){
    e.preventDefault();if(!edit)return;setBusy(true);setError('');
    const r=await fetch('/api/members/'+edit.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:editName,section:editSection||null,class_id:editClass||null})});
    const j=await r.json();setBusy(false);
    if(!r.ok){setError(j.error||'Perubahan gagal.');return}setEdit(null);setMessage('Perubahan anggota tersimpan.');await load();
  }
  async function applyBulk(){
    if(!selected.length||(!bulkCategories.length&&!bulkClass))return;
    setBusy(true);setError('');
    const r=await fetch('/api/members/bulk',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({member_ids:selected,category_ids:bulkCategories,class_id:bulkClass||null})});
    const j=await r.json();setBusy(false);
    if(!r.ok){setError(j.error||'Perubahan massal gagal.');return}setSelected([]);setBulkCategories([]);setBulkClass('');setMessage(`${j.updated} anggota diperbarui.`);await load();
  }
  async function importExcel(file:File){
    setBusy(true);setError('');setMessage('Mengimpor data…');
    const form=new FormData();form.set('file',file);
    const r=await fetch('/api/members/spreadsheet',{method:'POST',body:form});const j=await r.json();setBusy(false);
    if(!r.ok){setError((j.error||'Impor gagal.')+(j.errors?.length?' '+j.errors.slice(0,8).join(' '):''));setMessage('');return}
    setMessage(`${j.inserted} anggota ditambah, ${j.updated||0} diperbarui.${j.errors.length?' '+j.errors.slice(0,4).join(' '):''}`);await load();
  }
  async function moveMember(id:string,to:string){
    if(!canWrite)return;const r=await fetch('/api/members/'+id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({...data.find(m=>m.id===id),memberships:data.find(m=>m.id===id)?.member_memberships?.filter(m=>m.active).map(m=>{const c=classes.find(c=>c.id===to);return m.categories?.slug===(c?.audience==='CABERAWIT'?'caberawit':'muda-mudi')?{...m,class_id:to,level_id:c?.level_id||null}:m})})});
    if(!r.ok){setError((await r.json()).error||'Gagal memindah kelas.');return}setMessage('Kelas anggota diperbarui.');await load();
  }
  async function moveSection(id:string,section:string){
    if(!canWrite)return;const r=await fetch('/api/members/'+id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({...data.find(m=>m.id===id),memberships:data.find(m=>m.id===id)?.member_memberships?.filter(m=>m.active).map(m=>m.categories?.slug==='pengurus'?{...m,section}:m)})});
    if(!r.ok){setError((await r.json()).error||'Gagal memindah bagian.');return}setMessage('Bagian pengurus diperbarui.');await load();
  }
  const selectAll=selected.length===data.length&&data.length>0;

  return <>
    <div className="pageHeader"><h1>Anggota</h1>{canWrite&&<Link className="btn" href="/database/tambah">+ Anggota</Link>}</div>
    <div className="tabBar section">{visibleTabs.map(([v,l])=><button key={v} className={segment===v?'tab active':'tab'} onClick={()=>{setSegment(v);setClassId('')}}>{l}</button>)}</div>
    <div className="toolbar card databaseTools"><input className="input" placeholder="Cari nama anggota…" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&void load()}/><select className="select" value={classId} onChange={e=>setClassId(e.target.value)}><option value="">Semua kelas</option>{classOptions.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select className="select" value={levelId} onChange={e=>setLevelId(e.target.value)}><option value="">Semua jenjang</option>{levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select><button className="btn secondary" onClick={()=>void load()}>Cari</button></div>
    <div className="databaseActions section"><button className={archived?'btn secondary':'btn ghost'} onClick={()=>setArchived(v=>!v)}><Archive size={16}/>{archived?'Lihat aktif':'Arsip'}</button>{canWrite&&<a className="btn ghost" href="/api/members/spreadsheet?template=1"><Download size={16}/>Template Excel</a>}<a className="btn ghost" href="/api/members/spreadsheet"><Download size={16}/>Export Excel</a><a className="btn ghost" href="/api/members/spreadsheet?format=csv"><Download size={16}/>CSV</a>{canWrite&&<><input hidden ref={upload} type="file" accept=".xlsx,.xls" onChange={e=>{const f=e.target.files?.[0];if(f)void importExcel(f);e.target.value=''}}/><button className="btn ghost" onClick={()=>upload.current?.click()} disabled={busy}><FileUp size={16}/>Import Excel</button></>}{canClass&&!archived&&<button className="btn ghost" onClick={()=>setShowLevel(v=>!v)}>{showLevel?'Tutup jenjang':'+ Jenjang'}</button>}{canClass&&!archived&&<button className="btn ghost" onClick={()=>setShowClass(v=>!v)}>{showClass?'Tutup kelas':'+ Kelas'}</button>}</div>
    {showLevel&&<form className="card section inlineForm" onSubmit={addLevel}><label>Nama jenjang<input className="input" required value={levelName} onChange={e=>setLevelName(e.target.value)} placeholder="Contoh: SD 1 atau Remaja"/></label><button className="btn" disabled={busy}>Simpan jenjang</button></form>}
    {showClass&&<form className="card section inlineForm" onSubmit={addClass}><label>Nama kelas<input className="input" required value={className} onChange={e=>setClassName(e.target.value)} placeholder="Contoh: SD 1 A"/></label><label>Jenjang<select className="select" required value={newClassLevel} onChange={e=>setNewClassLevel(e.target.value)}><option value="">Pilih jenjang</option>{levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><button className="btn" disabled={busy}>Simpan kelas</button></form>}
    {(segment==='CABERAWIT'||segment==='MUDA_MUDI')&&classOptions.length>0&&!archived&&<section className="classLanes section"><div className="cardHead"><div><h2>Kelas</h2><p>Pindahkan anggota dengan drag & drop atau pilih kelas saat mengedit.</p></div></div><div className="classLaneList">{classOptions.map(c=><div className="classLane" key={c.id} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/member-id');if(id)void moveMember(id,c.id)}}><strong>{c.name}</strong><span>{data.filter(m=>m.class_id===c.id).length} anggota</span></div>)}</div></section>}
    
    {message&&<div className="notice success section" role="status">{message}</div>}{error&&<div className="notice error section" role="alert">{error}</div>}
    {canWrite&&selected.length>0&&!archived&&<div className="bulkPanel card section"><div><strong>{selected.length} dipilih</strong><p>Centang bagian tujuan; keanggotaan yang sudah ada tidak digandakan.</p></div><div className="chips">{allowedCategories.map(c=><label className="chip" key={c.id}><input type="checkbox" checked={bulkCategories.includes(c.id)} onChange={e=>setBulkCategories(v=>e.target.checked?[...v,c.id]:v.filter(x=>x!==c.id))}/>{c.name}</label>)}</div>{classOptions.length>0&&<select className="select" value={bulkClass} onChange={e=>setBulkClass(e.target.value)}><option value="">Kelas tidak diubah</option>{classOptions.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select>}<button className="btn" disabled={busy||(!bulkClass&&!bulkCategories.length)} onClick={()=>void applyBulk()}>{busy?'Menyimpan…':'Terapkan'}</button></div>}
    <div className="tableWrap responsiveWrap section"><table className="table responsiveTable"><thead><tr><th>{canWrite&&!archived&&<input type="checkbox" aria-label="Pilih semua" checked={selectAll} onChange={e=>setSelected(e.target.checked?data.map(x=>x.id):[])}/>}</th><th>Nama</th><th>Program</th><th>Jenjang</th><th>Kelas / seksi</th><th>Aksi</th></tr></thead><tbody>{loading?<tr><td colSpan={6}>Memuat anggota…</td></tr>:data.map(m=><tr key={m.id} draggable={canWrite&&!archived} onDragStart={e=>e.dataTransfer.setData('text/member-id',m.id)}><td data-label="Pilih">{canWrite&&!archived&&<input type="checkbox" checked={selected.includes(m.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,m.id]:v.filter(x=>x!==m.id))}/>}</td><td data-label="Nama"><Link className="personLink" href={'/database/'+m.id}><strong>{m.name}</strong></Link><small className="muted memberPhone">{m.phone||''}</small></td><td data-label="Program">{m.member_memberships?.filter(mm=>mm.effective??mm.active).map(mm=>mm.categories?.name).filter((x:any)=>x&&x!=='Pengurus'&&x!=='Kelompok').join(', ')||'—'}</td><td data-label="Jenjang">{m.member_memberships?.filter(mm=>mm.effective??mm.active).map(mm=>mm.levels?.name).filter(Boolean).join(', ')||'—'}</td><td data-label="Kelas / seksi">{m.member_memberships?.filter(mm=>mm.effective??mm.active).map(mm=>[mm.classes?.name,mm.office,mm.section].filter(Boolean).join(' · ')).filter(Boolean).join(', ')||'—'}</td><td data-label="Aksi"><div className="row">{canWrite&&!archived&&<Link className="smallAction" href={"/database/tambah?id="+m.id}>Edit biodata</Link>}{role==='ADMIN'&&(archived?<><button className="smallAction" disabled={busy} onClick={()=>void action(m.id,'restore')} title="Pulihkan"><RotateCcw size={16}/></button><button className="smallAction danger" disabled={busy} onClick={()=>void action(m.id,'delete')} title="Hapus permanen"><Trash2 size={16}/></button></>:<button className="smallAction" disabled={busy} onClick={()=>void action(m.id,'archive')} title="Arsipkan"><Archive size={16}/></button>)}</div></td></tr>)}{!loading&&!data.length&&<tr><td colSpan={6}><div className="emptyState"><Users size={24}/><p>{archived?'Arsip kosong.':'Belum ada anggota pada filter ini.'}</p></div></td></tr>}</tbody></table></div>
    {edit&&<div className="dialogBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEdit(null)}}><form className="dialogCard" onSubmit={saveEdit} role="dialog" aria-modal="true" aria-label="Edit anggota"><div className="cardHead"><h2>Edit anggota</h2><button className="smallAction" type="button" onClick={()=>setEdit(null)}>Tutup</button></div><label>Nama<input className="input" required value={editName} onChange={e=>setEditName(e.target.value)}/></label><label>Bagian pengurus<input className="input" value={editSection} onChange={e=>setEditSection(e.target.value)} placeholder="Contoh: Sekretariat"/></label><label>Kelas<select className="select" value={editClass} onChange={e=>setEditClass(e.target.value)}><option value="">Tanpa kelas</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{error&&<div className="notice error">{error}</div>}<div className="formActions"><button className="btn" disabled={busy}>{busy?'Menyimpan…':'Simpan perubahan'}</button></div></form></div>}
  </>;
}
