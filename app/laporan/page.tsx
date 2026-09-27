'use client';

import {FormEvent,useEffect,useMemo,useState} from 'react';

type Member={id:string;name:string;class_id?:string;classes?:{name?:string};levels?:{name?:string}};
type Template={id:string;name:string;kind:'pptx'|'docx';file_name?:string;field_map?:{method?:string;mappings?:unknown[]}};

export default function ReportPage(){
  const now=new Date();
  const first=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10);
  const today=now.toISOString().slice(0,10);
  const[members,setMembers]=useState<Member[]>([]);
  const[templates,setTemplates]=useState<Template[]>([]);
  const[memberId,setMemberId]=useState('');
  const[mode,setMode]=useState<'individual'|'class'>('individual');
  const[from,setFrom]=useState(first);
  const[to,setTo]=useState(today);
  const[format,setFormat]=useState<'docx'|'pptx'>('docx');
  const[templateId,setTemplateId]=useState('');
  const[classFilter,setClassFilter]=useState('');
  const[aiNote,setAiNote]=useState(false),[aiInstruction,setAiInstruction]=useState('');
  const[manualNote,setManualNote]=useState('');
  const[loading,setLoading]=useState(false);
  const[message,setMessage]=useState('');
  const[error,setError]=useState('');

  const load=()=>Promise.all([
    fetch('/api/members?segment=CABERAWIT').then(r=>r.json()),
    fetch('/api/report-templates').then(r=>r.json())
  ]).then(([m,t])=>{setMembers(m);setTemplates(Array.isArray(t)?t:[]);if(!memberId&&m[0])setMemberId(m[0].id)});
  useEffect(()=>{void load()},[]);

  const matching=useMemo(()=>templates.filter(t=>t.kind===format),[templates,format]);
  const classNames=useMemo(()=>Array.from(new Set(members.map(m=>m.classes?.name).filter(Boolean))) as string[],[members]);
  const visibleMembers=members.filter(m=>!classFilter||m.classes?.name===classFilter);

  async function upload(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setMessage('');setError('');
    const fd=new FormData(e.currentTarget);
    const r=await fetch('/api/report-templates',{method:'POST',body:fd});
    const j=await r.json();
    if(!r.ok){setError(j.error||'Upload template gagal.');return}
    setMessage('Template tersimpan.');(e.currentTarget as HTMLFormElement).reset();await load();
  }

  async function generate(){
    setLoading(true);setError('');setMessage('');
    try{
      const r=await fetch(mode==='class'?'/api/caberawit-report/class':'/api/caberawit-report/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({member_id:memberId,class_id:members.find(m=>m.classes?.name===classFilter)?.class_id,period_start:from,period_end:to,format,template_id:templateId||null,ai_note:aiNote,ai_instruction:aiInstruction,note:manualNote})});
      if(!r.ok){const j=await r.json();throw new Error(j.error||'Gagal membuat laporan.')}
      const blob=await r.blob();
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=`laporan-caberawit-${from}-${to}.${format}`;a.click();URL.revokeObjectURL(url);
      setMessage('Laporan berhasil dibuat.');
    }catch(e){setError(e instanceof Error?e.message:'Gagal membuat laporan.')}
    finally{setLoading(false)}
  }

  return <>
    <div className="pageHeader"><div><div className="eyebrow">Dokumen yang dapat diedit</div><h1>Laporan Jabirawit</h1><p>Data presensi dan progres disusun ke template Word atau PowerPoint.</p></div></div>
    <div className="dashboardGrid">
      <section className="card">
        <h2>Buat Laporan</h2>
        <div className="tabBar"><button className={mode==='individual'?'tab active':'tab'} onClick={()=>setMode('individual')}>Individu</button><button className={mode==='class'?'tab active':'tab'} onClick={()=>setMode('class')}>Kelas</button></div>
        <div className="formGrid">
          <label>Kelas<select className="select" value={classFilter} onChange={e=>{setClassFilter(e.target.value);setMemberId('')}}><option value="">Semua kelas</option>{classNames.map(c=><option key={c}>{c}</option>)}</select></label>
          {mode==='individual'&&<label>Individu<select className="select" value={memberId} onChange={e=>setMemberId(e.target.value)}><option value="">Pilih</option>{visibleMembers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
          <label>Format<select className="select" value={format} onChange={e=>{setFormat(e.target.value as 'docx'|'pptx');setTemplateId('')}}><option value="docx">Word (.docx)</option><option value="pptx">PowerPoint (.pptx)</option></select></label>
          <label>Mulai<input className="input" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
          <label>Sampai<input className="input" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
          <label className="span2">Template<select className="select" value={templateId} onChange={e=>setTemplateId(e.target.value)}><option value="">{format==='docx'?'Gunakan format Word profesional bawaan':'Pilih template PPTX'}</option>{matching.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        </div>
        <label className="reportOption"><input type="checkbox" checked={aiNote} onChange={e=>setAiNote(e.target.checked)}/> Buat catatan analitis dengan Gemini</label>
        {aiNote&&<label>Petunjuk catatan tambahan<textarea className="textarea" maxLength={500} value={aiInstruction} onChange={e=>setAiInstruction(e.target.value)} placeholder="Soroti hal yang ingin diperhatikan, tanpa menambah fakta baru."/></label>}
        {!aiNote&&mode==='class'&&<label>Catatan kelas (opsional)<textarea className="textarea" value={manualNote} onChange={e=>setManualNote(e.target.value)}/></label>}
        <div className="notice section">Placeholder template: <strong>{'{{NAMA}}'}</strong>, {'{{PERIODE}}'}, {'{{KELAS}}'}, {'{{JENJANG}}'}, {'{{HADIR}}'}, {'{{IZIN}}'}, {'{{ALFA}}'}, {'{{KEHADIRAN}}'}, {'{{PROGRES}}'}, {'{{CATATAN}}'}.</div>
        {error&&<div className="notice error section">{error}</div>}{message&&<div className="notice section">{message}</div>}
        <button className="btn section" onClick={()=>void generate()} disabled={loading||(mode==='individual'&&!memberId)||(mode==='class'&&!classFilter)||(format==='pptx'&&!templateId)}>{loading?'Menyusun laporan…':'Buat Laporan'}</button>
      </section>
      <form className="card writeOnly" onSubmit={upload}>
        <h2>Upload Template</h2>
        <div className="formGrid">
          <label>Nama template<input className="input" name="name" required/></label>
          <label>Jenis<select className="select" name="kind" required><option value="pptx">PowerPoint</option><option value="docx">Word</option></select></label>
          <label className="span2">File<input className="input" type="file" name="file" accept=".pptx,.docx" required/></label>
        </div>
        <button className="btn section">Upload Template</button>
        <div className="list section">{templates.map(t=><div className="item row between" key={t.id}><div><div className="itemTitle">{t.name}</div><div className="itemMeta">{t.file_name} · {t.field_map?.method==='gemini_mapping'?`${t.field_map.mappings?.length??0} posisi dipetakan AI`:'Gunakan placeholder eksplisit'}</div></div><span className="badge">{t.kind.toUpperCase()}</span></div>)}</div>
      </form>
    </div>
  </>;
}
