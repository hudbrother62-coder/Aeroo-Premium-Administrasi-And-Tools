'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect,useState} from 'react';
import {ArrowLeft,BookOpen,RefreshCw,Sparkles} from 'lucide-react';
import '../../tulis/tulis.css';
import '../../../notulensi/notulensi.css';
import {isNotulensi} from '@/lib/journal-kind';

type Analysis={status?:string;created_at?:string;summary?:string;suggestion?:string;matches?:Array<{target_id:string;title:string;relation:string;reason:string;quote:string}>;numeric_progress_updated?:boolean};
type Journal={id:string;title:string;journal_date:string;journal_kind:string;started_at?:string;ended_at?:string;material?:string;summary?:string;result?:string;achievement?:string;improvement_plan?:string;decisions?:string;notes?:string;obstacles?:string;follow_up?:string;assessment?:{meeting_minutes?:boolean;proposal?:string;ai_target_analysis?:Analysis;class_assessment?:{observation?:string;achievement?:string;improvement_plan?:string};materials?:Array<{topic?:string;page?:string;status?:string;note?:string}>;presenter?:string;implementation?:string;evaluation?:string;source_text?:string;source_url?:string;source_original_date?:string;requires_attachment_review?:boolean;requires_date_review?:boolean};state:string};
export default function JournalResult(){
 const {id}=useParams<{id:string}>();
 const [journal,setJournal]=useState<Journal|null>(null);
 const [loading,setLoading]=useState(true);
 const [analyzing,setAnalyzing]=useState(false);
 const [error,setError]=useState('');
 const [canWrite,setCanWrite]=useState(false);
 useEffect(()=>{fetch('/api/auth/me').then(r=>r.ok?r.json():null).then(u=>setCanWrite(Boolean(u&&!u.public&&u.role&&u.role!=='VIEWER'&&u.permissions?.['journal.write']!==false))).catch(()=>setCanWrite(false));},[]);
 async function load(){
   const r=await fetch('/api/journals/'+encodeURIComponent(id),{cache:'no-store'});
   const j=await r.json();if(!r.ok)throw Error(j.error||'Jurnal tidak bisa dibuka');
   setJournal(j);
 }
 useEffect(()=>{let alive=true;fetch('/api/journals/'+encodeURIComponent(id),{cache:'no-store'})
   .then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error||'Gagal membaca jurnal');return v})
   .then(j=>{if(alive)setJournal(j)}).catch(e=>{if(alive)setError((e as Error).message)})
   .finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[id]);
 async function analyze(){
   setError('');setAnalyzing(true);
   try{const r=await fetch('/api/journals/'+encodeURIComponent(id)+'/analyze',{method:'POST'});const j=await r.json();if(!r.ok)throw Error(j.error||'Analisis gagal');await load()}
   catch(e){setError((e as Error).message)}finally{setAnalyzing(false)}
 }
 const ai=journal?.assessment?.ai_target_analysis;
 const isMeeting=journal?isNotulensi(journal):false;
 return <main className="fj-shell">
   <Link className="fj-back" href={isMeeting?'/notulensi':'/jurnal/riwayat'}><ArrowLeft size={17}/> Kembali ke riwayat</Link>
   <header className="fj-header"><span><BookOpen size={18}/> {isMeeting?'NOTULENSI TERSIMPAN':'JURNAL TERSIMPAN'}</span><h1>{journal?.title||'Hasil Jurnal'}</h1>
     <p>{journal?.journal_date||''} · {journal?.journal_kind||''}{journal?.started_at||journal?.ended_at?' · '+[journal?.started_at?.slice(0,5),journal?.ended_at?.slice(0,5)].filter(Boolean).join(' – '):''}</p></header>
   <section className="fj-panel">
    {loading?<p>Memuat jurnal…</p>:!journal?<p>{error||'Jurnal tidak ditemukan.'}</p>:<>
      {isMeeting?<>
        {(journal.assessment?.requires_attachment_review||journal.assessment?.requires_date_review)&&
          <div className="minutesArchiveWarning" role="note">
            {journal.assessment?.requires_attachment_review?'Lampiran gambar pada notulensi ini belum ditranskripsikan. Periksa dokumen sumber sebelum melengkapi.':'Hari yang tertulis di dokumen sumber tidak sesuai dengan tanggal kalender. Tanggal arsip mengikuti angka tanggal dalam sumber.'}
          </div>}
        <div className="minutesResultSections">
          {[
            {label:'Usulan',text:journal.assessment?.proposal||journal.summary||''},
            {label:'Pembahasan / Keputusan',text:journal.decisions||''},
            {label:'Catatan dan Evaluasi',text:journal.notes||(journal.assessment?.proposal&&journal.summary!==journal.assessment.proposal?journal.summary:'')}
          ].filter(section=>Boolean(section.text?.trim())).map((section,index)=>
            <section className="minutesResultBlock" key={section.label}>
              <h2><span>{index+1}</span>{section.label}</h2>
              <div className="minutesDocumentText">{section.text}</div>
            </section>)}
        </div>
        {journal.assessment?.source_text&&<details className="minutesOriginal">
          <summary>Lihat transkripsi asli tanpa pengubahan redaksi</summary>
          <div className="minutesDocumentText">{journal.assessment.source_original_date}{'\n'}{journal.assessment.source_text}</div>
        </details>}
        {journal.assessment?.source_url?.startsWith('https://docs.google.com/document/')&&
          <a className="minutesSourceLink" href={journal.assessment.source_url} target="_blank" rel="noopener noreferrer">Buka dokumen sumber</a>}
      </>:<>
        {journal.material&&<div className="fj-textblock"><strong>Materi</strong><p>{journal.material}</p></div>}
        {journal.summary&&<div className="fj-textblock"><strong>Catatan kegiatan</strong><p>{journal.summary}</p></div>}
        {journal.result&&<div className="fj-textblock"><strong>Hasil kegiatan</strong><p>{journal.result}</p></div>}
        {journal.achievement&&<div className="fj-textblock"><strong>Capaian</strong><p>{journal.achievement}</p></div>}
        {journal.notes&&<div className="fj-textblock"><strong>Catatan tambahan</strong><p>{journal.notes}</p></div>}
        {journal.assessment?.presenter&&<div className="fj-textblock"><strong>Pemateri</strong><p>{journal.assessment.presenter}</p></div>}
        {journal.assessment?.implementation&&<div className="fj-textblock"><strong>Pelaksanaan</strong><p>{journal.assessment.implementation}</p></div>}
        {journal.assessment?.evaluation&&<div className="fj-textblock"><strong>Evaluasi</strong><p>{journal.assessment.evaluation}</p></div>}
        {journal.assessment?.class_assessment?.observation&&<div className="fj-textblock"><strong>Observasi pembelajaran</strong><p>{journal.assessment.class_assessment.observation}</p></div>}
        {(journal.assessment?.materials||[]).filter(m=>m.topic).length>0&&<div className="fj-textblock"><strong>Materi pembelajaran</strong><ul>{journal.assessment!.materials!.filter(m=>m.topic).map((m,i)=><li key={i}>{m.topic}{m.page?' · Halaman '+m.page:''}{m.note?' — '+m.note:''}</li>)}</ul></div>
        {journal.obstacles&&<div className="fj-textblock"><strong>Kendala</strong><p>{journal.obstacles}</p></div>}
        {journal.follow_up&&<div className="fj-textblock"><strong>Tindak lanjut</strong><p>{journal.follow_up}</p></div>}
        {(journal.improvement_plan||journal.assessment?.class_assessment?.improvement_plan)&&<div className="fj-textblock"><strong>Rencana perbaikan</strong><p>{journal.improvement_plan||journal.assessment?.class_assessment?.improvement_plan}</p></div>
      </>}
      {!isMeeting&&<div className="fj-ai">
        <h3><Sparkles size={18}/> Pencocokan dengan target</h3>
        {ai?<><p>{ai.summary}</p>{(ai.matches||[]).length?
          <div className="fj-matches">{ai.matches!.map((m,i)=><article key={m.target_id+i}>
            <strong>{m.title}</strong><span>{m.relation==='DIAJARKAN'?'Tercatat diajarkan':m.relation==='INDIKASI'?'Indikasi keterkaitan':'Belum terbukti'}</span>
            <details><summary>Alasan</summary><p>{m.reason}</p><blockquote>“{m.quote}”</blockquote></details></article>)}</div>
        :<div className="fj-hint">Belum ditemukan kecocokan target dengan bukti yang cukup.</div>}
        {ai.suggestion&&<p><strong>Saran:</strong> {ai.suggestion}</p>}
        
        </>:<p>Belum dianalisis.</p>}
        {canWrite&&<button type="button" className="fj-secondary" disabled={analyzing||journal.state==='ARCHIVED'} onClick={()=>void analyze()}><RefreshCw size={17}/>{analyzing?'Menganalisis…':ai?'Analisis ulang':'Analisis dengan Groq'}</button>}}
        {error&&<div className="fj-error" role="alert">{error}</div>}
      </div>}
      <div className="fj-actions"><Link className="fj-secondary" href={isMeeting?'/notulensi':'/jurnal/riwayat'}>Riwayat</Link>{canWrite&&<Link className="fj-primary" href={isMeeting?'/jurnal/tulis?mode=notulensi':'/jurnal/tulis'}>{isMeeting?'Buat notulensi lagi':'Tulis jurnal lagi'}</Link>}</div>
    </>}
   </section>
 </main>;
}
