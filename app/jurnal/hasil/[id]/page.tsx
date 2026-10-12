'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect,useState} from 'react';
import {ArrowLeft,BookOpen,RefreshCw,Sparkles} from 'lucide-react';
import '../../tulis/tulis.css';

type Analysis={status?:string;created_at?:string;summary?:string;suggestion?:string;matches?:Array<{target_id:string;title:string;relation:string;reason:string;quote:string}>;numeric_progress_updated?:boolean};
type Journal={id:string;title:string;journal_date:string;journal_kind:string;material?:string;summary?:string;obstacles?:string;follow_up?:string;assessment?:{ai_target_analysis?:Analysis};state:string};
export default function JournalResult(){
 const {id}=useParams<{id:string}>();
 const [journal,setJournal]=useState<Journal|null>(null);
 const [loading,setLoading]=useState(true);
 const [analyzing,setAnalyzing]=useState(false);
 const [error,setError]=useState('');
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
 return <main className="fj-shell">
   <Link className="fj-back" href="/jurnal/riwayat"><ArrowLeft size={17}/> Kembali ke riwayat</Link>
   <header className="fj-header"><span><BookOpen size={18}/> JURNAL TERSIMPAN</span><h1>{journal?.title||'Hasil Jurnal'}</h1>
     <p>{journal?.journal_date||''} · {journal?.journal_kind||''}</p></header>
   <section className="fj-panel">
    {loading?<p>Memuat jurnal…</p>:!journal?<p>{error||'Jurnal tidak ditemukan.'}</p>:<>
      {journal.material&&<div className="fj-textblock"><strong>Materi</strong><p>{journal.material}</p></div>}
      {journal.summary&&<div className="fj-textblock"><strong>Catatan guru</strong><p>{journal.summary}</p></div>}
      {journal.obstacles&&<div className="fj-textblock"><strong>Kendala</strong><p>{journal.obstacles}</p></div>}
      {journal.follow_up&&<div className="fj-textblock"><strong>Tindak lanjut</strong><p>{journal.follow_up}</p></div>}
      <div className="fj-ai">
        <h3><Sparkles size={18}/> Pencocokan dengan target</h3>
        {ai?<><p>{ai.summary}</p>{(ai.matches||[]).length?
          <div className="fj-matches">{ai.matches!.map((m,i)=><article key={m.target_id+i}>
            <strong>{m.title}</strong><span>{m.relation==='DIAJARKAN'?'Tercatat diajarkan':m.relation==='INDIKASI'?'Indikasi keterkaitan':'Belum terbukti'}</span>
            <p>{m.reason}</p><blockquote>“{m.quote}”</blockquote></article>)}</div>
        :<div className="fj-hint">Belum ditemukan kecocokan target dengan bukti yang cukup.</div>}
        {ai.suggestion&&<p><strong>Saran:</strong> {ai.suggestion}</p>}
        <small>Hanya saran analisis, tidak menghitung nilai individual atau menyatakan target tuntas.</small>
        </>:<p>Belum ada analisis AI. Jurnal tetap dapat digunakan meskipun Groq belum diaktifkan.</p>}
        <button type="button" className="fj-secondary" disabled={analyzing||journal.state==='ARCHIVED'} onClick={()=>void analyze()}><RefreshCw size={17}/>{analyzing?'Menganalisis…':ai?'Analisis ulang':'Analisis dengan Groq'}</button>
        {error&&<div className="fj-error" role="alert">{error}</div>}
      </div>
      <div className="fj-actions"><Link className="fj-secondary" href="/jurnal/riwayat">Riwayat</Link><Link className="fj-primary" href="/jurnal/tulis">Tulis jurnal lagi</Link></div>
    </>}
   </section>
 </main>;
}
