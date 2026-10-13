'use client';

import Link from 'next/link';
import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import {Archive,Download,FileUp,RotateCcw,Trash2,Users} from 'lucide-react';
import {type Role,type Audience,readScopesForRole,writeScopesForRole} from '@/lib/access';

type Member={member_memberships?:any[];revision?:number;id:string;name:string;gender?:string;phone?:string;section?:string;status:string;class_id?:string;classes?:{name?:string};member_categories?:Array<{category_id:string;categories?:{name?:string;slug?:string}}>};
type ClassRow={id:string;name:string;audience:string};
type Category={id:string;name:string;slug:string};
const tabs=[['ALL','Semua'],['KELOMPOK','Kelompok'],['CABERAWIT','Caberawit'],['MUDA_MUDI','Muda-Mudi'],['IBU_IBU','Ibu-Ibu']] as const;

export default function DatabasePage(){
  const[segment,setSegment]=useState('ALL'),[q,setQ]=useState(''),[classId,setClassId]=useState(''),[statusFilter,setStatusFilter]=useState(()=>typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('archived')==='1'?'INACTIVE':'ACTIVE'),[sort,setSort]=useState('source'),[office,setOffice]=useState('');
  const[data,setData]=useState<Member[]>([]),[classes,setClasses]=useState<ClassRow[]>([]),[categories,setCategories]=useState<Category[]>([]);
  const[readableScopes,setReadableScopes]=useState<Audience[]>([]),[writableScopes,setWritableScopes]=useState<Audience[]>([]);
   const[role,setRole]=useState<Role|null>(null),[selected,setSelected]=useState<string[]>([]),[bulkCategories,setBulkCategories]=useState<string[]>([]),[bulkClass,setBulkClass]=useState('');
  const[showClass,setShowClass]=useState(false),[className,setClassName]=useState('');
  const[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const upload=useRef<HTMLInputElement>(null);
  const canWrite=role==='ADMIN'||writableScopes.length>0;
  const canClass=role==='ADMIN'||role==='DEWAN_GURU';
  const archived=statusFilter==='INACTIVE';
  const visibleTabs=tabs.filter(([v])=>role==='ADMIN'||(v!=='ALL'&&readableScopes.includes(v as Audience)));
  const classOptions=useMemo(()=>classes.filter(c=>segment==='ALL'||c.audience===segment),[classes,segment]);
  const allowedCategories=categories.filter(c=>['caberawit','muda-mudi','ibu-ibu'].includes(c.slug)&&(role==='ADMIN'||writableScopes.includes((c.slug==='caberawit'?'CABERAWIT':c.slug==='muda-mudi'?'MUDA_MUDI':'IBU_IBU') as Audience)));

  async function loadMembers(fresh=false){
    setLoading(true);setError('');
    const params=new URLSearchParams({segment,status:statusFilter,sort,mode:'list'});
    if(q)params.set('q',q);if(classId)params.set('class_id',classId);if(office)params.set('office',office);
    try{
      const r=await fetch('/api/members?'+params,{cache:fresh?'no-store':'default'});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||'Database tidak dapat dimuat.');
      setData(j);
    }catch(e){setError(e instanceof Error?e.message:'Gagal memuat database.')}finally{setLoading(false)}
  }
  async function loadMeta(){
    try{
      const [c,g,u]=await Promise.all([fetch('/api/classes'),fetch('/api/categories'),fetch('/api/auth/me')]);
      if(!c.ok||!g.ok||!u.ok)throw new Error('Filter database tidak dapat dimuat.');
      const [cv,gv,uv]=await Promise.all([c.json(),g.json(),u.json()]);
      setClasses(cv);setCategories(gv);setRole(uv.role);
       const read=(Array.isArray(uv.read_scopes)?uv.read_scopes:readScopesForRole(uv.role)) as Audience[];
       const write=(Array.isArray(uv.write_scopes)?uv.write_scopes:writeScopesForRole(uv.role)) as Audience[];
       setReadableScopes(read);setWritableScopes(write);
       if(uv.role!=='ADMIN')setSegment(read.includes('CABERAWIT')?'CABERAWIT':read.includes('KELOMPOK')?'KELOMPOK':read[0]||'CABERAWIT');
    }catch(e){setError(e instanceof Error?e.message:'Gagal memuat filter database.')}
  }
  useEffect(()=>{void loadMeta();const create=new URLSearchParams(window.location.search).get('create');if(create==='class')setShowClass(true)},[]);
  useEffect(()=>{void loadMembers()},[segment,classId,statusFilter,sort]);
  useEffect(()=>setSelected([]),[segment,classId,statusFilter,sort]);

  async function action(id:string,kind:'archive'|'restore'|'delete'){
    if(!window.confirm(kind==='delete'?'Hapus permanen? Identitas anggota hilang, riwayat kegiatan tetap tersimpan.':kind==='archive'?'Arsipkan anggota ini?':'Pulihkan anggota dari arsip?'))return;
    setBusy(true);setMessage('');setError('');
    const r=await fetch('/api/members/'+id+(kind==='delete'?'?permanent=1':''),{method:kind==='restore'?'PATCH':'DELETE',headers:{'content-type':'application/json'},body:kind==='restore'?JSON.stringify({status:'ACTIVE'}):undefined});
    const j=await r.json();setBusy(false);
    if(!r.ok){setError(j.error||'Tindakan gagal.');return}
    setMessage(kind==='archive'?'Anggota dipindahkan ke arsip.':kind==='restore'?'Anggota dipulihkan.':'Data pribadi dihapus permanen.');await loadMembers(true);
  }
  async function addClass(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');
    const r=await fetch('/api/classes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:className,level_id:null,audience:segment==='MUDA_MUDI'?'MUDA_MUDI':'CABERAWIT'})});
    const j=await r.json();setBusy(false);
    if(!r.ok){setError(j.error||'Kelas gagal dibuat.');return}setClassName('');setShowClass(false);setMessage('Kelas berhasil dibuat.');await loadMeta();await loadMembers(true);
  }
  async function applyBulk(){
    if(!selected.length||(!bulkCategories.length&&!bulkClass))return;
    setBusy(true);setError('');
    const r=await fetch('/api/members/bulk',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({member_ids:selected,category_ids:bulkCategories,class_id:bulkClass||null})});
    const j=await r.json();setBusy(false);
    if(!r.ok){setError(j.error||'Perubahan massal gagal.');return}setSelected([]);setBulkCategories([]);setBulkClass('');setMessage(`${j.updated} anggota diperbarui.`);await loadMembers(true);
  }
  async function importExcel(file:File){
    setBusy(true);setError('');setMessage('Mengimpor data…');
    const form=new FormData();form.set('file',file);
    const r=await fetch('/api/members/spreadsheet',{method:'POST',body:form});const j=await r.json();setBusy(false);
    if(!r.ok){setError((j.error||'Impor gagal.')+(j.errors?.length?' '+j.errors.slice(0,8).join(' '):''));setMessage('');return}
    setMessage(`${j.inserted} anggota ditambah, ${j.updated||0} diperbarui.${j.errors.length?' '+j.errors.slice(0,4).join(' '):''}`);await loadMembers(true);
  }
  async function moveMember(id:string,to:string){
    if(!canWrite)return;setError('');
    try{
      const r=await fetch('/api/members/bulk',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({member_ids:[id],class_id:to})});
      const j=await r.json();if(!r.ok)throw Error(j.error||'Gagal memindah kelas.');setMessage('Kelas anggota diperbarui.');await loadMembers(true);
    }catch(e){setError(e instanceof Error?e.message:'Gagal memindah kelas.')}
  }
  const selectAll=selected.length===data.length&&data.length>0;

  return <>
    <div className="pageHeader"><h1>Database</h1>{canWrite&&<Link className="btn" href="/database/tambah">+ Data</Link>}</div>
    <div className="tabBar section">{visibleTabs.map(([v,l])=><button key={v} className={segment===v?'tab active':'tab'} onClick={()=>{setSegment(v);setClassId('')}}>{l}</button>)}</div>
    <div className="toolbar card databaseTools"><input className="input" placeholder="Cari nama anggota…" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&void loadMembers()}/><select className="select" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ACTIVE">Aktif</option><option value="INACTIVE">Tidak aktif</option></select><select className="select" value={sort} onChange={e=>setSort(e.target.value)}><option value="source">Urutan database</option><option value="name_asc">Nama A–Z</option><option value="name_desc">Nama Z–A</option><option value="newest">Terbaru</option><option value="oldest">Terlama</option></select><select className="select" value={classId} onChange={e=>setClassId(e.target.value)}><option value="">Semua kelas</option>{classOptions.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="btn secondary" onClick={()=>void loadMembers()}>Cari</button></div>
    <div className="databaseActions section"><button className={archived?'btn secondary':'btn ghost'} onClick={()=>setStatusFilter(v=>v==='INACTIVE'?'ACTIVE':'INACTIVE')}><Archive size={16}/>{archived?'Lihat aktif':'Arsip'}</button>{canWrite&&<a className="btn ghost" href="/api/members/spreadsheet?template=1"><Download size={16}/>Template Excel</a>}<a className="btn ghost" href={"/api/members/spreadsheet?status="+statusFilter}><Download size={16}/>Excel {archived?"Arsip":"Aktif"}</a><a className="btn ghost" href={"/api/members/spreadsheet?format=csv&status="+statusFilter}><Download size={16}/>CSV</a>{role==='ADMIN'&&<a className="btn ghost" href="/api/members/spreadsheet?status=ALL"><Download size={16}/>Excel Semua Data</a>}{canWrite&&<><input hidden ref={upload} type="file" accept=".xlsx,.xls" onChange={e=>{const f=e.target.files?.[0];if(f)void importExcel(f);e.target.value=''}}/><button className="btn ghost" onClick={()=>upload.current?.click()} disabled={busy}><FileUp size={16}/>Import Excel</button></>}{canClass&&!archived&&['CABERAWIT','MUDA_MUDI'].includes(segment)&&<button className="btn ghost" onClick={()=>setShowClass(v=>!v)}>{showClass?'Tutup kelas':'+ Kelas'}</button>}</div>
    
    {showClass&&<form className="card section inlineForm compactCreateForm" onSubmit={addClass}><label>Nama kelas<input className="input" required value={className} onChange={e=>setClassName(e.target.value)} placeholder="Contoh: Kelas A"/></label><button className="btn" disabled={busy}>Simpan kelas</button></form>}
    {(segment==='CABERAWIT'||segment==='MUDA_MUDI')&&classOptions.length>0&&!archived&&<section className="classLanes section"><div className="cardHead"><div><h2>Kelas</h2></div></div><div className="classLaneList">{classOptions.map(c=><div className="classLane" key={c.id} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/member-id');if(id)void moveMember(id,c.id)}}><strong>{c.name}</strong><span>{data.filter(m=>m.member_memberships?.some(mm=>mm.effective&&mm.class_id===c.id)).length} anggota</span></div>)}</div></section>}
    
    {message&&<div className="notice success section" role="status">{message}</div>}{error&&<div className="notice error section" role="alert">{error}</div>}
    {loading&&data.length>0&&<div className="dataRefreshHint">Memperbarui database…</div>}{canWrite&&selected.length>0&&!archived&&<div className="bulkPanel card section"><div><strong>{selected.length} dipilih</strong><p>Centang bagian tujuan; keanggotaan yang sudah ada tidak digandakan.</p></div><div className="chips">{allowedCategories.map(c=><label className="chip" key={c.id}><input type="checkbox" checked={bulkCategories.includes(c.id)} onChange={e=>setBulkCategories(v=>e.target.checked?[...v,c.id]:v.filter(x=>x!==c.id))}/>{c.name}</label>)}</div>{classOptions.length>0&&<select className="select" value={bulkClass} onChange={e=>setBulkClass(e.target.value)}><option value="">Kelas tidak diubah</option>{classOptions.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select>}<button className="btn" disabled={busy||(!bulkClass&&!bulkCategories.length)} onClick={()=>void applyBulk()}>{busy?'Menyimpan…':'Terapkan'}</button></div>}
    <div className="mobileMemberList section" aria-label="Daftar nama anggota">
      {loading&&!data.length?<div className="card" role="status">Memuat database…</div>:data.map((m,index)=><div className="mobileMemberRow" key={m.id}>
        {canWrite&&!archived&&<input className="mobileMemberCheckbox" type="checkbox" aria-label={`Pilih ${m.name}`} checked={selected.includes(m.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,m.id]:v.filter(x=>x!==m.id))}/>}
        <span className="mobileMemberNumber">{index+1}.</span>
        <Link className="mobileMemberName" href={'/database/'+m.id}>{m.name}</Link>
        <Link className="mobileMemberDetail" href={'/database/'+m.id} aria-label={`Lihat detail ${m.name}`}>Detail</Link>
      </div>)}
      {!loading&&!data.length&&<div className="card emptyState">{archived?'Arsip kosong.':'Belum ada data pada filter ini.'}</div>}
    </div>
    <div className="tableWrap responsiveWrap section databaseDesktopTable"><table className="table responsiveTable"><thead><tr><th><span style={{display:"inline-flex",alignItems:"center",gap:10}}>{canWrite&&!archived&&<input type="checkbox" aria-label="Pilih semua" checked={selectAll} onChange={e=>setSelected(e.target.checked?data.map(x=>x.id):[])}/>}<span>No.</span></span></th><th>Nama</th><th>Program</th><th>Kelas</th><th>Aksi</th></tr></thead><tbody>{loading&&!data.length?<tr><td colSpan={5}>Memuat database…</td></tr>:data.map((m,index)=><tr key={m.id} draggable={canWrite&&!archived} onDragStart={e=>e.dataTransfer.setData('text/member-id',m.id)}><td data-label="No."><span style={{display:"inline-flex",alignItems:"center",gap:10}}>{canWrite&&!archived&&<input type="checkbox" aria-label={`Pilih ${m.name}`} checked={selected.includes(m.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,m.id]:v.filter(x=>x!==m.id))}/>}<span style={{fontVariantNumeric:"tabular-nums"}}>{index+1}</span></span></td><td data-label="Nama"><Link className="personLink" href={'/database/'+m.id}><strong>{m.name}</strong></Link><small className="muted memberPhone">{m.phone||''}</small></td><td data-label="Program">{m.member_memberships?.filter(mm=>mm.effective??mm.active).map(mm=>mm.categories?.name).filter((x:any)=>x&&x!=='Pengurus'&&x!=='Kelompok').join(', ')||'—'}</td><td data-label="Kelas">{m.member_memberships?.filter(mm=>mm.effective??mm.active).map(mm=>mm.classes?.name).filter(Boolean).join(', ')||'—'}</td><td data-label="Aksi"><div className="row">{canWrite&&!archived&&<Link className="smallAction" href={"/database/tambah?id="+m.id}>Edit biodata</Link>}{role==='ADMIN'&&(archived?<><button className="smallAction" disabled={busy} onClick={()=>void action(m.id,'restore')} title="Pulihkan"><RotateCcw size={16}/></button><button className="smallAction danger" disabled={busy} onClick={()=>void action(m.id,'delete')} title="Hapus permanen"><Trash2 size={16}/></button></>:<button className="smallAction" disabled={busy} onClick={()=>void action(m.id,'archive')} title="Arsipkan"><Archive size={16}/></button>)}</div></td></tr>)}{!loading&&!data.length&&<tr><td colSpan={5}><div className="emptyState"><Users size={24}/><p>{archived?'Arsip kosong.':'Belum ada data pada filter ini.'}</p></div></td></tr>}</tbody></table></div>

  </>;
}
