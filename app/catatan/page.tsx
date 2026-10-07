'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {jakartaDate} from '@/lib/domain';

type NoteContext='PERSONAL'|'MEMBER'|'MEETING'|'CLASS'|'PROGRAM'|'GENERAL';
type NoteVisibility='PRIVATE'|'ROLE'|'ACCESS';
type Note={id:string;owner_user_id:string;title:string;content:string;status:string;is_pinned:boolean;revision:number;updated_at:string;context_type:NoteContext;visibility:NoteVisibility;audience?:string|null;class_id?:string|null;member_id?:string|null;attendance_event_id?:string|null;agenda_id?:string|null;journal_id?:string|null;role_scope?:string|null};
type Member={id:string;name:string};
type ClassRow={id:string;name:string;audience:string};
type Meeting={id:string;title:string;event_date:string;audience:string;classes?:{name?:string}};

const contextLabels:Record<NoteContext,string>={PERSONAL:'Pribadi',MEMBER:'Individu',MEETING:'Kegiatan / Pertemuan',CLASS:'Kelas',PROGRAM:'Lingkup / Unsur',GENERAL:'Umum'};
const visibilityLabels:Record<NoteVisibility,string>={PRIVATE:'Hanya saya',ROLE:'Role yang sama',ACCESS:'Semua yang punya akses terkait'};
const audiences=[['KELOMPOK','Kelompok'],['CABERAWIT','Caberawit'],['MUDA_MUDI','Muda-Mudi'],['IBU_IBU','Ibu-Ibu'],['PENGURUS','Pengurus']] as const;

export default function Notes(){
 const[rows,setRows]=useState<Note[]>([]),[draft,setDraft]=useState<Note|null>(null),[status,setStatus]=useState('ACTIVE'),[query,setQuery]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false),[dirty,setDirty]=useState(false),[loading,setLoading]=useState(true);
 const[members,setMembers]=useState<Member[]>([]),[classes,setClasses]=useState<ClassRow[]>([]),[meetings,setMeetings]=useState<Meeting[]>([]);
 const current=useRef<Note|null>(null),pending=useRef(false),busy=useRef(false),conflict=useRef(false);

 const load=useCallback(async()=>{
  setLoading(true);
  try{
    const r=await fetch('/api/notes?status='+status,{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error);setRows(data);
    for(const n of data){try{const stored=JSON.parse(sessionStorage.getItem('airo-note-draft:'+n.id)||'null');if(stored?.owner_user_id===n.owner_user_id&&!current.current){current.current=stored;setDraft(stored);pending.current=true;setDirty(true);break}}catch{}}
  }catch(e){setError(e instanceof Error?e.message:'Gagal memuat.')}finally{setLoading(false)}
 },[status]);
 useEffect(()=>{void load()},[load]);

 useEffect(()=>{
   const from=new Date();from.setDate(from.getDate()-90);
   Promise.all([
    fetch('/api/members?mode=names&status=ACTIVE').then(r=>r.json()),
    fetch('/api/classes').then(r=>r.json()),
    fetch('/api/attendance?from='+from.toISOString().slice(0,10)+'&to='+jakartaDate()).then(r=>r.json())
   ]).then(([m,c,e])=>{if(Array.isArray(m))setMembers(m);if(Array.isArray(c))setClasses(c);if(Array.isArray(e))setMeetings(e)}).catch(()=>{});
 },[]);

 const quickCreated=useRef(false);
 useEffect(()=>{if(quickCreated.current||new URLSearchParams(window.location.search).get('create')!=='1'||loading)return;quickCreated.current=true;void create()},[loading]);

 const flush=useCallback(async()=>{
  if(busy.current||!pending.current||!current.current||conflict.current)return;
  busy.current=true;setSaving(true);setError('');
  try{
   while(pending.current&&current.current){
    pending.current=false;const sent:Note={...current.current};
    const r:Response=await fetch('/api/notes/'+sent.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(sent)});
    const saved:Note&{error?:string}=await r.json();
    if(!r.ok){pending.current=true;conflict.current=r.status===409;throw Error(r.status===409?'Catatan berubah di perangkat lain. Salin tulisan Anda sebelum memuat ulang.':saved.error)}
    if(current.current?.id===saved.id){current.current={...current.current,...saved};setDraft({...current.current});setRows(v=>v.map(x=>x.id===saved.id?saved:x).filter(x=>x.status===status));}
   }
   if(current.current)sessionStorage.removeItem('airo-note-draft:'+current.current.id);setDirty(false)
  }catch(e){setError(e instanceof Error?e.message:'Gagal menyimpan.')}finally{busy.current=false;setSaving(false)}
 },[status]);

 useEffect(()=>{if(!dirty)return;const t=setTimeout(()=>void flush(),650);return()=>clearTimeout(t)},[draft,dirty,flush]);
 useEffect(()=>{const navigate=async(e:MouseEvent)=>{const link=(e.target as Element)?.closest?.('a[href]') as HTMLAnchorElement|null;if(!link||(!pending.current&&!busy.current)||e.ctrlKey||e.metaKey||link.target==='_blank')return;e.preventDefault();e.stopPropagation();await flush();if(!pending.current&&!busy.current)window.location.href=link.href};document.addEventListener('click',navigate,true);const warn=(e:BeforeUnloadEvent)=>{if(pending.current||busy.current){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn);const online=()=>void flush();window.addEventListener('online',online);return()=>{document.removeEventListener('click',navigate,true);window.removeEventListener('beforeunload',warn);window.removeEventListener('online',online)}},[flush]);

 function edit(values:Partial<Note>){
  if(!current.current)return;
  const next={...current.current,...values};
  if(values.context_type==='PERSONAL'){next.visibility='PRIVATE';next.member_id=null;next.class_id=null;next.attendance_event_id=null;next.audience=null}
  current.current=next;pending.current=true;
  try{sessionStorage.setItem('airo-note-draft:'+current.current.id,JSON.stringify(current.current))}catch{setError('Penyimpanan perangkat tidak tersedia. Jangan tutup sebelum tersimpan.')}
  setDirty(true);setDraft({...current.current});
 }
 async function select(n:Note){await flush();if(pending.current||busy.current)return;conflict.current=false;let recovered:Note|null=null;try{const stored=JSON.parse(sessionStorage.getItem('airo-note-draft:'+n.id)||'null');if(stored?.id===n.id&&stored.owner_user_id===n.owner_user_id)recovered=stored}catch{}current.current=recovered||{...n};setDraft({...current.current});setError('');if(recovered){pending.current=true;setDirty(true);void flush()}}
 async function create(){
  await flush();if(pending.current||busy.current)return;setSaving(true);
  try{
   const payload={title:'Catatan baru',content:'',context_type:'PERSONAL',visibility:'PRIVATE',status:'ACTIVE',is_pinned:false,revision:0};
   const r=await fetch('/api/notes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const n=await r.json();if(!r.ok)throw Error(n.error);
   setStatus('ACTIVE');setRows(v=>[n,...v]);current.current=n;setDraft(n);conflict.current=false
  }catch(e){setError(e instanceof Error?e.message:'Gagal membuat.')}finally{setSaving(false)}
 }

 const filtered=useMemo(()=>rows.filter(n=>(n.title+' '+n.content+' '+contextLabels[n.context_type]).toLowerCase().includes(query.toLowerCase())),[rows,query]);

 return <><div className="pageHeader"><div><h1>Catatan</h1><p>Catatan pribadi, individu, kelas, pertemuan, dan unsur akses dalam satu tempat.</p></div><button className="btn" disabled={saving||dirty} onClick={()=>void create()}>+ Catatan</button></div>
 <div className="toolbar"><input aria-label="Cari catatan" className="input" placeholder="Cari catatan" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Status catatan" className="select" value={status} disabled={dirty||saving} onChange={e=>{setStatus(e.target.value);setDraft(null);current.current=null}}><option value="ACTIVE">Aktif</option><option value="ARCHIVED">Arsip</option><option value="DELETED">Sampah</option></select></div>
 {error&&<div role="alert" className="notice error">{error}<button className="smallAction" onClick={()=>void flush()}>Coba simpan</button></div>}
 <div className="notesLayout section"><section className="noteList">{loading?<div className="card">Memuat…</div>:filtered.map(n=><button className={'noteItem '+(draft?.id===n.id?'selected':'')} key={n.id} onClick={()=>void select(n)} disabled={saving}><strong>{n.is_pinned?'📌 ':''}{n.title}</strong><span className="noteContextLabel">{contextLabels[n.context_type]} · {visibilityLabels[n.visibility]}</span><span>{n.content.slice(0,100)||'Kosong'}</span><small>{new Date(n.updated_at).toLocaleDateString('id-ID')}</small></button>)}{!loading&&!filtered.length&&<div className="emptyState">Belum ada catatan.</div>}</section>
 {draft?<section className="card noteEditor"><div className="row between"><span role="status">{saving?'Menyimpan…':dirty?'Belum tersimpan':'Tersimpan'}</span><button className="smallAction" onClick={()=>edit({is_pinned:!draft.is_pinned})}>{draft.is_pinned?'Lepas sematan':'Sematkan'}</button></div>
 <div className="formGrid noteMetaGrid"><label>Jenis catatan<select className="select" value={draft.context_type} onChange={e=>edit({context_type:e.target.value as NoteContext,member_id:null,class_id:null,attendance_event_id:null,audience:null})}>{Object.entries(contextLabels).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><label>Siapa yang bisa melihat<select className="select" value={draft.context_type==='PERSONAL'?'PRIVATE':draft.visibility} disabled={draft.context_type==='PERSONAL'} onChange={e=>edit({visibility:e.target.value as NoteVisibility})}>{Object.entries(visibilityLabels).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
 {draft.context_type==='MEMBER'&&<label className="span2">Individu<select className="select" required value={draft.member_id||''} onChange={e=>edit({member_id:e.target.value||null})}><option value="">Pilih orang</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
 {draft.context_type==='CLASS'&&<label className="span2">Kelas<select className="select" required value={draft.class_id||''} onChange={e=>edit({class_id:e.target.value||null})}><option value="">Pilih kelas</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name} · {c.audience}</option>)}</select></label>}
 {draft.context_type==='PROGRAM'&&<label className="span2">Lingkup / unsur<select className="select" required value={draft.audience||''} onChange={e=>edit({audience:e.target.value||null})}><option value="">Pilih lingkup</option>{audiences.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>}
 {draft.context_type==='MEETING'&&<label className="span2">Kegiatan / pertemuan<select className="select" required value={draft.attendance_event_id||''} onChange={e=>edit({attendance_event_id:e.target.value||null})}><option value="">Pilih pertemuan</option>{meetings.map(m=><option key={m.id} value={m.id}>{m.event_date} · {m.title}{m.classes?.name?' · '+m.classes.name:''}</option>)}</select></label>}
 </div>
 <input aria-label="Judul catatan" className="input" maxLength={200} value={draft.title} onChange={e=>edit({title:e.target.value})}/><textarea aria-label="Isi catatan" className="textarea noteBody" maxLength={100000} value={draft.content} onChange={e=>edit({content:e.target.value})} placeholder="Tulis detail, temuan, tindak lanjut, hal penting, atau catatan perkembangan…"/>
 <div className="row"><button className="smallAction" onClick={()=>{edit({status:draft.status==='ARCHIVED'||draft.status==='DELETED'?'ACTIVE':'ARCHIVED'});void flush()}}>{draft.status==='ACTIVE'?'Arsipkan':'Pulihkan'}</button>{draft.status!=='DELETED'&&<button className="smallAction danger" onClick={()=>{edit({status:'DELETED'});void flush()}}>Pindahkan ke sampah</button>}</div>
 </section>:<div className="emptyState">Pilih catatan.</div>}</div></>
}
