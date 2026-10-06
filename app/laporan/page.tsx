'use client';

import OperationalReport from '@/components/OperationalReport';
import {reportMemberships} from '@/lib/report-scope';
import {jakartaDate} from '@/lib/domain';
import {FormEvent,useEffect,useMemo,useState} from 'react';

type Member={id:string;name:string;member_memberships?:any[];class_id?:string;classes?:{name?:string};levels?:{name?:string}};
type Template={id:string;name:string;kind:'pptx'|'docx';file_name?:string;field_map?:{method?:string;mappings?:unknown[]}};

export default function ReportPage(){
  const today=jakartaDate();
  const first=today.slice(0,7)+'-01';
  const[members,setMembers]=useState<Member[]>([]);const[classes,setClasses]=useState<Array<{id:string;name:string}>>([]);
  const[versions,setVersions]=useState<Array<{id:string;title:string;version:number}>>([]);const[versionId,setVersionId]=useState('');
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
  const[preview,setPreview]=useState<Record<string,any>|null>(null);
  const[message,setMessage]=useState('');
  const[error,setError]=useState('');

  const load=()=>Promise.all([
    Promise.all([fetch('/api/members').then(r=>r.json()),fetch('/api/members?archived=1').then(r=>r.json())]).then(([a,b])=>[...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])]),
    fetch('/api/report-templates').then(r=>r.json()),fetch('/api/targets/import').then(r=>r.json()),fetch('/api/classes?audience=CABERAWIT').then(r=>r.json())
  ]).then(([m,t,v,c])=>{setClasses(Array.isArray(c)?c:[]);setVersions(Array.isArray(v)?v:[]);if(!versionId)setVersionId(Array.isArray(v)&&v[0]?v[0].id:'__unversioned__');setMembers(Array.isArray(m)?m:[]);setTemplates(Array.isArray(t)?t:[]);if(!memberId&&Array.isArray(m)&&m[0])setMemberId(m[0].id)});
  useEffect(()=>{void load()},[]);

  const matching=useMemo(()=>templates.filter(t=>t.kind===format),[templates,format]);
  const classOptions=useMemo(()=>{const map=new Map(classes.map(c=>[c.id,c.name]));for(const m of members)for(const p of reportMemberships(m.member_memberships??[],from,to)){if(p.class_id)map.set(p.class_id,p.class_name||p.class_id)}return [...map].map(([id,name])=>({id,name}))},[members,classes,from,to]);
  const visibleMembers=members.filter(m=>reportMemberships(m.member_memberships??[],from,to,classFilter||undefined).length);

  async function upload(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setMessage('');setError('');
    const form=e.currentTarget;const fd=new FormData(form);
    const r=await fetch('/api/report-templates',{method:'POST',body:fd});
    const j=await r.json();
    if(!r.ok){setError(j.error||'Upload template gagal.');return}
    setMessage('Template tersimpan.');form.reset();await load();
  }

  async function generate(previewOnly=false){
    setLoading(true);setError('');setMessage('');
    try{
      const r=await fetch(mode==='class'?'/api/caberawit-report/class':'/api/caberawit-report/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({member_id:memberId,class_id:classFilter||null,period_start:from,period_end:to,format,template_id:templateId||null,ai_note:aiNote,ai_instruction:aiInstruction,note:manualNote,version_id:versionId,preview:previewOnly})});
      if(!r.ok){const j=await r.json();throw new Error(j.error||'Gagal membuat laporan.')}
      if(previewOnly){setPreview(await r.json());return}
      const blob=await r.blob();
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=`laporan-caberawit-${from}-${to}.${format}`;a.click();URL.revokeObjectURL(url);
      setMessage('Laporan berhasil dibuat.');
    }catch(e){setError(e instanceof Error?e.message:'Gagal membuat laporan.')}
    finally{setLoading(false)}
  }

  async function editTemplate(id:string,changes:{name?:string;active?:boolean}){setError('');try{const r=await fetch('/api/report-templates',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id,...changes})});const j=await r.json();if(!r.ok)throw new Error(j.error);if(templateId===id&&changes.active===false)setTemplateId('');await load()}catch(e){setError(e instanceof Error?e.message:'Gagal mengubah template.')}}
  return <>
    <OperationalReport/>
    <div className="pageHeader"><div><div className="eyebrow">Dokumen yang dapat diedit</div><h1>Laporan Caberawit</h1><p>Data presensi dan progres disusun ke template Word atau PowerPoint.</p></div></div>
    <div className="dashboardGrid">
      <section className="card">
        <h2>Buat Laporan</h2>
        <div className="tabBar"><button className={mode==='individual'?'tab active':'tab'} onClick={()=>setMode('individual')}>Individu</button><button className={mode==='class'?'tab active':'tab'} onClick={()=>setMode('class')}>Kelas</button></div>
        <div className="formGrid">
          <label>Kelas<select className="select" value={classFilter} onChange={e=>{setClassFilter(e.target.value);setMemberId('')}}><option value="">Semua kelas</option>{classOptions.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          {mode==='individual'&&<label>Individu<select className="select" value={memberId} onChange={e=>setMemberId(e.target.value)}><option value="">Pilih</option>{visibleMembers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
<label>Versi target<select className="select" value={versionId} onChange={e=>setVersionId(e.target.value)}><option value="">Pilih versi target</option><option value="__unversioned__">Target manual tanpa versi</option>{versions.map(v=><option key={v.id} value={v.id}>{v.title} · v{v.version}</option>)}</select></label>
          <label>Format<select className="select" value={format} onChange={e=>{setFormat(e.target.value as 'docx'|'pptx');setTemplateId('')}}><option value="docx">Word (.docx)</option><option value="pptx">PowerPoint (.pptx)</option></select></label>
          <label>Mulai<input className="input" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
          <label>Sampai<input className="input" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
          <label className="span2">Template<select className="select" value={templateId} onChange={e=>setTemplateId(e.target.value)}><option value="">{format==='docx'?'Gunakan format Word profesional bawaan':'Gunakan PowerPoint bawaan'}</option>{matching.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        </div>
        <label className="reportOption"><input type="checkbox" checked={aiNote} onChange={e=>setAiNote(e.target.checked)}/> Catatan otomatis</label>
        {aiNote&&<label>Petunjuk catatan tambahan<textarea className="textarea" maxLength={500} value={aiInstruction} onChange={e=>setAiInstruction(e.target.value)} placeholder="Soroti hal yang ingin diperhatikan, tanpa menambah fakta baru."/></label>}
        {!aiNote&&mode==='class'&&<label>Catatan kelas (opsional)<textarea className="textarea" value={manualNote} onChange={e=>setManualNote(e.target.value)}/></label>}
        <div className="notice section">Placeholder template: <strong>{'{{NAMA}}'}</strong>, {'{{PERIODE}}'}, {'{{KELAS}}'}, {'{{JENJANG}}'}, {'{{HADIR}}'}, {'{{IZIN}}'}, {'{{ALFA}}'}, {'{{KEHADIRAN}}'}, {'{{PROGRES}}'}, {'{{CATATAN}}'}.</div>
        {error&&<div className="notice error section">{error}</div>}{message&&<div className="notice section">{message}</div>}
        <button className="btn section" onClick={()=>void generate()} disabled={loading||!versionId||(mode==='individual'&&!memberId)||(mode==='class'&&!classFilter)}>{loading?'Menyusun laporan…':'Cetak'}</button>
        <button className="btn section" onClick={()=>void generate(true)} disabled={loading||!versionId||(mode==='individual'&&!memberId)||(mode==='class'&&!classFilter)}>Pratinjau</button>
        {preview&&<div className="section"><h2>{preview.title}</h2><table><tbody>{Object.entries(preview.values||{}).map(([k,v])=><tr key={k}><th>{k}</th><td>{String(v)}</td></tr>)}</tbody></table>{(preview.individuals||[{name:'Perkembangan target',details:preview.details}]).map((p:any,i:number)=><div key={i}><h3>{p.name}</h3><table><thead><tr><th>Target</th><th>Nilai</th><th>Catatan</th></tr></thead><tbody>{(p.details||[]).map((d:any,j:number)=><tr key={j}><td>{d.target}</td><td>{d.value??'Belum dinilai'}</td><td>{d.note}</td></tr>)}</tbody></table></div>)}</div>}
      </section>
      <form className="card writeOnly" onSubmit={upload}>
        <h2>Upload Template</h2>
        <div className="formGrid">
          <label>Nama template<input className="input" name="name" required/></label>
          <label>Jenis<select className="select" name="kind" required><option value="pptx">PowerPoint</option><option value="docx">Word</option></select></label>
          <label className="span2">File<input className="input" type="file" name="file" accept=".pptx,.docx" required/></label>
        </div>
        <button className="btn section">Upload Template</button>
        <div className="list section">{templates.map(t=><div className="item row between" key={t.id}><div><div className="itemTitle">{t.name}</div><div className="itemMeta">{t.file_name} · {t.field_map?.method==='gemini_mapping'?`${t.field_map.mappings?.length??0} posisi dipetakan AI`:'Gunakan placeholder eksplisit'}</div></div><span className="badge">{t.kind.toUpperCase()}</span><input aria-label={`Nama template ${t.name}`} className="input" defaultValue={t.name} onBlur={e=>{if(e.target.value.trim()&&e.target.value.trim()!==t.name)void editTemplate(t.id,{name:e.target.value})}}/><button type="button" className="btn" onClick={()=>void editTemplate(t.id,{active:false})}>Nonaktifkan</button></div>)}</div>
      </form>
    </div>
  </>;
}
