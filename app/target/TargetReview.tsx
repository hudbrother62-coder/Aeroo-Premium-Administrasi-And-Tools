'use client';

import {FormEvent,useEffect,useMemo,useState} from 'react';
import {
  BookOpen,BookMarked,Search,Filter,Layers3,CalendarDays,ChevronRight,
  ChevronLeft,X,ClipboardList,UsersRound,FileSpreadsheet,FileText,
  CheckCircle2,ArrowUpRight,Copy,Plus,UploadCloud,GraduationCap,FolderTree
} from 'lucide-react';
import './review.css';

type Source={
  aspect?:string|null;subject?:string|null;parent?:string|null;program?:string|null;
  semester?:number|null;source_file?:string|null;source_sheet?:string|null;
  source_row?:number|null;source_cell?:string|null;source_kind?:string|null;
  planned_month_numbers?:number[]|null;
};
type Target={
  id:string;level_id?:string;class_id?:string|null;code?:string|null;title:string;
  description?:string|null;target_month?:string|null;target_value?:number|null;
  target_unit?:string|null;sort_order?:number;
  levels?:{name?:string}|null;classes?:{name?:string}|null;source_metadata?:Source|null;
};
type Version={id:string;title:string;version:number;period_start?:string|null;period_end?:string|null;source_file_name?:string|null};
type Overview={
  individual:Array<{id:string;name:string;class_name?:string;level_name?:string;targets:number;assessed:number;percentage:number|null}>;
  classes:Array<{name:string;count:number;percentage:number|null}>;
};
type GroupRows=Record<string,Array<[number,string,string]>>;
type MonthRows=Record<string,Record<string,number[]>>;
type Tab='catalog'|'structure'|'progress'|'manage';
type Level={id:string;name:string};
type ClassItem={id:string;name:string;level_id?:string|null};

const months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const monthName=(n:number)=>months[n-1]||String(n);
const clean=(v:string|number|null|undefined)=>String(v??'').trim();
const levelRank=(s:string)=>s==='PAUD'?0:s.startsWith('SD ')?Number(s.slice(3)):s==='Remaja'?7:99;
const uniqueMonths=(t:Target):number[]=>{
  const scheduled=t.source_metadata?.planned_month_numbers;
  const source=Array.isArray(scheduled)?scheduled.filter(v=>Number.isInteger(v)&&v>=1&&v<=12):[];
  if(t.target_month&&/^\d{4}-\d{2}/.test(t.target_month))source.push(Number(t.target_month.slice(5,7)));
  return [...new Set(source)].sort((a,b)=>a-b);
};
const targetSummary=(t:Target)=>[
  'Target: '+t.title,
  'Jenjang: '+clean(t.levels?.name||'Tidak ditentukan'),
  'Aspek: '+clean(t.source_metadata?.aspect||'-'),
  'Mata pelajaran: '+clean(t.source_metadata?.subject||'-'),
  'Materi induk: '+clean(t.source_metadata?.parent||'-'),
  'Uraian: '+clean(t.description||'-'),
  'Jadwal sumber: '+(uniqueMonths(t).map(monthName).join(', ')||'Sepanjang semester'),
  'Sumber: '+clean(t.source_metadata?.source_file||'-'),
  'Sheet/baris: '+clean(t.source_metadata?.source_sheet||'-')+' / '+clean(t.source_metadata?.source_row||'-')
].join('\n');

export default function TargetReview(){
  const [versions,setVersions]=useState<Version[]>([]);
  const [selected,setSelected]=useState('');
  const [targets,setTargets]=useState<Target[]>([]);
  const [groups,setGroups]=useState<GroupRows>({});
  const [groupMonths,setGroupMonths]=useState<MonthRows>({});
  const [role,setRole]=useState('VIEWER');
  const [levels,setLevels]=useState<Level[]>([]);
  const [classes,setClasses]=useState<ClassItem[]>([]);
  const [tab,setTab]=useState<Tab>('catalog');
  const [query,setQuery]=useState('');
  const [level,setLevel]=useState('');
  const [subject,setSubject]=useState('');
  const [month,setMonth]=useState('');
  const [page,setPage]=useState(1);
  const [detail,setDetail]=useState<Target|null>(null);
  const [copied,setCopied]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [overview,setOverview]=useState<Overview|null>(null);
  const [progressMonth,setProgressMonth]=useState(()=>new Date().toISOString().slice(0,7));
  const [personQuery,setPersonQuery]=useState('');
  const [showCreate,setShowCreate]=useState(false);
  const [form,setForm]=useState({level_id:'',class_id:'',code:'',title:'',description:'',target_value:'',target_unit:'',target_month:''});

  useEffect(()=>{
    let live=true;
    const json=async(url:string)=>{
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok)throw Error('Gagal memuat '+url);
      return response.json();
    };
    Promise.allSettled([json('/api/targets/import'),json('/api/auth/me'),json('/api/levels'),json('/api/classes')])
      .then(([v,u,l,c])=>{
        if(!live)return;
        if(v.status==='fulfilled'&&Array.isArray(v.value)){
          setVersions(v.value);
          setSelected(current=>current||v.value[0]?.id||'');
          if(v.value.length===0)setLoading(false);
        }else{setError('Daftar versi target belum dapat dimuat.');setLoading(false);}
        if(u.status==='fulfilled'){
          const nextRole=u.value?.role||'VIEWER';
          setRole(nextRole);
          if(['ADMIN','DEWAN_GURU'].includes(nextRole)&&new URLSearchParams(window.location.search).get('create')==='1'){
            setShowCreate(true);setTab('manage');
          }
        }
        if(l.status==='fulfilled'&&Array.isArray(l.value))setLevels(l.value);
        if(c.status==='fulfilled'&&Array.isArray(c.value))setClasses(c.value);
      });
    return()=>{live=false};
  },[]);

  useEffect(()=>{
    if(!selected){setTargets([]);setGroups({});setGroupMonths({});return;}
    const controller=new AbortController();
    setLoading(true);setError('');setDetail(null);
    fetch('/api/targets/catalog?version_id='+encodeURIComponent(selected),{signal:controller.signal,cache:'no-store'})
      .then(async response=>{
        const data=await response.json();
        if(!response.ok)throw Error(data.error||'Katalog belum dapat dimuat.');
        return data;
      })
      .then(data=>{
        if(controller.signal.aborted)return;
        setTargets(Array.isArray(data.targets)?data.targets:[]);
        setGroups(data.group_rows||{});
        setGroupMonths(data.month_schedule||{});
      })
      .catch(err=>{if(!controller.signal.aborted){setTargets([]);setGroups({});setError(err instanceof Error?err.message:'Katalog tidak dapat dimuat.')}})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[selected]);

  useEffect(()=>{
    if(tab!=='progress'||!selected)return;
    const controller=new AbortController();
    fetch('/api/targets/overview?version_id='+encodeURIComponent(selected)+'&month='+encodeURIComponent(progressMonth),{signal:controller.signal,cache:'no-store'})
      .then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Rekap tidak dapat dimuat');return data;})
      .then(data=>{if(!controller.signal.aborted)setOverview(data)})
      .catch(()=>{if(!controller.signal.aborted)setOverview(null)});
    return()=>controller.abort();
  },[tab,selected,progressMonth]);

  useEffect(()=>{
    if(!detail)return;
    const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setDetail(null);};
    window.addEventListener('keydown',close);
    return()=>window.removeEventListener('keydown',close);
  },[detail]);

  const current=versions.find(v=>v.id===selected);
  const levelNames=useMemo(()=>[...new Set(targets.map(t=>t.levels?.name||'').filter(Boolean))]
    .sort((a,b)=>levelRank(a)-levelRank(b)||a.localeCompare(b,'id')),[targets]);
  const subjects=useMemo(()=>[...new Set(targets.map(t=>clean(t.source_metadata?.subject)).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,'id')),[targets]);
  const scheduledCount=useMemo(()=>targets.filter(t=>uniqueMonths(t).length>0).length,[targets]);
  const canManage=['ADMIN','DEWAN_GURU'].includes(role);
  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase('id-ID');
    return targets.filter(t=>{
      if(level&&t.levels?.name!==level)return false;
      if(subject&&t.source_metadata?.subject!==subject)return false;
      if(month&&!uniqueMonths(t).includes(Number(month)))return false;
      if(!q)return true;
      return [t.title,t.code,t.description,t.levels?.name,t.source_metadata?.parent,t.source_metadata?.subject,t.source_metadata?.aspect]
        .some(x=>clean(x).toLocaleLowerCase('id-ID').includes(q));
    });
  },[targets,level,subject,month,query]);
  const pageSize=24;
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const visible=filtered.slice((Math.min(page,pages)-1)*pageSize,Math.min(page,pages)*pageSize);
  const structure=useMemo(()=>Object.entries(groups)
    .map(([name,rows])=>({name,display:name==='Muda-Mudi'?'Remaja':name,rows}))
    .filter(g=>!level||g.display===level)
    .sort((a,b)=>levelRank(a.display)-levelRank(b.display)),[groups,level]);
  const targetByRow=useMemo(()=>{
    const map=new Map<string,Target>();
    for(const t of targets){const r=t.source_metadata?.source_row;if(r!=null&&t.source_metadata?.source_kind==='curriculum_item'){
      map.set((t.levels?.name||'')+':'+r,t);
    }}
    return map;
  },[targets]);

  function openTarget(t:Target){setCopied(false);setDetail(t);}
  function resetFilter(){setQuery('');setLevel('');setSubject('');setMonth('');setPage(1);}
  async function copyDetail(){
    if(!detail)return;
    try{await navigator.clipboard.writeText(targetSummary(detail));setCopied(true)}
    catch{setCopied(false);}
  }
  async function reload(){
    const response=await fetch('/api/targets/import',{cache:'no-store'});
    const v=await response.json();
    if(!response.ok||!Array.isArray(v))throw Error('Versi gagal dimuat ulang');
    setVersions(v);
    return v;
  }
  async function upload(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const formElement=e.currentTarget;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch('/api/targets/import',{method:'POST',body:new FormData(formElement)});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'Impor gagal');
      await reload();setSelected(data.version_id||'');setNotice(String(data.inserted||0)+' target berhasil diimpor.');
      formElement.reset();setTab('catalog');
    }catch(err){setError(err instanceof Error?err.message:'Impor gagal')}
    finally{setBusy(false);}
  }
  async function createTarget(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch('/api/targets',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({...form,version_id:selected||null,target_month:form.target_month?form.target_month+'-01':null})});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'Target gagal disimpan');
      setNotice('Target berhasil disimpan.');setShowCreate(false);
      setForm(v=>({...v,code:'',title:'',description:'',target_value:'',target_unit:''}));
      const id=selected;setSelected('');
      window.setTimeout(()=>setSelected(id),0);
    }catch(err){setError(err instanceof Error?err.message:'Penyimpanan gagal')}
    finally{setBusy(false);}
  }

  return <main className="tr-shell">
    <header className="tr-hero">
      <div className="tr-hero-content">
        <div className="tr-eyebrow"><BookMarked size={15}/> PUSAT TARGET PEMBELAJARAN</div>
        <h1>Target & Progres</h1>
        <p>Seluruh materi pembelajaran dalam satu katalog. Pilih jenjang, telusuri rincian target dan lihat jadwal sesuai dokumen sumber.</p>
        <div className="tr-hero-meta"><span><CheckCircle2 size={15}/> Dapat dibaca semua pengguna</span><span><BookOpen size={15}/> Semester 1</span></div>
      </div>
      <div className="tr-version-picker">
        <label htmlFor="tr-version">Versi kurikulum</label>
        <select id="tr-version" value={selected} onChange={e=>{setSelected(e.target.value);resetFilter()}}>
          {!versions.length&&<option value="">Belum ada versi</option>}
          {versions.map(v=><option value={v.id} key={v.id}>{v.title} (v{v.version})</option>)}
        </select>
        <small>{current?.period_start?'Mulai '+current.period_start:'Tahun ajaran tidak ditetapkan di sumber'}</small>
      </div>
    </header>

    <section className="tr-stats" aria-label="Ringkasan target">
      <article className="tr-stat"><span className="tr-stat-icon"><ClipboardList size={20}/></span><div><strong>{targets.length.toLocaleString('id-ID')}</strong><span>Target tersedia</span></div></article>
      <article className="tr-stat"><span className="tr-stat-icon"><GraduationCap size={21}/></span><div><strong>{levelNames.length}</strong><span>Jenjang pembelajaran</span></div></article>
      <article className="tr-stat"><span className="tr-stat-icon"><Layers3 size={20}/></span><div><strong>{subjects.length}</strong><span>Kelompok materi</span></div></article>
      <article className="tr-stat"><span className="tr-stat-icon"><CalendarDays size={20}/></span><div><strong>{scheduledCount.toLocaleString('id-ID')}</strong><span>Memiliki jadwal sumber</span></div></article>
    </section>

    <nav className="tr-tabs" aria-label="Navigasi target pembelajaran">
      <button type="button" className={tab==='catalog'?'active':''} onClick={()=>setTab('catalog')}><BookOpen size={17}/> Katalog target</button>
      <button type="button" className={tab==='structure'?'active':''} onClick={()=>setTab('structure')}><FolderTree size={17}/> Struktur materi</button>
      <button type="button" className={tab==='progress'?'active':''} onClick={()=>setTab('progress')}><UsersRound size={17}/> Progres</button>
      {canManage&&<button type="button" className={tab==='manage'?'active':''} onClick={()=>setTab('manage')}><Plus size={17}/> Kelola target</button>}
    </nav>

    {error&&<div className="tr-notice tr-error" role="alert">{error}</div>}
    {notice&&<div className="tr-notice tr-success" role="status">{notice}</div>}

    {(tab==='catalog'||tab==='structure')&&<section className="tr-filters" aria-label="Filter kurikulum">
      <div className="tr-filter-top">
        <label className="tr-search"><Search size={19}/><input aria-label="Cari target" type="search" placeholder="Cari materi, hafalan, kompetensi, atau kode target…" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/></label>
        {tab==='catalog'&&<div className="tr-filter-selects">
          <label><Filter size={15}/><select aria-label="Mata pelajaran" value={subject} onChange={e=>{setSubject(e.target.value);setPage(1)}}><option value="">Semua mata pelajaran</option>{subjects.map(s=><option key={s}>{s}</option>)}</select></label>
          <label><CalendarDays size={15}/><select aria-label="Bulan jadwal sumber" value={month} onChange={e=>{setMonth(e.target.value);setPage(1)}}><option value="">Semua bulan</option>{[7,8,9,10,11].map(m=><option key={m} value={m}>{monthName(m)}</option>)}</select></label>
        </div>}
      </div>
      <div className="tr-levels" aria-label="Pilih jenjang">
        <button type="button" className={!level?'active':''} onClick={()=>{setLevel('');setPage(1)}}>Semua jenjang</button>
        {levelNames.map(l=><button type="button" key={l} className={level===l?'active':''} onClick={()=>{setLevel(l);setPage(1)}}>{l==='Remaja'?'Remaja / Muda-Mudi':l}</button>)}
      </div>
    </section>}

    {tab==='catalog'&&<>
      <div className="tr-section-header"><div><h2>Jelajahi semua target</h2><p>Buka kartu untuk memeriksa deskripsi, asal dokumen, dan jadwal lengkapnya.</p></div><div className="tr-result-count">{filtered.length.toLocaleString('id-ID')} materi</div></div>
      {loading?<div className="tr-empty"><div className="tr-loader"/><strong>Memuat katalog pembelajaran…</strong></div>:
      visible.length>0?<div className="tr-grid">{visible.map(t=>{
        const source=t.source_metadata;
        const schedule=uniqueMonths(t);
        return <button className="tr-target" key={t.id} type="button" onClick={()=>openTarget(t)}>
          <div className="tr-item-top"><span className="tr-level-tag">{t.levels?.name==='Remaja'?'Remaja / Muda-Mudi':t.levels?.name||'Tanpa jenjang'}</span><span className="tr-item-code">{t.code||'Target'}</span></div>
          <h3>{t.title}</h3>
          <div className="tr-breadcrumb">{[source?.aspect,source?.subject,source?.parent].filter(Boolean).join(' / ')||'Materi pembelajaran'}</div>
          <div className="tr-item-bottom"><span><CalendarDays size={14}/>{schedule.length?schedule.map(monthName).join(', '):'Sepanjang semester'}</span><span className="tr-open">Lihat detail <ChevronRight size={17}/></span></div>
        </button>;
      })}</div>:<div className="tr-empty"><Search size={32}/><strong>Target tidak ditemukan</strong><p>Ubah kata kunci atau kosongkan filter untuk menampilkan target lainnya.</p><button type="button" onClick={resetFilter}>Reset filter</button></div>}
      {pages>1&&<div className="tr-pagination"><span>Halaman {Math.min(page,pages)} dari {pages}</span><div><button type="button" disabled={page<=1} onClick={()=>setPage(v=>Math.max(1,v-1))}><ChevronLeft size={17}/> Sebelumnya</button><button type="button" disabled={page>=pages} onClick={()=>setPage(v=>Math.min(pages,v+1))}>Berikutnya <ChevronRight size={17}/></button></div></div>}
    </>}

    {tab==='structure'&&<>
      <div className="tr-section-header"><div><h2>Struktur kurikulum dari dokumen asli</h2><p>Judul induk dan materi tersusun per jenjang, lengkap dengan nomor baris sumbernya. Judul induk tidak otomatis dihitung sebagai target penilaian.</p></div></div>
      <div className="tr-structure">
        {structure.map(g=>{
          const rows=g.rows.filter(([r,subject,title])=>!query.trim()||[title,subject,String(r)].join(' ').toLocaleLowerCase('id-ID').includes(query.toLocaleLowerCase('id-ID')));
          if(!rows.length)return null;
          return <details key={g.name} className="tr-structure-group" open={Boolean(level||query)}>
            <summary><span><GraduationCap size={19}/><strong>{g.display==='Remaja'?'Remaja (Muda-Mudi)':g.display}</strong><small>{rows.length} bagian</small></span><ChevronRight size={19}/></summary>
            <div className="tr-structure-rows">{rows.map(([row,subject,title])=>{
              const related=targetByRow.get(g.display+':'+row);
              const schedule=groupMonths[g.name]?.[String(row)]||[];
              return <div key={g.name+'-'+row} className="tr-structure-row">
                <span className="tr-row-number">{String(row).padStart(2,'0')}</span>
                <div><strong>{title}</strong><p>{subject}{schedule.length?' · Jadwal: '+[...schedule].sort((a,b)=>a-b).map(monthName).join(', '):''}</p></div>
                {related?<button type="button" onClick={()=>openTarget(related)}>Detail <ArrowUpRight size={15}/></button>:<span className="tr-parent-label">Judul induk</span>}
              </div>;
            })}</div>
          </details>;
        })}
        {!loading&&structure.length===0&&<div className="tr-empty">Tidak ada struktur pada versi atau jenjang ini.</div>}
      </div>
    </>}

    {tab==='progress'&&<section>
      <div className="tr-section-header"><div><h2>Rekap pencapaian pembelajaran</h2><p>Pencapaian diambil dari jurnal penilaian yang terhubung. Belum dinilai bukan berarti bernilai 0%.</p></div>
        <label className="tr-compact-label">Periode rekap<input type="month" value={progressMonth} onChange={e=>setProgressMonth(e.target.value)}/></label></div>
      <div className="tr-progress-grid">{(overview?.classes||[]).map(c=><article className="tr-progress-card" key={c.name}><div><strong>{c.name}</strong><span>{c.count} anggota</span></div><b>{c.percentage===null?'Belum dinilai':c.percentage+'%'}</b><div className="tr-progress-bar"><span style={{width:Math.min(100,Math.max(0,c.percentage||0))+'%'}}/></div></article>)}</div>
      {role!=='VIEWER'&&<div className="tr-panel">
        <div className="tr-panel-title"><div><h3>Progres per individu</h3><p>Target berlaku sesuai jenjang dan keanggotaan aktif.</p></div><label className="tr-search tr-short"><Search size={17}/><input placeholder="Cari nama anggota" value={personQuery} onChange={e=>setPersonQuery(e.target.value)}/></label></div>
        <div className="tr-table-wrap"><table className="tr-table"><thead><tr><th>Anggota</th><th>Jenjang / Kelas</th><th>Dinilai</th><th>Pencapaian dari penilaian</th></tr></thead><tbody>{(overview?.individual||[]).filter(p=>p.name.toLocaleLowerCase('id-ID').includes(personQuery.toLocaleLowerCase('id-ID'))).map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.class_name||p.level_name||'-'}</td><td>{p.assessed} / {p.targets} target</td><td>{p.percentage===null?'Belum dinilai':p.percentage+'%'}</td></tr>)}{!(overview?.individual||[]).length&&<tr><td colSpan={4}>Belum ada data progres untuk periode ini.</td></tr>}</tbody></table></div>
      </div>}
      {role==='VIEWER'&&<div className="tr-notice">Progres personal hanya tersedia untuk akun dengan akses pengelolaan yang sesuai. Seluruh target pembelajaran tetap dapat ditinjau.</div>}
    </section>}

    {tab==='manage'&&canManage&&<section className="tr-manage">
      <div className="tr-section-header"><div><h2>Pengelolaan target</h2><p>Fitur ini khusus pengelola. Impor atau penambahan target tidak mengubah catatan progres lama.</p></div><button type="button" className="tr-add-btn" onClick={()=>setShowCreate(v=>!v)}><Plus size={17}/>{showCreate?'Tutup form':'Tambah target'}</button></div>
      {showCreate&&<form className="tr-panel tr-form" onSubmit={createTarget}>
        <h3>Tambah target pembelajaran</h3><div className="tr-form-grid">
          <label>Jenjang<select required value={form.level_id} onChange={e=>setForm(v=>({...v,level_id:e.target.value,class_id:''}))}><option value="">Pilih jenjang</option>{levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label>Kelas (opsional)<select value={form.class_id} onChange={e=>setForm(v=>({...v,class_id:e.target.value}))}><option value="">Semua kelas</option>{classes.filter(c=>!form.level_id||c.level_id===form.level_id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Bulan (opsional)<input type="month" value={form.target_month} onChange={e=>setForm(v=>({...v,target_month:e.target.value}))}/></label>
          <label>Kode<input value={form.code} onChange={e=>setForm(v=>({...v,code:e.target.value}))}/></label>
          <label className="tr-wide">Materi / Target<input required value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))}/></label>
          <label className="tr-wide">Deskripsi<textarea value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/></label>
          <label>Nilai target<input type="number" step="any" value={form.target_value} onChange={e=>setForm(v=>({...v,target_value:e.target.value}))}/></label>
          <label>Satuan<input value={form.target_unit} onChange={e=>setForm(v=>({...v,target_unit:e.target.value}))} placeholder="%, materi, halaman"/></label>
        </div><div className="tr-form-actions"><button type="submit" disabled={busy}>{busy?'Menyimpan…':'Simpan target'}</button></div>
      </form>}
      <form className="tr-panel tr-form" onSubmit={upload}>
        <div className="tr-panel-title"><div><h3><UploadCloud size={20}/> Impor target dari Excel</h3><p>Gunakan pratinjau dan struktur target sesuai dokumen sumber.</p></div><a className="tr-template" href="/api/targets/import?template=1"><FileSpreadsheet size={17}/> Unduh template</a></div>
        <div className="tr-form-grid">
          <label>Nama versi<input name="title" placeholder="Target Semester 1" required/></label>
          <label>File Excel<input name="file" type="file" accept=".xlsx,.xls" required/></label>
          <label>Periode mulai<input name="period_start" type="date"/></label>
          <label>Periode akhir<input name="period_end" type="date"/></label>
        </div><div className="tr-form-actions"><button type="submit" disabled={busy}>{busy?'Memproses…':'Impor target'}</button></div>
      </form>
    </section>}

    {detail&&<div className="tr-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setDetail(null)}}>
      <section className="tr-modal" role="dialog" aria-modal="true" aria-labelledby="tr-detail-title">
        <div className="tr-modal-head"><span><BookOpen size={17}/> DETAIL TARGET PEMBELAJARAN</span><button type="button" aria-label="Tutup detail" onClick={()=>setDetail(null)}><X size={21}/></button></div>
        <div className="tr-modal-body">
          <div className="tr-detail-tags"><span>{detail.levels?.name==='Remaja'?'Remaja / Muda-Mudi':detail.levels?.name||'Semua jenjang'}</span><span>Semester {detail.source_metadata?.semester||1}</span><span>{detail.code||'Target pembelajaran'}</span></div>
          <h2 id="tr-detail-title">{detail.title}</h2>
          <p className="tr-detail-lead">{detail.description||'Target pembelajaran sesuai dokumen kurikulum yang diunggah.'}</p>
          <div className="tr-detail-section"><h3><Layers3 size={17}/> Posisi dalam kurikulum</h3><dl>
            <div><dt>Aspek</dt><dd>{detail.source_metadata?.aspect||'-'}</dd></div>
            <div><dt>Mata pelajaran</dt><dd>{detail.source_metadata?.subject||'-'}</dd></div>
            <div><dt>Materi induk</dt><dd>{detail.source_metadata?.parent||'-'}</dd></div>
            <div><dt>Program</dt><dd>{detail.source_metadata?.program==='muda-mudi'?'Muda-Mudi':'Caberawit'}</dd></div>
            {detail.classes?.name&&<div><dt>Kelas</dt><dd>{detail.classes.name}</dd></div>}
            {detail.target_value!=null&&<div><dt>Nilai target</dt><dd>{detail.target_value} {detail.target_unit||''}</dd></div>}
          </dl></div>
          <div className="tr-detail-section"><h3><CalendarDays size={17}/> Jadwal pembelajaran</h3>
            <div className="tr-month-chips">{uniqueMonths(detail).length?uniqueMonths(detail).map(n=><span key={n}>{monthName(n)}</span>):<span>Berlaku sepanjang semester</span>}</div>
            <p>Jadwal mengikuti dokumen sumber. Tahun ajaran tidak dipaksakan jika belum tercantum pada file.</p>
          </div>
          <div className="tr-detail-section"><h3><FileText size={17}/> Referensi sumber</h3><dl>
            <div><dt>File Excel</dt><dd>{detail.source_metadata?.source_file||'Input manual'}</dd></div>
            <div><dt>Sheet</dt><dd>{detail.source_metadata?.source_sheet||'-'}</dd></div>
            <div><dt>Baris</dt><dd>{detail.source_metadata?.source_row??'-'}</dd></div>
            {detail.source_metadata?.source_cell&&<div><dt>Sel</dt><dd>{detail.source_metadata.source_cell}</dd></div>}
          </dl></div>
          <div className="tr-detail-hint"><CheckCircle2 size={18}/> Rincian ini merupakan acuan pembelajaran. Progres individu dinilai melalui jurnal, bukan diubah dari halaman tinjauan.</div>
        </div>
        <div className="tr-modal-footer"><button type="button" className="tr-close-btn" onClick={()=>setDetail(null)}>Kembali</button><button type="button" className="tr-copy-btn" onClick={()=>{void copyDetail()}}><Copy size={16}/>{copied?'Tersalin':'Salin rincian'}</button></div>
      </section>
    </div>}
  </main>;
}
