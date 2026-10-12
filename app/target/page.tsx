'use client';

import {FormEvent,useEffect,useMemo,useState} from 'react';

type Version={id:string;title:string;version:number;period_start?:string;period_end?:string;source_file_name?:string;analysis?:any;created_at:string};
type Target={id:string;code?:string;title:string;target_month?:string|null;description?:string;target_value?:number;target_unit?:string;levels?:{name?:string};classes?:{name?:string};source_metadata?:{aspect?:string;subject?:string;parent?:string;program?:string;source_file?:string;planned_month_numbers?:number[]}};
type Overview={targets:Target[];individual:Array<{id:string;name:string;class_name:string;level_name:string;targets:number;assessed:number;percentage:number|null}>;classes:Array<{name:string;count:number;percentage:number|null}>};

export default function TargetPage(){
  const[versions,setVersions]=useState<Version[]>([]);
  const[targets,setTargets]=useState<Target[]>([]);
  const[selected,setSelected]=useState('');
  const[uploading,setUploading]=useState(false);
  const[error,setError]=useState('');
  const[result,setResult]=useState('');
  const[overview,setOverview]=useState<Overview|null>(null);
  const[month,setMonth]=useState(()=>new Date().toISOString().slice(0,7));
  const[personSearch,setPersonSearch]=useState('');
  const[targetSearch,setTargetSearch]=useState(''),[levelFilter,setLevelFilter]=useState(''),[page,setPage]=useState(1);
  const[showCreate,setShowCreate]=useState(false),[levels,setLevels]=useState<any[]>([]),[classes,setClasses]=useState<any[]>([]),[role,setRole]=useState('VIEWER');
  const[targetForm,setTargetForm]=useState({level_id:'',class_id:'',code:'',title:'',description:'',target_value:'',target_unit:'',target_month:new Date().toISOString().slice(0,7)});

  const load=async()=>{
    const [v,t]=await Promise.all([fetch('/api/targets/import').then(r=>r.json()),fetch('/api/targets'+(selected?'?version_id='+selected:'')).then(r=>r.json())]);
    setVersions(Array.isArray(v)?v:[]);if(!selected&&Array.isArray(v)&&v.length)setSelected(v[0].id);setTargets(Array.isArray(t)?t:[]);
  };
  useEffect(()=>{void load()},[selected]);
  useEffect(()=>{Promise.all([fetch('/api/levels').then(r=>r.json()),fetch('/api/classes').then(r=>r.json()),fetch('/api/auth/me').then(r=>r.json())]).then(([l,c,u])=>{setLevels(Array.isArray(l)?l:[]);setClasses(Array.isArray(c)?c:[]);setRole(u?.role||'VIEWER')});if(new URLSearchParams(window.location.search).get('create')==='1')setShowCreate(true)},[]);
  useEffect(()=>{fetch('/api/targets/overview?month='+month+(selected?'&version_id='+selected:'')).then(r=>r.json()).then(setOverview).catch(()=>setOverview(null))},[month,selected]);

  async function upload(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setUploading(true);setError('');setResult('');
    const fd=new FormData(e.currentTarget);
    const r=await fetch('/api/targets/import',{method:'POST',body:fd});
    const j=await r.json();
    if(!r.ok){setError(j.error||'Gagal membaca target.');setUploading(false);return}
    setResult(`${j.inserted} target berhasil dipetakan dari Excel.`);
    setSelected(j.version_id);setUploading(false);await load();
  }

  async function createTarget(e:FormEvent<HTMLFormElement>){e.preventDefault();setUploading(true);setError('');setResult('');const r=await fetch('/api/targets',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...targetForm,target_month:targetForm.target_month?targetForm.target_month+'-01':null,version_id:selected||null})});const j=await r.json();setUploading(false);if(!r.ok){setError(j.error||'Target gagal ditambahkan.');return}setShowCreate(false);setTargetForm(v=>({...v,code:'',title:'',description:'',target_value:'',target_unit:''}));setResult('Target berhasil ditambahkan.');await load()}

  const current=useMemo(()=>versions.find(v=>v.id===selected),[versions,selected]);
  const levelNames=useMemo(()=>[...new Set(targets.map(t=>t.levels?.name).filter((x):x is string=>Boolean(x)))].sort((a,b)=>a.localeCompare(b,'id',{numeric:true})),[targets]);
  const filteredTargets=useMemo(()=>targets.filter(t=>(!levelFilter||t.levels?.name===levelFilter)&&
    (!targetSearch||[t.code,t.title,t.description,t.source_metadata?.aspect,t.source_metadata?.subject]
      .some(v=>String(v||'').toLowerCase().includes(targetSearch.toLowerCase())))),[targets,levelFilter,targetSearch]);
  const pageSize=50,pages=Math.max(1,Math.ceil(filteredTargets.length/pageSize));
  const visibleTargets=filteredTargets.slice((Math.min(page,pages)-1)*pageSize,Math.min(page,pages)*pageSize);
  const semesterTargets=targets.filter(t=>!t.target_month);
  const scheduledInSource=semesterTargets.filter(t=>(t.source_metadata?.planned_month_numbers?.length||0)>0);
  const plannedMonths=Array.from({length:6},(_,i)=>{const n=i+7;return {
    n,label:new Date(Date.UTC(2024,n-1,1)).toLocaleDateString('id-ID',{month:'long',timeZone:'UTC'}),
    rows:scheduledInSource.filter(t=>t.source_metadata?.planned_month_numbers?.includes(n))};});


  return <>
    <div className="pageHeader"><h1>Target & Progres</h1><div className="dataCreateActions">{['ADMIN','DEWAN_GURU'].includes(role)&&<button className="btn" onClick={()=>setShowCreate(v=>!v)}>{showCreate?'Tutup':'+ Target'}</button>}<a className="btn ghost" href="/api/targets/import?template=1">Template Excel</a></div></div>
    {showCreate&&<form className="card section" onSubmit={createTarget}><div className="formGrid"><label>Jenjang<select className="select" required value={targetForm.level_id} onChange={e=>setTargetForm({...targetForm,level_id:e.target.value,class_id:''})}><option value="">Pilih jenjang</option>{levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label>Kelas<select className="select" value={targetForm.class_id} onChange={e=>setTargetForm({...targetForm,class_id:e.target.value})}><option value="">Semua kelas</option>{classes.filter(c=>!targetForm.level_id||c.level_id===targetForm.level_id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Bulan<input className="input" type="month" required value={targetForm.target_month} onChange={e=>setTargetForm({...targetForm,target_month:e.target.value})}/></label><label>Kode<input className="input" value={targetForm.code} onChange={e=>setTargetForm({...targetForm,code:e.target.value})}/></label><label className="span2">Target<input className="input" required value={targetForm.title} onChange={e=>setTargetForm({...targetForm,title:e.target.value})}/></label><label className="span2">Deskripsi<textarea className="textarea" value={targetForm.description} onChange={e=>setTargetForm({...targetForm,description:e.target.value})}/></label><label>Nilai target<input className="input" type="number" step="any" value={targetForm.target_value} onChange={e=>setTargetForm({...targetForm,target_value:e.target.value})}/></label><label>Satuan<input className="input" value={targetForm.target_unit} onChange={e=>setTargetForm({...targetForm,target_unit:e.target.value})} placeholder="%, halaman, materi"/></label></div><div className="formActions"><button className="btn" disabled={uploading}>{uploading?'Menyimpan…':'Simpan target'}</button></div></form>}
    <div className="dashboardGrid">
      <form className="card writeOnly" onSubmit={upload}>
        <div className="cardHead"><div><h2>Upload Target Excel</h2><p>Kolom bulan menentukan target per bulan. Struktur dianalisis saat impor; tinjau hasil sebelum digunakan.</p></div></div>
        <div className="formGrid">
          <label>Nama versi<input className="input" name="title" required placeholder="Target Semester 1"/></label>
          <label>File Excel<input className="input" name="file" type="file" accept=".xlsx,.xls" required/></label>
          <label>Periode mulai<input className="input" name="period_start" type="date"/></label>
          <label>Periode akhir<input className="input" name="period_end" type="date"/></label>
        </div>
        {error&&<div className="notice error section">{error}</div>}
        {result&&<div className="notice section">{result}</div>}
        <button className="btn section" disabled={uploading}>{uploading?'Menganalisis Excel…':'Upload & Analisis'}</button>
      </form>
      <section className="card">
        <div className="cardHead"><div><h2>Versi Target</h2><p>Target lama tetap tersimpan.</p></div></div>
        <div className="list">
          {versions.map(v=><button key={v.id} className={selected===v.id?'item targetVersion active':'item targetVersion'} onClick={()=>setSelected(v.id)}>
            <div className="row between"><strong>{v.title}</strong><span className="badge">v{v.version}</span></div>
            <div className="itemMeta">{v.source_file_name||'Input manual'}{v.period_start?' · '+v.period_start:''}</div>
          </button>)}
          {!versions.length&&<div className="emptyState">Belum ada versi target.</div>}
        </div>
      </section>
    </div>
    {current&&<div className="notice section">
      <strong>{current.title}</strong> · {targets.length} target.
      {semesterTargets.length>0&&<> Sebanyak {semesterTargets.length} target berlaku sepanjang semester, tanpa tenggat bulan/tahun yang ditentukan. Tahun ajaran belum tercantum dalam sumber Excel.</>}
    </div>}
    {scheduledInSource.length>0&&<section className="card section">
      <div className="cardHead"><div><h2>Jadwal hafalan dan materi sesuai Excel</h2><p>Juli–Desember adalah bulan yang tertulis dalam sumber; tahun ajaran belum ditetapkan.</p></div></div>
      <div className="targetMonths">{plannedMonths.map(m=><div className="targetMonth" key={m.n}>
        <strong>{m.label}</strong><span>{m.rows.length} materi terjadwal</span>
        {m.rows.slice(0,3).map(t=><small key={t.id}>{t.title} · {t.levels?.name}</small>)}
        {m.rows.length>3&&<small>+{m.rows.length-3} lainnya</small>}
      </div>)}</div></section>}
    {semesterTargets.length>0&&<div className="notice section">Materi semester dapat dipilih pada <strong>Jurnal Individu</strong> sesuai jenjang. Belum dinilai bukan berarti bernilai 0%.</div>}
    {targets.some(t=>!!t.target_month)&&<section className="card section"><div className="cardHead"><div><h2>Rencana enam bulan</h2><p>Mulai bulan yang dipilih.</p></div><input className="input compactSelect" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div><div className="targetMonths">{Array.from({length:6},(_,i)=>{const d=new Date(Number(month.slice(0,4)),Number(month.slice(5,7))-1+i,1);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;const rows=(overview?.targets??[]).filter(t=>t.target_month?.startsWith(key));return <div className="targetMonth" key={key}><strong>{d.toLocaleDateString('id-ID',{month:'long',year:'numeric'})}</strong><span>{rows.length} target</span>{rows.slice(0,4).map(t=><small key={t.id}>{t.title} · {t.levels?.name}</small>)}{rows.length>4&&<small>+{rows.length-4} lainnya</small>}</div>})}</div></section>}
    <section className="section"><div className="cardHead"><div><h2>Ketercapaian per kelas</h2><p>Rata-rata semua individu berdasarkan target yang berlaku pada jenjang dan kelasnya.</p></div></div><div className="levelGrid">{overview?.classes.map(c=><div className="levelCard" key={c.name}><strong>{c.name}</strong><span>{c.count} anggota</span><b>{c.percentage===null?'Belum dinilai':c.percentage+'% dari yang dinilai'}</b></div>)}</div></section>
    <section className="card section"><div className="cardHead"><div><h2>Per individu</h2><p>Progres setiap orang dihitung dari target semester sesuai jenjang dan penilaian jurnal.</p></div><input className="input compactSelect" placeholder="Cari nama…" value={personSearch} onChange={e=>setPersonSearch(e.target.value)}/></div><div className="tableWrap"><table className="table"><thead><tr><th>Nama</th><th>Kelas</th><th>Dinilai / target</th><th>Ketercapaian</th></tr></thead><tbody>{overview?.individual.filter(p=>p.name.toLowerCase().includes(personSearch.toLowerCase())).map(p=><tr key={p.id}><td>{p.name}</td><td>{p.class_name||p.level_name}</td><td>{p.assessed} / {p.targets}</td><td><strong>{p.percentage===null?'Belum dinilai':p.percentage+'%'}</strong></td></tr>)}{!overview?.individual.length&&<tr><td colSpan={4}>Belum ada data progres.</td></tr>}</tbody></table></div></section>
    <section className="section">
      <div className="cardHead"><div><h2>Daftar Target</h2><p>{filteredTargets.length} dari {targets.length} target aktif.</p></div></div>
      <div className="formGrid">
        <label>Jenjang<select className="select" value={levelFilter} onChange={e=>{setLevelFilter(e.target.value);setPage(1)}}>
          <option value="">Semua jenjang</option>{levelNames.map(name=><option key={name} value={name}>{name}</option>)}
        </select></label>
        <label>Cari target / mata pelajaran / aspek<input className="input" placeholder="Cari hafalan, Tilawaty, akhlak…" value={targetSearch} onChange={e=>{setTargetSearch(e.target.value);setPage(1)}}/></label>
      </div>
      <div className="tableWrap"><table className="table"><thead><tr><th>Kode</th><th>Target</th><th>Jenjang</th><th>Kelas</th><th>Nilai</th></tr></thead><tbody>
        {visibleTargets.map(t=><tr key={t.id}><td>{t.code||'-'}</td><td><strong>{t.title}</strong>
          <div className="itemMeta">{[t.source_metadata?.aspect,t.source_metadata?.subject,t.source_metadata?.parent].filter(Boolean).join(' · ')}</div>
          {t.description&&<div className="itemMeta">{t.description}</div>}
          {!!t.source_metadata?.planned_month_numbers?.length&&<div className="itemMeta">Bulan sumber: {t.source_metadata.planned_month_numbers.map(n=>new Date(Date.UTC(2024,n-1,1)).toLocaleDateString('id-ID',{month:'long',timeZone:'UTC'})).join(', ')} · tanpa tahun</div>}
        </td><td>{t.levels?.name||'-'}</td><td>{t.classes?.name||'-'}</td><td>{t.target_value??'-'} {t.target_unit||''}</td></tr>)}
        {!filteredTargets.length&&<tr><td colSpan={5}>Tidak ada target sesuai filter.</td></tr>}
      </tbody></table></div>
      {pages>1&&<div className="formActions">
        <button type="button" className="btn ghost" disabled={page<=1} onClick={()=>setPage(v=>Math.max(1,v-1))}>Sebelumnya</button>
        <span>Halaman {Math.min(page,pages)} dari {pages}</span>
        <button type="button" className="btn ghost" disabled={page>=pages} onClick={()=>setPage(v=>Math.min(pages,v+1))}>Berikutnya</button>
      </div>}
    </section>
  </>;
}
