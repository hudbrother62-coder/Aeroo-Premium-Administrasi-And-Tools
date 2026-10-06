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
  const[segment,setSegment]=useState('ALL'),[q,setQ]=useState(''),[classId,setClassId]=useState(''),[statusFilter,setStatusFilter]=useState(()=>typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('archived')==='1'?'INACTIVE':'ACTIVE'),[sort,setSort]=useState('source'),[levelId,setLevelId]=useState(''),[office,setOffice]=useState(''),[levels,setLevels]=useState<any[]>([]);
  const[data,setData]=useState<Member[]>([]),[classes,setClasses]=useState<ClassRow[]>([]),[categories,setCategories]=useState<Category[]>([]);
  const[role,setRole]=useState<Role|null>(null),[selected,setSelected]=useState<string[]>([]),[bulkCategories,setBulkCategories]=useState<string[]>([]),[bulkClass,setBulkClass]=useState('');
  const[showClass,setShowClass]=useState(false),[className,setClassName]=useState(''),[showLevel,setShowLevel]=useState(false),[levelName,setLevelName]=useState('');
  const[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const upload=useRef<HTMLInputElement>(null);
  const canWrite=role==='ADMIN'||role==='DEWAN_GURU'||role==='KELOMPOK';
  const canClass=role==='ADMIN'||role==='DEWAN_GURU';
  const archived=statusFilter==='INACTIVE';
  const visibleTabs=tabs.filter(([v])=>role==='DEWAN_GURU'?['ALL','CABERAWIT','MUDA_MUDI'].includes(v):role==='KELOMPOK'?['ALL','MUDA_MUDI','IBU_IBU'].includes(v):true);
  const classOptions=useMemo(()=>classes.filter(c=>segment==='ALL'||c.audience===segment),[classes,segment]);
  const allowedCategories=categories.filter(c=>['caberawit','muda-mudi','ibu-ibu'].includes(c.slug)&&(role==='ADMIN'||(role==='DEWAN_GURU'&&['caberawit','muda-mudi'].includes(c.slug))||(role==='KELOMPOK'&&['muda-mudi','ibu-ibu'].includes(c.slug))));

  async function loadMembers(){
    setLoading(true);setError('');
    const params=new URLSearchParams({segment,status:statusFilter,sort,mode:'list'});
    if(q)params.set('q',q);if(classId)params.set('class_id',classId);if(levelId)params.set('level_id',levelId);if(office)params.set('office',office);
    try{
      const r=await fetch('/api/members?'+params);
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||'Database tidak dapat dimuat.');
      setData(j);
    }catch(e){setError(e instanceof Error?e.message:'Gagal memuat database.')}finally{setLoading(false)}
  }
  async function loadMeta(){
    try{
      const [c,g,u,l]=await Promise.all([fetch('/api/classes'),fetch('/api/categories'),fetch('/api/auth/me'),fetch('/api/levels')]);
      if(!c.ok||!g.ok||!u.ok||!l.ok)throw new Error('Filter database tidak dapat dimuat.');
      const [cv,gv,uv,lv]=await Promise.all([c.json(),g.json(),u.json(),l.json()]);
      setClasses(cv);setCategories(gv);setRole(uv.role);setLevels(lv);
    }catch(e){setError(e instanceof Error?e.message:'Gagal memuat filter database.')}
  }
  useEffect(()=>{void loadMeta();const create=new URLSearchParams(window.location.search).get('create');if(create==='class')setShowClass(true);if(create==='level')setShowLevel(true)},[]);
  useEffect(()=>{void loadMembers()},[segment,classId,statusFilter,sort,levelId]);
  useEffect(()=>setSelected([]),[segment,classId,statusFilter,sort,levelId]);

  async function action(id:string,kind:'archive'|'restore'|'delete'){
    if(!window.confirm(kind==='delete'?'Hapus permanen? Identitas anggota hilang, riwayat kegiatan tetap tersimpan.':kind==='archive'?'Arsipkan anggota ini?':'Pulihkan anggota dari arsip?'))return;
    setBusy(true);setMessage('');setError('');
    const r=await fetch('/api/members/'+id+(kind==='delete'?'?permanent=1':''),{method:kind==='restore'?'PATCH':'DELETE',headers:{'content-type':'application/json'},body:kind==='restore'?JSON.stringify({status:'ACTIVE'}):undefined});
    const j=await r.json();setBusy(false);
    if(!r.ok){setError(j.error||'Tindakan gagal.');return}
    setMessage(kind==='archive'?'Anggota dipindahkan ke arsip.':kind==='restore'?'Anggota dipulihkan.':'Data pribadi dihapus permanen.');await loadMembers();
  }
  async function addLevel(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');
    const r=await fetch('/api/levels',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:levelName})});
    const j=await r.json();setBusy(false);
    if(!r.ok){setError(j.error||'Jenjang gagal dibuat.');return}setLevelName('');setShowLevel(false);setMessage('Jenjang berhasil dibuat.');await loadMeta();await loadMembers();
  }
  async function addClass(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');
    const r=await fetch('/api/classes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:className,level_id:null,audience:segment==='MUDA_MUDI'?'MUDA_MUDI':'CABERAWIT'})});
    const j=await r.json();setBusy(false);
    if(!r.ok){setError(j.error||'Kelas gagal dibuat.');return}setClassName('');setShowClass(false);setMessage('Kelas berhasil dibuat.');await loadMeta();await loadMembers();
  }
  async function applyBulk(){
    if(!selected.length||(!bulkCategories.length&&!bulkClass))return;
    setBusy(true);setError('');
    const r=await fetch('/api/members/bulk',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({member_ids:selected,category_ids:bulkCategories,class_id:bulkClass||null})});
    const j=await r.json();setBusy(false);
    if(!r.ok){setError(j.error||'Perubahan massal gagal.');return}setSelected([]);setBulkCategories([]);setBulkClass('');setMessage(`${j.updated} anggota diperbarui.`);await loadMembers();
  }
  async function importExcel(file:File){
    setBusy(true);setError('');setMessage('Mengimpor data…');
    const form=new FormData();form.set('file',file);
    const r=await fetch('/api/members/spreadsheet',{method:'POST',body:form});const j=await r.json();setBusy(false);
    if(!r.ok){setError((j.error||'Impor gagal.')+(j.errors?.length?' '+j.errors.slice(0,8).join(' '):''));setMessage('');return}
    setMessage(`${j.inserted} anggota ditambah, ${j.updated||0} diperbarui.${j.errors.length?' '+j.errors.slice(0,4).join(' '):''}`);await loadMembers();
  }
  async function moveMember(id:string,to:string){
    if(!canWrite)return;setError('');
    try{
      const r=await fetch('/api/members/bulk',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({member_ids:[id],class_id:to})});
      const j=await r.json();if(!r.ok)throw Error(j.error||'Gagal memindah kelas.');setMessage('Kelas anggota diperbarui.');await loadMembers();
    }catch(e){setError(e instanceof Error?e.message:'Gagal memindah kelas.')}
  }
  const selectAll=selected.length===data.length&&data.length>0;

  return <>
    <div className="pageHeader"><h1>Database</h1>{canWrite&&<Link className="btn" href="/database/tambah">+ Data</Link>}</div>
    <div className="tabBar section">{visibleTabs.map(([v,l])=><button key={v} className={segment===v?'tab active':'tab'} onClick={()=>{setSegment(v);setClassId('')}}>{l}</button>)}</div>
    <div className="toolbar card databaseTools"><input className="input" placeholder="Cari nama anggota…" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&void loadMembers()}/><select className="select" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ACTIVE">Aktif</option><option value="INACTIVE">Tidak aktif</option></select><select className="select" value={sort} onChange={e=>setSort(e.target.value)}><option value="source">Urutan database</option><option value="name_asc">Nama A–Z</option><option value="name_desc">Nama Z–A</option><option value="newest">Terbaru</option><option value="oldest">Terlama</option></select><select className="select" value={classId} onChange={e=>setClassId(e.target.value)}><option value="">Semua kelas</option>{classOptions.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select className="select" value={levelId} onChange={e=>setLevelId(e.target.value)}><option value="">Semua jenjang</option>{levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select><button className="btn secondary" onClick={()=>void loadMembers()}>Cari</button></div>
    <div className="databaseActions section"><button className={archived?'btn secondary':'btn ghost'} onClick={()=>setStatusFilter(v=>v==='INACTIVE'?'ACTIVE':'INACTIVE')}><Archive size={16}/>{archived?'Lihat aktif':'Arsip'}</button>{canWrite&&<a className="btn ghost" href="/api/members/spreadsheet?template=1"><Download size={16}/>Template Excel</a>}<a className="btn ghost" href="/api/members/spreadsheet"><Download size={16}/>Export Excel</a><a className="btn ghost" href="/api/members/spreadsheet?format=csv"><Download size={16}/>CSV</a>{canWrite&&<><input hidden ref={upload} type="file" accept=".xlsx,.xls" onChange={e=>{const f=e.target.files?.[0];if(f)void importExcel(f);e.target.value=''}}/><button className="btn ghost" onClick={()=>upload.current?.click()} disabled={busy}><FileUp size={16}/>Import Excel</button></>}{canClass&&!archived&&<button className="btn ghost" onClick={()=>setShowLevel(v=>!v)}>{showLevel?'Tutup jenjang':'+ Jenjang'}</button>}{canClass&&!archived&&['CABERAWIT','MUDA_MUDI'].includes(segment)&&<button className="btn ghost" onClick={()=>setShowClass(v=>!v)}>{showClass?'Tutup kelas':'+ Kelas'}</button>}</div>
    {showLevel&&<form className="card section inlineForm" onSubmit={addLevel}><label>Nama jenjang<input className="input" required value={levelName} onChange={e=>setLevelName(e.target.value)} placeholder="Contoh: SD 1 atau Remaja"/></label><button className="btn" disabled={busy}>Simpan jenjang</button></form>}
    {showClass&&<form className="card section inlineForm compactCreateForm" onSubmit={addClass}><label>Nama kelas<input className="input" required value={className} onChange={e=>setClassName(e.target.value)} placeholder="Contoh: Kelas A"/></label><button className="btn" disabled={busy}>Simpan kelas</button></form>}
    {(segment==='CABERAWIT'||segment==='MUDA_MUDI')&&classOptions.length>0&&!archived&&<section className="classLanes section"><div className="cardHead"><div><h2>Kelas</h2><p>Pindahkan anggota dengan drag & drop atau pilih kelas saat mengedit.</p></div></div><div className="classLaneList">{classOptions.map(c=><div className="classLane" key={c.id} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/member-id');if(id)void moveMember(id,c.id)}}><strong>{c.name}</strong><span>{data.filter(m=>m.member_memberships?.some(mm=>mm.effective&&mm.class_id===c.id)).length} anggota</span></div>)}</div></section>}
    
    {message&&<div className="notice success section" role="status">{message}</div>}{error&&<div className="notice error section" role="alert">{error}</div>}
    {loading&&data.length>0&&<div className="dataRefreshHint">Memperbarui database…</div>}{canWrite&&selected.length>0&&!archived&&<div className="bulkPanel card section"><div><strong>{selected.length} dipilih</strong><p>Centang bagian tujuan; keanggotaan yang sudah ada tidak digandakan.</p></div><div className="chips">{allowedCategories.map(c=><label className="chip" key={c.id}><input type="checkbox" checked={bulkCategories.includes(c.id)} onChange={e=>setBulkCategories(v=>e.target.checked?[...v,c.id]:v.filter(x=>x!==c.id))}/>{c.name}</label>)}</div>{classOptions.length>0&&<select className="select" value={bulkClass} onChange={e=>setBulkClass(e.target.value)}><option value="">Kelas tidak diubah</option>{classOptions.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select>}<button className="btn" disabled={busy||(!bulkClass&&!bulkCategories.length)} onClick={()=>void applyBulk()}>{busy?'Menyimpan…':'Terapkan'}</button></div>}
    <div className="tableWrap responsiveWrap section"><table className="table responsiveTable"><thead><tr><th>{canWrite&&!archived&&<input type="checkbox" aria-label="Pilih semua" checked={selectAll} onChange={e=>setSelected(e.target.checked?data.map(x=>x.id):[])}/>}</th><th>Nama</th><th>Program</th><th>Jenjang</th><th>Kelas / seksi</th><th>Aksi</th></tr></thead><tbody>{loading&&!data.length?<tr><td colSpan={6}>Memuat database…</td></tr>:data.map(m=><tr key={m.id} draggable={canWrite&&!archived} onDragStart={e=>e.dataTransfer.setData('text/member-id',m.id)}><td data-label="Pilih">{canWrite&&!archived&&<input type="checkbox" checked={selected.includes(m.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,m.id]:v.filter(x=>x!==m.id))}/>}</td><td data-label="Nama"><Link className="personLink" href={'/database/'+m.id}><strong>{m.name}</strong></Link><small className="muted memberPhone">{m.phone||''}</small></td><td data-label="Program">{m.member_memberships?.filter(mm=>mm.effective??mm.active).map(mm=>mm.categories?.name).filter((x:any)=>x&&x!=='Pengurus'&&x!=='Kelompok').join(', ')||'—'}</td><td data-label="Jenjang">{m.member_memberships?.filter(mm=>mm.effective??mm.active).map(mm=>mm.levels?.name).filter(Boolean).join(', ')||'—'}</td><td data-label="Kelas / seksi">{m.member_memberships?.filter(mm=>mm.effective??mm.active).map(mm=>[mm.classes?.name,mm.office,mm.section].filter(Boolean).join(' · ')).filter(Boolean).join(', ')||'—'}</td><td data-label="Aksi"><div className="row">{canWrite&&!archived&&<Link className="smallAction" href={"/database/tambah?id="+m.id}>Edit biodata</Link>}{role==='ADMIN'&&(archived?<><button className="smallAction" disabled={busy} onClick={()=>void action(m.id,'restore')} title="Pulihkan"><RotateCcw size={16}/></button><button className="smallAction danger" disabled={busy} onClick={()=>void action(m.id,'delete')} title="Hapus permanen"><Trash2 size={16}/></button></>:<button className="smallAction" disabled={busy} onClick={()=>void action(m.id,'archive')} title="Arsipkan"><Archive size={16}/></button>)}</div></td></tr>)}{!loading&&!data.length&&<tr><td colSpan={6}><div className="emptyState"><Users size={24}/><p>{archived?'Arsip kosong.':'Belum ada data pada filter ini.'}</p></div></td></tr>}</tbody></table></div>

  </>;
}
