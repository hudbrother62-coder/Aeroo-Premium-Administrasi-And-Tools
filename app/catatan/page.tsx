'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';

type ContextType='PERSONAL'|'MEMBER'|'EVENT'|'AGENDA'|'CLASS'|'AUDIENCE'|'JOURNAL'|'ENTITY';
type Visibility='PRIVATE'|'ACCESS';
type Note={
 id:string;owner_user_id:string;title:string;content:string;status:string;is_pinned:boolean;revision:number;updated_at:string;
 visibility:Visibility;context_type:ContextType;audience:string|null;class_id:string|null;member_id:string|null;agenda_id:string|null;
 event_id:string|null;journal_id:string|null;entity_type:string|null;entity_id:string|null;context_label:string|null;
};
type Option={id:string;name?:string;title?:string;event_date?:string;journal_date?:string;starts_at?:string;audience?:string;classes?:{name?:string}|null};
type Options={members:Option[];events:Option[];agenda:Option[];classes:Option[];journals:Option[];audiences:string[]};
type Me={id:string|null;role:string;display_name?:string|null};

const contextLabels:Record<ContextType,string>={
 PERSONAL:'Pribadi',MEMBER:'Individu / anggota',EVENT:'Pertemuan / presensi',AGENDA:'Kegiatan / agenda',
 CLASS:'Kelas',AUDIENCE:'Lingkup akses',JOURNAL:'Jurnal',ENTITY:'Unsur lain'
};
const audienceLabels:Record<string,string>={KELOMPOK:'Semua Anggota',CABERAWIT:'Caberawit',MUDA_MUDI:'Muda-Mudi',IBU_IBU:'Ibu-Ibu',PENGURUS:'Pengurus'};

function emptyAnchors(n:Note):Note{
 return {...n,audience:null,class_id:null,member_id:null,agenda_id:null,event_id:null,journal_id:null,entity_type:null,entity_id:null,context_label:null};
}

export default function Notes(){
 const[rows,setRows]=useState<Note[]>([]),[draft,setDraft]=useState<Note|null>(null),[status,setStatus]=useState('ACTIVE'),[query,setQuery]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false),[dirty,setDirty]=useState(false),[loading,setLoading]=useState(true),[mineOnly,setMineOnly]=useState(false);
 const[options,setOptions]=useState<Options>({members:[],events:[],agenda:[],classes:[],journals:[],audiences:[]}),[me,setMe]=useState<Me|null>(null);
 const current=useRef<Note|null>(null),pending=useRef(false),busy=useRef(false),conflict=useRef(false);

 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const [r,meR,optR]=await Promise.all([
    fetch('/api/notes?status='+status+(mineOnly?'&mine=1':''),{cache:'no-store'}),
    fetch('/api/auth/me',{cache:'no-store'}),
    fetch('/api/notes/options',{cache:'no-store'})
   ]);
   const [data,meData,optData]=await Promise.all([r.json(),meR.json(),optR.json()]);
   if(!r.ok)throw Error(data.error||'Gagal memuat catatan.');
   setRows(data);if(meR.ok)setMe(meData);if(optR.ok)setOptions(optData);
   const ownId=meR.ok?meData.id:null;
   for(const n of data){
    if(n.owner_user_id!==ownId)continue;
    try{
     const stored=JSON.parse(sessionStorage.getItem('simpul-note-draft:'+n.id)||'null');
     if(stored?.owner_user_id===n.owner_user_id&&!current.current){current.current=stored;setDraft(stored);pending.current=true;setDirty(true);break}
    }catch{}
   }
  }catch(e){setError(e instanceof Error?e.message:'Gagal memuat.')}finally{setLoading(false)}
 },[status,mineOnly]);

 useEffect(()=>{void load()},[load]);

 const flush=useCallback(async()=>{
  if(busy.current||!pending.current||!current.current||conflict.current)return;
  if(current.current.owner_user_id!==me?.id){pending.current=false;setDirty(false);return}
  busy.current=true;setSaving(true);setError('');
  try{
   while(pending.current&&current.current){
    pending.current=false;const sent:Note={...current.current};
    const r=await fetch('/api/notes/'+sent.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(sent)});
    const saved:Note&{error?:string}=await r.json();
    if(!r.ok){pending.current=true;conflict.current=r.status===409;throw Error(r.status===409?'Catatan berubah di perangkat lain. Muat ulang sebelum melanjutkan.':saved.error||'Gagal menyimpan.')}
    if(current.current?.id===saved.id){current.current={...current.current,...saved};setDraft({...current.current});setRows(v=>v.map(x=>x.id===saved.id?saved:x).filter(x=>x.status===status))}
   }
   if(current.current)sessionStorage.removeItem('simpul-note-draft:'+current.current.id);
   setDirty(false);
  }catch(e){setError(e instanceof Error?e.message:'Gagal menyimpan.')}finally{busy.current=false;setSaving(false)}
 },[status,me?.id]);

 useEffect(()=>{if(!dirty)return;const t=setTimeout(()=>void flush(),650);return()=>clearTimeout(t)},[draft,dirty,flush]);
 useEffect(()=>{
  const warn=(e:BeforeUnloadEvent)=>{if(pending.current||busy.current){e.preventDefault();e.returnValue=''}};
  const online=()=>void flush();window.addEventListener('beforeunload',warn);window.addEventListener('online',online);
  return()=>{window.removeEventListener('beforeunload',warn);window.removeEventListener('online',online)}
 },[flush]);

 const quickCreated=useRef(false);
 useEffect(()=>{
  if(quickCreated.current||loading||new URLSearchParams(window.location.search).get('create')!=='1')return;
  quickCreated.current=true;void createFromUrl();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[loading]);

 function edit(values:Partial<Note>){
  if(!current.current||current.current.owner_user_id!==me?.id)return;
  current.current={...current.current,...values};pending.current=true;
  try{sessionStorage.setItem('simpul-note-draft:'+current.current.id,JSON.stringify(current.current))}catch{setError('Penyimpanan perangkat tidak tersedia. Jangan tutup sebelum tersimpan.')}
  setDirty(true);setDraft({...current.current});
 }

 async function select(n:Note){
  await flush();if(pending.current||busy.current)return;conflict.current=false;
  let recovered:Note|null=null;
  if(n.owner_user_id===me?.id)try{const stored=JSON.parse(sessionStorage.getItem('simpul-note-draft:'+n.id)||'null');if(stored?.id===n.id&&stored.owner_user_id===n.owner_user_id)recovered=stored}catch{}
  current.current=recovered||{...n};setDraft({...current.current});setError('');
  if(recovered){pending.current=true;setDirty(true);void flush()}
 }

 async function create(initial:Partial<Note>={}){
  await flush();if(pending.current||busy.current)return;setSaving(true);setError('');
  try{
   const payload={
    title:'Catatan baru',content:'',status:'ACTIVE',is_pinned:false,visibility:'PRIVATE',context_type:'PERSONAL',
    audience:null,class_id:null,member_id:null,agenda_id:null,event_id:null,journal_id:null,entity_type:null,entity_id:null,context_label:null,
    ...initial
   };
   const r=await fetch('/api/notes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
   const n=await r.json();if(!r.ok)throw Error(n.error||'Gagal membuat.');
   setStatus('ACTIVE');setRows(v=>[n,...v]);current.current=n;setDraft(n);conflict.current=false;setMineOnly(false);
  }catch(e){setError(e instanceof Error?e.message:'Gagal membuat.')}finally{setSaving(false)}
 }

 async function createFromUrl(){
  const p=new URLSearchParams(window.location.search);const type=String(p.get('context')||'PERSONAL').toUpperCase() as ContextType;
  const allowed:Object= contextLabels;
  if(!(type in allowed)){await create();return}
  const initial:Partial<Note>={context_type:type,visibility:p.get('share')==='1'?'ACCESS':'PRIVATE'};
  if(type==='MEMBER')initial.member_id=p.get('member_id');
  if(type==='EVENT')initial.event_id=p.get('event_id');
  if(type==='AGENDA')initial.agenda_id=p.get('agenda_id');
  if(type==='CLASS')initial.class_id=p.get('class_id');
  if(type==='AUDIENCE')initial.audience=p.get('audience');
  if(type==='JOURNAL')initial.journal_id=p.get('journal_id');
  if(type==='ENTITY'){initial.entity_type=p.get('entity_type');initial.entity_id=p.get('entity_id');initial.context_label=p.get('label')}
  await create(initial);
 }

 function changeContext(type:ContextType){
  if(!draft)return;const cleared=emptyAnchors(draft);edit({...cleared,context_type:type,visibility:type==='PERSONAL'?'PRIVATE':draft.visibility});
 }
 function optionText(n:Note){
  if(n.context_type==='PERSONAL')return 'Pribadi';
  if(n.context_label)return n.context_label;
  if(n.member_id)return options.members.find(x=>x.id===n.member_id)?.name||'Individu';
  if(n.event_id){const x=options.events.find(v=>v.id===n.event_id);return x?x.title+' · '+x.event_date:'Pertemuan'}
  if(n.agenda_id){const x=options.agenda.find(v=>v.id===n.agenda_id);return x?x.title:'Agenda'}
  if(n.class_id)return options.classes.find(x=>x.id===n.class_id)?.name||'Kelas';
  if(n.audience)return audienceLabels[n.audience]||n.audience;
  if(n.journal_id){const x=options.journals.find(v=>v.id===n.journal_id);return x?x.title:'Jurnal'}
  return contextLabels[n.context_type];
 }
 const filtered=useMemo(()=>rows.filter(n=>(n.title+' '+n.content+' '+optionText(n)).toLowerCase().includes(query.toLowerCase())),[rows,query,options]);
 const editable=!!draft&&draft.owner_user_id===me?.id;

 return <><div className="pageHeader"><div><h1>Catatan</h1><p>Catatan pribadi atau catatan yang melekat ke orang, kelas, kegiatan, pertemuan, jurnal, dan lingkup akses.</p></div><button className="btn" disabled={saving||dirty} onClick={()=>void create()}>+ Catatan</button></div>
  <div className="toolbar"><input aria-label="Cari catatan" className="input" placeholder="Cari isi atau konteks catatan" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Status catatan" className="select" value={status} disabled={dirty||saving} onChange={e=>{setStatus(e.target.value);setDraft(null);current.current=null}}><option value="ACTIVE">Aktif</option><option value="ARCHIVED">Arsip</option><option value="DELETED">Sampah</option></select><label className="compactToggle"><input type="checkbox" checked={mineOnly} onChange={e=>setMineOnly(e.target.checked)}/> Hanya milik saya</label></div>
  {error&&<div role="alert" className="notice error">{error}{editable&&<button className="smallAction" onClick={()=>void flush()}>Coba simpan</button>}</div>}
  <div className="notesLayout section">
   <section className="noteList">{loading?<div className="card">Memuat…</div>:filtered.map(n=><button className={'noteItem '+(draft?.id===n.id?'selected':'')} key={n.id} onClick={()=>void select(n)} disabled={saving}><strong>{n.is_pinned?'📌 ':''}{n.title}</strong><span>{n.content.slice(0,90)||'Kosong'}</span><small>{optionText(n)} · {n.visibility==='PRIVATE'?'Pribadi':'Sesuai akses'} · {new Date(n.updated_at).toLocaleDateString('id-ID')}</small></button>)}{!loading&&!filtered.length&&<div className="emptyState">Belum ada catatan yang cocok.</div>}</section>
   {draft?<section className="card noteEditor">
    <div className="row between"><span role="status">{!editable?'Dibaca sesuai akses':saving?'Menyimpan…':dirty?'Belum tersimpan':'Tersimpan'}</span>{editable&&<button className="smallAction" onClick={()=>edit({is_pinned:!draft.is_pinned})}>{draft.is_pinned?'Lepas sematan':'Sematkan'}</button>}</div>
    <input aria-label="Judul catatan" className="input" maxLength={200} value={draft.title} readOnly={!editable} onChange={e=>edit({title:e.target.value})}/>
    <textarea aria-label="Isi catatan" className="textarea" maxLength={100000} value={draft.content} readOnly={!editable} onChange={e=>edit({content:e.target.value})}/>
    <div className="noteContextPanel">
      <label>Jenis catatan<select className="select" disabled={!editable} value={draft.context_type} onChange={e=>changeContext(e.target.value as ContextType)}>{Object.entries(contextLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>Visibilitas<select className="select" disabled={!editable||draft.context_type==='PERSONAL'} value={draft.visibility} onChange={e=>edit({visibility:e.target.value as Visibility})}><option value="PRIVATE">Pribadi — hanya saya</option><option value="ACCESS">Sesuai akses — pengguna yang berhak pada konteks</option></select></label>
      {draft.context_type==='MEMBER'&&<label>Individu<select className="select" disabled={!editable} value={draft.member_id||''} onChange={e=>edit({member_id:e.target.value||null,context_label:options.members.find(x=>x.id===e.target.value)?.name||null})}><option value="">Pilih anggota</option>{options.members.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
      {draft.context_type==='EVENT'&&<label>Pertemuan<select className="select" disabled={!editable} value={draft.event_id||''} onChange={e=>{const x=options.events.find(v=>v.id===e.target.value);edit({event_id:e.target.value||null,class_id:x?.class_id||null,audience:x?.audience||null,context_label:x?x.title+' · '+x.event_date:null})}}><option value="">Pilih pertemuan</option>{options.events.map(x=><option key={x.id} value={x.id}>{x.title} · {x.event_date}{x.classes?.name?' · '+x.classes.name:''}</option>)}</select></label>}
      {draft.context_type==='AGENDA'&&<label>Kegiatan / agenda<select className="select" disabled={!editable} value={draft.agenda_id||''} onChange={e=>{const x=options.agenda.find(v=>v.id===e.target.value);edit({agenda_id:e.target.value||null,class_id:x?.class_id||null,audience:x?.audience||null,context_label:x?.title||null})}}><option value="">Pilih agenda</option>{options.agenda.map(x=><option key={x.id} value={x.id}>{x.title}{x.classes?.name?' · '+x.classes.name:''}</option>)}</select></label>}
      {draft.context_type==='CLASS'&&<label>Kelas<select className="select" disabled={!editable} value={draft.class_id||''} onChange={e=>{const x=options.classes.find(v=>v.id===e.target.value);edit({class_id:e.target.value||null,audience:x?.audience||null,context_label:x?.name||null})}}><option value="">Pilih kelas</option>{options.classes.map(x=><option key={x.id} value={x.id}>{x.name} · {audienceLabels[x.audience||'']||x.audience}</option>)}</select></label>}
      {draft.context_type==='AUDIENCE'&&<label>Lingkup akses<select className="select" disabled={!editable} value={draft.audience||''} onChange={e=>edit({audience:e.target.value||null,context_label:audienceLabels[e.target.value]||e.target.value})}><option value="">Pilih lingkup</option>{options.audiences.map(x=><option key={x} value={x}>{audienceLabels[x]||x}</option>)}</select></label>}
      {draft.context_type==='JOURNAL'&&<label>Jurnal<select className="select" disabled={!editable} value={draft.journal_id||''} onChange={e=>{const x=options.journals.find(v=>v.id===e.target.value);edit({journal_id:e.target.value||null,class_id:x?.class_id||null,context_label:x?.title||null})}}><option value="">Pilih jurnal</option>{options.journals.map(x=><option key={x.id} value={x.id}>{x.title} · {x.journal_date}</option>)}</select></label>}
      {draft.context_type==='ENTITY'&&<><label>Nama unsur<input className="input" disabled={!editable} value={draft.context_label||''} onChange={e=>edit({context_label:e.target.value})} placeholder="Contoh: keputusan rapat, dokumen, target, tindak lanjut"/></label><label>Jenis unsur<input className="input" disabled={!editable} value={draft.entity_type||''} onChange={e=>edit({entity_type:e.target.value})} placeholder="Contoh: keputusan, dokumen, target"/></label><label>Lingkup pengaman<select className="select" disabled={!editable} value={draft.audience||''} onChange={e=>edit({audience:e.target.value||null})}><option value="">Pribadi saja / pilih lingkup bila dibagikan</option>{options.audiences.map(x=><option key={x} value={x}>{audienceLabels[x]||x}</option>)}</select></label></>}
    </div>
    {editable?<div className="row"><button className="smallAction" onClick={()=>{edit({status:draft.status==='ARCHIVED'||draft.status==='DELETED'?'ACTIVE':'ARCHIVED'});void flush()}}>{draft.status==='ACTIVE'?'Arsipkan':'Pulihkan'}</button>{draft.status!=='DELETED'&&<button className="smallAction danger" onClick={()=>{edit({status:'DELETED'});void flush()}}>Pindahkan ke sampah</button>}</div>:<div className="notice">Catatan ini dibuat pengguna lain dan hanya dapat dibaca sesuai akses Anda.</div>}
   </section>:<div className="emptyState">Pilih catatan.</div>}
  </div>
 </>;
}
