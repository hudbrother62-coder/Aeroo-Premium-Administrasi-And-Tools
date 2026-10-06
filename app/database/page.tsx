'use client';

import Link from 'next/link';
import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import {Download,Eye,FileUp,Pencil,RotateCcw,Trash2,Users,X} from 'lucide-react';
import {type Role} from '@/lib/access';

type Member={member_memberships?:any[];revision?:number;level_id?:string;id:string;name:string;gender?:string;phone?:string;section?:string;status:string;class_id?:string;birth_place?:string;birth_date?:string;address?:string;notes?:string;guardian_name?:string;guardian_phone?:string;photo_url?:string;child_order?:number|null;inactive_reason?:string|null;source_order?:number|null;relationship?:string|null;levels?:{name?:string};classes?:{name?:string};member_categories?:Array<{category_id:string;categories?:{name?:string;slug?:string}}>};
type ClassRow={id:string;name:string;audience:string;level_id?:string};
type Category={id:string;name:string;slug:string};
const tabs=[['ALL','Semua anggota'],['KELOMPOK','Kelompok'],['CABERAWIT','Jabirawit'],['MUDA_MUDI','Muda-Mudi'],['IBU_IBU','Ibu-Ibu'],['PENGURUS','Pengurus']] as const;

export default function DatabasePage(){
  const[segment,setSegment]=useState('ALL'),[q,setQ]=useState(''),[classId,setClassId]=useState(''),[statusFilter,setStatusFilter]=useState('ALL'),[sort,setSort]=useState('source'),[levelId,setLevelId]=useState(''),[office,setOffice]=useState(''),[levels,setLevels]=useState<any[]>([]);
  const[data,setData]=useState<Member[]>([]),[classes,setClasses]=useState<ClassRow[]>([]),[categories,setCategories]=useState<Category[]>([]);
  const[role,setRole]=useState<Role|null>(null),[selected,setSelected]=useState<string[]>([]),[bulkCategories,setBulkCategories]=useState<string[]>([]),[bulkClass,setBulkClass]=useState('');
  const[showClass,setShowClass]=useState(false),[className,setClassName]=useState(''),[newClassLevel,setNewClassLevel]=useState(''),[detail,setDetail]=useState<Member|null>(null),[detailLoading,setDetailLoading]=useState(false);
  const[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const upload=useRef<HTMLInputElement>(null);
  const canWrite=role==='ADMIN'||role==='DEWAN_GURU'||role==='KELOMPOK';
  const canClass=role==='ADMIN'||role==='DEWAN_GURU';
  const visibleTabs=tabs.filter(([v])=>role==='DEWAN_GURU'?['ALL','CABERAWIT','MUDA_MUDI'].includes(v):role==='KELOMPOK'?['ALL','KELOMPOK','MUDA_MUDI','IBU_IBU','PENGURUS'].includes(v):role==='VIEWER'?v!=='PENGURUS':true);
  const classOptions=useMemo(()=>classes.filter(c=>segment==='ALL'||c.audience===segment),[classes,segment]);
  const allowedCategories=categories.filter(c=>role==='ADMIN'||(role==='DEWAN_GURU'&&['caberawit','muda-mudi'].includes(c.slug))||(role==='KELOMPOK'&&['kelompok','ibu-ibu','pengurus'].includes(c.slug)));

  async function load(){
    setLoading(true);setError('');
    const params=new URLSearchParams({segment,status:statusFilter,sort});
    if(q)params.set('q',q);if(classId)params.set('class_id',classId);if(levelId)params.set('level_id',levelId);if(office)params.set('office',office);
    try{
      const [r,c,g,u,l]=await Promise.all([fetch('/api/members?'+params),fetch('/api/classes'),fetch('/api/categories'),fetch('/api/auth/me'),fetch('/api/levels')]);
      if(!r.ok||!c.ok||!g.ok||!u.ok)throw new Error('Data tidak dapat dimuat.');
      setData(await r.json());setClasses(await c.json());setCategories(await g.json());setRole((await u.json()).role);setLevels(await l.json());
    }catch(e){setError(e instanceof Error?e.message:'Gagal memuat database.')}finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[segment,classId,statusFilter,sort,levelId]);
  useEffect(()=>setSelected([]),[segment,classId,statusFilter,sort,levelId]);

  async function action(id:string,kind:'archive'|'restore'|'delete'){
    if(!window.confirm(kind==='delete'?'Hapus permanen? Identitas anggota hilang, riwayat kegiatan tetap tersimpan.':kind==='archive'?'Hapus anggota ini dari daftar aktif? Data akan dipindahkan ke arsip dan masih bisa dipulihkan.':'Pulihkan anggota dari arsip?'))return false;
    setBusy(true);setMessage('');setError('');
    const r=await fetch('/api/members/'+id+(kind==='delete'?'?permanent=1':''),{method:kind==='restore'?'PATCH':'DELETE',headers:{'content-type':'application/json'},body:kind==='restore'?JSON.stringify({status:'ACTIVE'}):undefined});
    const j=await r.json();setBusy(false);
    if(!r.ok){setError(j.error||'Tindakan gagal.');return false}
    setMessage(kind==='archive'?'Anggota dipindahkan ke arsip.':kind==='restore'?'Anggota dipulihkan.':'Data pribadi dihapus permanen.');await load();return true;
  }
  async function openDetail(member:Member){
    setDetail(member);setDetailLoading(true);setError('');
    try{
      const r=await fetch('/api/members/'+member.id,{cache:'no-store'});
      if(!r.ok)throw new Error('Detail anggota tidak dapat dimuat.');
      setDetail(await r.json());
    }catch(e){setError(e instanceof Error?e.message:'Gagal memuat detail anggota.')}finally{setDetailLoading(false)}
  }
  async function addClass(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');
    const r=await fetch('/api/classes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:className,level_id:newClassLevel||null,audience:segment==='MUDA_MUDI'?'MUDA_MUDI':'CABERAWIT'})});
    const j=await r.json();setBusy(false);
    if(!r.ok){setError(j.error||'Kelas gagal dibuat.');return}setClassName('');setShowClass(false);setMessage('Kelas berhasil dibuat.');await load();
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
  const selectableData=data.filter(m=>m.status==='ACTIVE');
  const selectAll=selected.length===selectableData.length&&selectableData.length>0;

  return <>
    <div className="pageHeader"><div><div className="eyebrow">Database anggota</div><h1>Database</h1><p>Urutan awal mengikuti struktur database ZAMZAM; gunakan filter bila ingin tampilan lain.</p></div>{canWrite&&<Link className="btn" href="/database/tambah">+ Anggota</Link>}</div>
    <div className="tabBar section">{visibleTabs.map(([v,l])=><button key={v} className={segment===v?'tab active':'tab'} onClick={()=>{setSegment(v);setClassId('')}}>{l}</button>)}</div>
    <div className="toolbar card databaseTools"><input className="input" placeholder="Cari nama anggota…" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&void load()}/><select className="select" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ALL">Semua status</option><option value="ACTIVE">Aktif</option><option value="INACTIVE">Tidak aktif</option></select><select className="select" value={sort} onChange={e=>setSort(e.target.value)}><option value="source">Urutan database</option><option value="name_asc">Nama A–Z</option><option value="name_desc">Nama Z–A</option><option value="newest">Terbaru ditambahkan</option><option value="oldest">Terlama ditambahkan</option></select><select className="select" value={classId} onChange={e=>setClassId(e.target.value)}><option value="">Semua kelas</option>{classOptions.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select className="select" value={levelId} onChange={e=>setLevelId(e.target.value)}><option value="">Semua jenjang</option>{levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>{canWrite&&<input className="input" placeholder="Jabatan / bagian pengurus" value={office} onChange={e=>setOffice(e.target.value)}/> }<button className="btn secondary" onClick={()=>void load()}>Cari</button></div>
    <div className="databaseActions section">{canWrite&&<a className="btn ghost" href="/api/members/spreadsheet?template=1"><Download size={16}/>Template Excel</a>}<a className="btn ghost" href="/api/members/spreadsheet"><Download size={16}/>Export Excel</a><a className="btn ghost" href="/api/members/spreadsheet?format=csv"><Download size={16}/>CSV</a>{canWrite&&<><input hidden ref={upload} type="file" accept=".xlsx,.xls" onChange={e=>{const f=e.target.files?.[0];if(f)void importExcel(f);e.target.value=''}}/><button className="btn ghost" onClick={()=>upload.current?.click()} disabled={busy}><FileUp size={16}/>Import Excel</button></>}{canClass&&<button className="btn ghost" onClick={()=>setShowClass(v=>!v)}>{showClass?'Tutup kelas':'+ Kelas'}</button>}</div>
    {showClass&&<form className="card section inlineForm" onSubmit={addClass}><label>Nama kelas<input className="input" required value={className} onChange={e=>setClassName(e.target.value)} placeholder="Contoh: SD 1 A"/></label><label>Jenjang<select className="select" required value={newClassLevel} onChange={e=>setNewClassLevel(e.target.value)}><option value="">Pilih jenjang</option>{levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><button className="btn" disabled={busy}>Simpan kelas</button></form>}
    {(segment==='CABERAWIT'||segment==='MUDA_MUDI')&&classOptions.length>0&&<section className="classLanes section"><div className="cardHead"><div><h2>Kelas</h2><p>Pindahkan anggota dengan drag & drop atau pilih kelas saat mengedit.</p></div></div><div className="classLaneList">{classOptions.map(c=><div className="classLane" key={c.id} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/member-id');if(id)void moveMember(id,c.id)}}><strong>{c.name}</strong><span>{data.filter(m=>m.class_id===c.id).length} anggota</span></div>)}</div></section>}
    {segment==='PENGURUS'&&<section className="classLanes section"><div className="cardHead"><div><h2>Bagian pengurus</h2><p>Bagian dapat diedit pada anggota atau dipindah dengan drag & drop.</p></div></div><div className="classLaneList">{Array.from(new Set(['Pengurus','Sekretariat','Bendahara',...data.map(m=>m.section||'Pengurus')])).map(section=><div className="classLane" key={section} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/member-id');if(id)void moveSection(id,section)}}><strong>{section}</strong><span>{data.filter(m=>(m.section||'Pengurus')===section).length} anggota</span></div>)}</div></section>}
    {message&&<div className="notice success section" role="status">{message}</div>}{error&&<div className="notice error section" role="alert">{error}</div>}
    {canWrite&&selected.length>0&&<div className="bulkPanel card section"><div><strong>{selected.length} dipilih</strong><p>Centang bagian tujuan; keanggotaan yang sudah ada tidak digandakan.</p></div><div className="chips">{allowedCategories.map(c=><label className="chip" key={c.id}><input type="checkbox" checked={bulkCategories.includes(c.id)} onChange={e=>setBulkCategories(v=>e.target.checked?[...v,c.id]:v.filter(x=>x!==c.id))}/>{c.name}</label>)}</div>{classOptions.length>0&&<select className="select" value={bulkClass} onChange={e=>setBulkClass(e.target.value)}><option value="">Kelas tidak diubah</option>{classOptions.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select>}<button className="btn" disabled={busy||(!bulkClass&&!bulkCategories.length)} onClick={()=>void applyBulk()}>{busy?'Menyimpan…':'Terapkan'}</button></div>}
    <section className="memberCompactList section" aria-label="Daftar anggota">
      <div className="memberListHead"><strong>{loading?'Memuat…':data.length+' anggota'}</strong>{canWrite&&selectableData.length>0&&<label className="memberSelectAll"><input type="checkbox" aria-label="Pilih semua anggota aktif" checked={selectAll} onChange={e=>setSelected(e.target.checked?selectableData.map(x=>x.id):[])}/><span>Pilih aktif</span></label>}</div>
      {loading?<div className="memberListLoading">Memuat anggota…</div>:data.map(m=><div className={m.status==='ACTIVE'?'memberCompactRow':'memberCompactRow inactiveRow'} key={m.id} draggable={canWrite&&m.status==='ACTIVE'} onDragStart={e=>e.dataTransfer.setData('text/member-id',m.id)}>
        {canWrite&&m.status==='ACTIVE'&&<input className="memberRowCheck" type="checkbox" aria-label={'Pilih '+m.name} checked={selected.includes(m.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,m.id]:v.filter(x=>x!==m.id))}/>}
        <strong className="memberCompactName" title={m.name}>{m.name}</strong>
        <span className={m.status==='ACTIVE'?'memberRowStatus active':'memberRowStatus inactive'}>{m.status==='ACTIVE'?'Aktif':'Tidak aktif'}</span>
        <button className="smallAction detailButton" type="button" onClick={()=>void openDetail(m)}><Eye size={15}/>Lihat detail</button>
      </div>)}
      {!loading&&!data.length&&<div className="memberListEmpty"><Users size={24}/><p>Belum ada anggota pada filter ini.</p></div>}
    </section>
    {detail&&<div className="dialogBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setDetail(null)}}>
      <div className="dialogCard memberDetailDialog" role="dialog" aria-modal="true" aria-label={'Detail '+detail.name}>
        <div className="memberDetailHead"><div className="memberDetailIdentity"><div className="memberDetailAvatar">{detail.name.trim().charAt(0).toUpperCase()}</div><div><small>Detail anggota</small><h2>{detail.name}</h2><span className={detail.status==='ACTIVE'?'detailStatus active':'detailStatus'}>{detail.status==='ACTIVE'?'Aktif':'Tidak aktif'}</span></div></div><button className="smallAction iconAction" type="button" onClick={()=>setDetail(null)} aria-label="Tutup detail"><X size={18}/></button></div>
        {detailLoading?<div className="memberDetailLoading">Memuat biodata lengkap…</div>:<>
          <section className="memberDetailSection"><h3>Identitas</h3><div className="memberDetailGrid">
            {detail.gender&&<div className="memberDetailField"><span>Jenis kelamin</span><strong>{detail.gender==='L'?'Laki-laki':detail.gender==='P'?'Perempuan':detail.gender}</strong></div>}
            {detail.birth_place&&<div className="memberDetailField"><span>Tempat lahir</span><strong>{detail.birth_place}</strong></div>}
            {detail.birth_date&&<div className="memberDetailField"><span>Tanggal lahir</span><strong>{new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(detail.birth_date+'T00:00:00Z'))}</strong></div>}
            {detail.phone&&<div className="memberDetailField"><span>No. HP</span><strong>{detail.phone}</strong></div>}
            {detail.address&&<div className="memberDetailField spanDetail"><span>Alamat</span><strong>{detail.address}</strong></div>}
            {detail.status==='INACTIVE'&&detail.inactive_reason&&<div className="memberDetailField spanDetail"><span>Keterangan tidak aktif</span><strong>{detail.inactive_reason}</strong></div>}
          </div></section>
          {(detail.guardian_name||detail.guardian_phone||detail.child_order)&&<section className="memberDetailSection"><h3>Keluarga</h3><div className="memberDetailGrid">
            {detail.child_order&&<div className="memberDetailField"><span>Anak ke</span><strong>{detail.child_order}</strong></div>}
            {detail.guardian_name&&<div className="memberDetailField"><span>Wali / keluarga</span><strong>{detail.guardian_name}</strong></div>}
            {detail.guardian_phone&&<div className="memberDetailField"><span>HP wali</span><strong>{detail.guardian_phone}</strong></div>}
          </div></section>}
        </>}
        {error&&<div className="notice error">{error}</div>}
        <div className="memberDetailActions">
          {canWrite&&<Link className="btn secondary" href={'/database/tambah?id='+detail.id}><Pencil size={16}/>Edit</Link>}
          {role==='ADMIN'&&(detail.status==='INACTIVE'?<><button className="btn secondary" type="button" disabled={busy} onClick={async()=>{if(await action(detail.id,'restore'))setDetail(null)}}><RotateCcw size={16}/>Aktifkan</button><button className="btn dangerButton" type="button" disabled={busy} onClick={async()=>{if(await action(detail.id,'delete'))setDetail(null)}}><Trash2 size={16}/>Hapus permanen</button></>:<button className="btn dangerButton" type="button" disabled={busy} onClick={async()=>{if(await action(detail.id,'archive'))setDetail(null)}}><Trash2 size={16}/>Hapus</button>)}
        </div>
      </div>
    </div>}
  </>;
}
