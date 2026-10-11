'use client';
import {Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {Archive,CheckCheck,FileText,LockKeyhole,NotebookPen,Pin,Plus,RotateCcw,Search,ShieldCheck,Trash2,Users} from 'lucide-react';
import type {NoteScope,NoteStatus} from '@/lib/note-scopes';
import './notes.css';

type Role='ADMIN'|'DEWAN_GURU'|'KELOMPOK'|'VIEWER';
type User={id:string;role:Role;permissions?:Record<string,boolean>};
type Note={
 id:string;scope:NoteScope;owner_user_id:string;role_scope?:Role|null;
 title:string;content:string;status:NoteStatus;is_pinned:boolean;
 revision:number;created_at:string;updated_at:string;
};
const tabs=[
 {id:'PERSONAL' as const,label:'Pribadi',icon:LockKeyhole,caption:'Hanya bisa dibaca dan diubah oleh akun Anda.',empty:'Catatan yang hanya Anda yang dapat melihatnya.'},
 {id:'ROLE' as const,label:'Per Role',icon:Users,caption:'Dibagikan kepada akun dengan role yang sama.',empty:'Belum ada catatan untuk role Anda.'},
 {id:'MAIN' as const,label:'Utama',icon:FileText,caption:'Informasi bersama untuk seluruh pengguna Simpul.',empty:'Belum ada catatan utama organisasi.'}
];
const statusLabels:Record<NoteStatus,string>={ACTIVE:'Aktif',ARCHIVED:'Arsip',DELETED:'Sampah'};
const roles:Record<Role,string>={ADMIN:'Admin Utama',DEWAN_GURU:'Dewan Guru',KELOMPOK:'Kelompok',VIEWER:'Viewer'};
function savedKey(n:Note){return 'simpul-note:'+n.owner_user_id+':'+n.scope+':'+n.id;}
function dateLabel(date:string){return new Date(date).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});}
function allowedScope(value:string|null):NoteScope{return value==='ROLE'||value==='MAIN'?value:'PERSONAL';}

function NotesWorkspace(){
 const searchParams=useSearchParams();
 const urlScope=searchParams.get('scope');
 const[scope,setScope]=useState<NoteScope>('PERSONAL');
 const[status,setStatus]=useState<NoteStatus>('ACTIVE');
 const[rows,setRows]=useState<Note[]>([]);
 const[draft,setDraft]=useState<Note|null>(null);
 const[user,setUser]=useState<User|null>(null);
 const[loading,setLoading]=useState(true);
 const[saving,setSaving]=useState(false);
 const[dirty,setDirty]=useState(false);
 const[error,setError]=useState('');
 const[search,setSearch]=useState('');
 const[reload,setReload]=useState(0);
 const activeNote=useRef<Note|null>(null);
 const pending=useRef(false),busy=useRef(false),conflict=useRef(false),quickCreated=useRef(false);

 useEffect(()=>{
  const fromUrl=()=>allowedScope(new URLSearchParams(window.location.search).get('scope'));
  setScope(fromUrl());
  const back=()=>{if(pending.current||busy.current)return;setScope(fromUrl());setStatus('ACTIVE');setDraft(null);activeNote.current=null;setSearch('');setError('');};
  window.addEventListener('popstate',back);
  fetch('/api/auth/me',{cache:'no-store'}).then(async r=>r.ok?await r.json():null)
   .then(data=>setUser(data&&!data.public?data:null)).catch(()=>setUser(null));
  return()=>window.removeEventListener('popstate',back);
 },[]);

 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError('');setRows([]);
  fetch('/api/notes?scope='+scope+'&status='+status,{cache:'no-store',signal:controller.signal})
   .then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Gagal memuat catatan.');return data as Note[];})
   .then(data=>{
    if(controller.signal.aborted)return;
    setRows(data);
    if(activeNote.current)return;
    for(const n of data){
     if(n.owner_user_id!==user?.id)continue;
     try{
      const item=JSON.parse(sessionStorage.getItem(savedKey(n))||'null') as Note|null;
      if(item?.id===n.id&&item.scope===n.scope&&item.owner_user_id===n.owner_user_id){
       activeNote.current=item;setDraft(item);pending.current=true;setDirty(true);break;
      }
     }catch{/* draft lokal tidak valid */}
    }
   })
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Gagal memuat catatan.');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[scope,status,reload,user?.id]);

 const flush=useCallback(async()=>{
  if(busy.current||!pending.current||!activeNote.current||conflict.current)return;
  busy.current=true;setSaving(true);setError('');
  try{
   while(pending.current&&activeNote.current){
    pending.current=false;
    const sent={...activeNote.current};
    const r=await fetch('/api/notes/'+sent.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(sent)});
    const result=await r.json() as Note&{error?:string};
    if(!r.ok){
     pending.current=true;conflict.current=r.status===409;
     throw Error(r.status===409?'Catatan diubah dari perangkat lain. Salin perubahan Anda, lalu muat ulang untuk menghindari data tertimpa.':result.error||'Gagal menyimpan.');
    }
    if(activeNote.current?.id===result.id){
     activeNote.current={...activeNote.current,revision:result.revision,updated_at:result.updated_at};
     setDraft({...activeNote.current});
     setRows(old=>old.map(n=>n.id===result.id?result:n).filter(n=>n.status===status));
    }
   }
   if(activeNote.current&&!pending.current){sessionStorage.removeItem(savedKey(activeNote.current));setDirty(false);}
  }catch(e){setError(e instanceof Error?e.message:'Gagal menyimpan.');}
  finally{busy.current=false;setSaving(false);}
 },[status]);

 useEffect(()=>{
  const wanted=allowedScope(urlScope);
  if(wanted===scope)return;
  if(pending.current||busy.current){void flush();return;}
  activeNote.current=null;conflict.current=false;setDraft(null);setStatus('ACTIVE');setSearch('');setError('');setScope(wanted);
 },[urlScope,scope,flush,saving,dirty]);

 useEffect(()=>{
  if(!dirty)return;
  const timer=window.setTimeout(()=>{void flush();},850);
  return()=>window.clearTimeout(timer);
 },[draft,dirty,flush]);
 useEffect(()=>{
  const warn=(e:BeforeUnloadEvent)=>{
   if(pending.current||busy.current){e.preventDefault();e.returnValue='';}
  };
  const retry=()=>{void flush();};
  window.addEventListener('beforeunload',warn);
  window.addEventListener('online',retry);
  return()=>{window.removeEventListener('beforeunload',warn);window.removeEventListener('online',retry);};
 },[flush]);

 const canCreate=Boolean(user&&(scope==='PERSONAL'||(scope==='ROLE'&&user.role!=='VIEWER'&&user.permissions?.['note.write']!==false)||(scope==='MAIN'&&user.role==='ADMIN')));
 const canEdit=Boolean(draft&&user&&(draft.scope==='PERSONAL'&&draft.owner_user_id===user.id||
   draft.scope==='ROLE'&&draft.owner_user_id===user.id&&user.role!=='VIEWER'&&user.permissions?.['note.write']!==false||
   draft.scope==='MAIN'&&user.role==='ADMIN'));

 function edit(change:Partial<Note>){
  if(!canEdit||!activeNote.current)return;
  activeNote.current={...activeNote.current,...change};
  pending.current=true;setDirty(true);setDraft({...activeNote.current});
  try{sessionStorage.setItem(savedKey(activeNote.current),JSON.stringify(activeNote.current));}
  catch{setError('Penyimpanan sementara tidak tersedia. Pastikan tulisan tersimpan sebelum meninggalkan halaman.');}
 }
 async function choose(next:NoteScope){
  await flush();
  if(pending.current||busy.current||next===scope)return;
  activeNote.current=null;conflict.current=false;setDraft(null);setScope(next);setStatus('ACTIVE');setSearch('');setError('');
  const url=new URL(window.location.href);url.searchParams.set('scope',next);url.searchParams.delete('create');
  window.history.pushState({},'',url);
 }
 async function changeStatus(next:NoteStatus){
  await flush();if(pending.current||busy.current)return;
  activeNote.current=null;conflict.current=false;setDraft(null);setStatus(next);setError('');
 }
 async function open(n:Note){
  await flush();if(pending.current||busy.current)return;
  activeNote.current={...n};conflict.current=false;setDraft({...n});setError('');
 }
 async function create(){
  if(!canCreate)return;
  await flush();if(pending.current||busy.current)return;
  setSaving(true);setError('');
  try{
   const r=await fetch('/api/notes',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({scope,title:'Catatan baru',content:'',status:'ACTIVE',is_pinned:false,revision:0})});
   const n=await r.json() as Note&{error?:string};
   if(!r.ok)throw Error(n.error||'Catatan gagal dibuat.');
   setStatus('ACTIVE');setRows(old=>status==='ACTIVE'?[n,...old]:[n]);
   activeNote.current=n;conflict.current=false;setDraft(n);
  }catch(e){setError(e instanceof Error?e.message:'Gagal membuat catatan.');}
  finally{setSaving(false);}
 }
 useEffect(()=>{
  if(quickCreated.current||!user||loading)return;
  if(new URLSearchParams(window.location.search).get('create')==='1'&&canCreate){
   quickCreated.current=true;void create();
  }
 },[user,loading,canCreate]);

 const filtered=useMemo(()=>rows.filter(n=>(n.title+' '+n.content).toLowerCase().includes(search.trim().toLowerCase())),[rows,search]);
 const selected=tabs.find(x=>x.id===scope)!;
 return <div className="notesPage">
  <header className="pageHeader notesHeader">
   <div><span className="notesEyebrow"><NotebookPen size={15}/> RUANG CATATAN SIMPUL</span>
    <h1>Catatan</h1><p>Simpan informasi dengan jelas. Setiap jenis memiliki data dan akses tersendiri.</p></div>
   <button type="button" className="btn" onClick={()=>void create()} disabled={!canCreate||saving||dirty||loading}>
    <Plus size={17}/> Tambah Catatan
   </button>
  </header>
  <div className="notesScopes" role="tablist" aria-label="Jenis catatan">
   {tabs.map(item=>{const Icon=item.icon;return <button key={item.id} type="button" role="tab" aria-selected={scope===item.id}
    className={'notesScope '+(scope===item.id?'active':'')} onClick={()=>void choose(item.id)} disabled={saving}>
    <span className="notesScopeIcon"><Icon size={20}/></span><span><strong>{item.label}</strong><small>{item.caption}</small></span>
   </button>;})}
  </div>
  <div className="notesBar">
   <div className="notesScopeSummary"><ShieldCheck size={17}/><span><strong>Catatan {selected.label}</strong> · {scope==='ROLE'?(user?roles[user.role]:'Login diperlukan'):scope==='MAIN'?'Dibaca seluruh akun':'Khusus akun Anda'}</span></div>
   <div className="notesTools">
    <label className="notesSearch"><Search size={16}/><input aria-label="Cari judul atau isi catatan" placeholder="Cari catatan..." value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <select className="select" aria-label="Filter status catatan" value={status} disabled={saving||dirty} onChange={e=>void changeStatus(e.target.value as NoteStatus)}>
     {Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select>
   </div>
  </div>
  {error&&<div className="notice error notesError" role="alert"><span>{error}</span>
   <button className="smallAction" type="button" onClick={()=>{if(conflict.current){activeNote.current=null;pending.current=false;conflict.current=false;setDraft(null);setDirty(false);setReload(n=>n+1);}else void flush();}}>{conflict.current?'Muat ulang':'Coba simpan'}</button></div>}
  <div className="notesWorkspace">
   <section className="notesList" aria-label="Daftar catatan">
    <div className="notesListTitle"><strong>{statusLabels[status]} · {selected.label}</strong><span>{loading?'…':filtered.length} catatan</span></div>
    {loading?<div className="notesEmpty">Memuat catatan...</div>:filtered.length===0?
     <div className="notesEmpty"><NotebookPen size={26}/><strong>Belum ada catatan</strong><p>{selected.empty}</p></div>:
     <div className="notesItems">{filtered.map(n=><button key={n.id} className={'notesItem '+(draft?.id===n.id?'selected':'')} onClick={()=>void open(n)} type="button">
      <span className="notesItemTop"><strong>{n.is_pinned&&<Pin size={14} fill="currentColor"/>}{n.title}</strong><small>{dateLabel(n.updated_at)}</small></span>
      <span className="notesItemPreview">{n.content.trim()||'Belum ada isi. Pilih untuk mulai menulis.'}</span>
      {n.scope==='ROLE'&&<small className="notesItemTag">{n.owner_user_id===user?.id?'Catatan Anda':'Dibagikan oleh anggota role'}</small>}
     </button>)}</div>}
   </section>
   <section className="notesEditor" aria-label="Editor catatan">
    {!draft?<div className="notesEditorEmpty"><NotebookPen size={30}/><h2>Pilih catatan</h2><p>Buka catatan dari daftar atau tambahkan catatan baru untuk mulai menulis.</p></div>:
    <>
     <div className="notesEditorTop"><span className="notesSaveState"><span className={'notesStatusDot '+(dirty?'pending':'')}/>{saving?'Menyimpan…':dirty?'Perubahan belum tersimpan':'Tersimpan'}</span>
      <div className="notesEditorActions">{canEdit&&<button className="smallAction" title={draft.is_pinned?'Lepas sematan':'Sematkan'} onClick={()=>edit({is_pinned:!draft.is_pinned})}>
       <Pin size={15}/>{draft.is_pinned?'Lepas':'Sematkan'}
      </button>}</div>
     </div>
     {!canEdit&&<div className="notesReadonly"><LockKeyhole size={15}/> Catatan ini hanya dapat diubah oleh pembuatnya.</div>}
     <label className="notesFieldLabel" htmlFor="note-title">Judul</label>
     <input id="note-title" className="notesTitleInput" placeholder="Judul catatan" maxLength={200}
      value={draft.title} readOnly={!canEdit} onChange={e=>edit({title:e.target.value})}/>
     <label className="notesFieldLabel" htmlFor="note-content">Isi catatan</label>
     <textarea id="note-content" className="notesBody" placeholder="Tuliskan informasi, hal penting, atau tindak lanjut..."
      maxLength={100000} value={draft.content} readOnly={!canEdit} onChange={e=>edit({content:e.target.value})}/>
     <div className="notesEditorFooter"><span><CheckCheck size={15}/> Diperbarui {dateLabel(draft.updated_at)}</span>
      {canEdit&&<div className="notesFooterActions">
       {draft.status==='ACTIVE'?<button className="smallAction" onClick={()=>{edit({status:'ARCHIVED'});void flush();}}><Archive size={15}/> Arsipkan</button>:
       <button className="smallAction" onClick={()=>{edit({status:'ACTIVE'});void flush();}}><RotateCcw size={15}/> Pulihkan</button>}
       {draft.status!=='DELETED'&&<button className="smallAction danger" onClick={()=>{edit({status:'DELETED'});void flush();}}><Trash2 size={15}/> Sampah</button>}
      </div>}
     </div>
    </>}
   </section>
  </div>
 </div>;
}

export default function Notes(){
 return <Suspense fallback={<div className="notesEmpty">Memuat catatan...</div>}><NotesWorkspace/></Suspense>;
}
