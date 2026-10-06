'use client';

import {useEffect,useState} from 'react';
import {Download,FileText,Image as ImageIcon,Upload,X} from 'lucide-react';

type Item={
  id:string;
  file_name:string;
  mime_type:string|null;
  created_at:string;
  url:string|null;
};

export default function JournalAttachments({journalId,readOnly=false}:{journalId:string;readOnly?:boolean}){
  const[items,setItems]=useState<Item[]>([]);
  const[file,setFile]=useState<File|null>(null);
  const[loading,setLoading]=useState(true);
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');

  async function load(){
    setLoading(true);setError('');
    const r=await fetch('/api/journals/'+journalId+'/attachments',{cache:'no-store'});
    const j=await r.json();
    if(!r.ok)setError(j.error||'Dokumentasi tidak dapat dimuat.');
    else setItems(Array.isArray(j)?j:[]);
    setLoading(false);
  }

  useEffect(()=>{void load()},[journalId]);

  async function upload(){
    if(!file)return;
    setBusy(true);setError('');
    const fd=new FormData();fd.set('file',file);
    const r=await fetch('/api/journals/'+journalId+'/attachments',{method:'POST',body:fd});
    const j=await r.json();
    setBusy(false);
    if(!r.ok){setError(j.error||'Upload gagal.');return}
    setFile(null);await load();
  }

  async function remove(id:string){
    setBusy(true);setError('');
    const r=await fetch('/api/journals/'+journalId+'/attachments?attachment_id='+encodeURIComponent(id),{method:'DELETE'});
    const j=await r.json();
    setBusy(false);
    if(!r.ok){setError(j.error||'Dokumentasi gagal dihapus.');return}
    await load();
  }

  return <section className="card section journalEvidence">
    <div className="cardHead">
      <div><h2>Dokumentasi</h2><span className="itemMeta">JPG, PNG, WebP, PDF · maksimal 10 MB</span></div>
    </div>

    {!readOnly&&<div className="evidenceUpload">
      <input className="input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setFile(e.target.files?.[0]||null)}/>
      <button type="button" className="btn secondary" disabled={!file||busy} onClick={()=>void upload()}>
        <Upload size={15}/>{busy?'Mengunggah…':'Unggah'}
      </button>
    </div>}

    {error&&<div className="notice error section">{error}</div>}
    {loading?<div className="emptyState">Memuat dokumentasi…</div>:<div className="evidenceGrid section">
      {items.map(item=><article className="evidenceItem" key={item.id}>
        <div className="evidenceIcon">{item.mime_type?.startsWith('image/')?<ImageIcon size={18}/>:<FileText size={18}/>}</div>
        <div className="evidenceInfo">
          {item.url?<a href={item.url} target="_blank" rel="noreferrer"><strong>{item.file_name}</strong></a>:<strong>{item.file_name}</strong>}
          <span>{new Date(item.created_at).toLocaleString('id-ID')}</span>
        </div>
        <div className="evidenceActions"><a className="iconOnly" href={'/api/journals/'+journalId+'/attachments?download='+encodeURIComponent(item.id)} title="Unduh dokumentasi" aria-label={'Unduh '+item.file_name}><Download size={15}/></a>{!readOnly&&<button className="iconOnly" type="button" title="Hapus dokumentasi" disabled={busy} onClick={()=>void remove(item.id)}><X size={15}/></button>}</div>
      </article>)}
      {!items.length&&<div className="emptyState">Belum ada file dokumentasi.</div>}
    </div>}
  </section>;
}
