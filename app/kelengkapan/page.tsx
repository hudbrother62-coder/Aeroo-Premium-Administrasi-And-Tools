'use client';

import Link from 'next/link';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {AlertCircle,ArrowRight,BookOpen,CheckCircle2,ClipboardCheck,FileWarning,FileText,RefreshCw,Search,Target,Users,Upload,CalendarCheck2} from 'lucide-react';
import './kelengkapan.css';

type Key='members'|'attendance'|'journals'|'documentation'|'targets'|'followups'|'imports';
type Issue={id:string;title:string;detail:string;href:string};
type Section={key:Key;title:string;items:Issue[];partial:boolean;unavailable:boolean};
type State={loading:boolean;data:Section|null;error:string};
const groups=[
  {key:'members',title:'Data Anggota',caption:'Jenjang dan kelas belum lengkap',href:'/database',icon:Users},
  {key:'attendance',title:'Presensi',caption:'Peserta belum diabsen',href:'/presensi',icon:ClipboardCheck},
  {key:'journals',title:'Jurnal',caption:'Jurnal wajib atau draft',href:'/jurnal',icon:BookOpen},
  {key:'documentation',title:'Dokumentasi',caption:'Bukti kegiatan belum tersedia',href:'/agenda',icon:FileText},
  {key:'targets',title:'Target & Progres',caption:'Penilaian belum selesai',href:'/target',icon:Target},
  {key:'followups',title:'Tindak Lanjut',caption:'Keputusan melewati tenggat',href:'/jurnal',icon:CalendarCheck2},
  {key:'imports',title:'Import',caption:'Berkas impor bermasalah',href:'/impor',icon:Upload}
] as const;
const keys=groups.map(x=>x.key);
const empty=()=>Object.fromEntries(keys.map(key=>[key,{loading:true,data:null,error:''}])) as Record<Key,State>;
export default function CompletenessPage(){
  const[states,setStates]=useState<Record<Key,State>>(empty);
  const[filter,setFilter]=useState<Key|'all'>('all');
  const[search,setSearch]=useState('');
  const[refresh,setRefresh]=useState(0);
  const[expanded,setExpanded]=useState<Record<string,boolean>>({});
  const[updated,setUpdated]=useState('');
  const loadOne=useCallback(async(key:Key,signal?:AbortSignal)=>{
    setStates(old=>({...old,[key]:{...old[key],loading:true,error:''}}));
    try{
      const response=await fetch('/api/completeness?group='+encodeURIComponent(key),{cache:'no-store',signal});
      const json=await response.json().catch(()=>({error:'Respons server tidak dapat dibaca.'}));
      if(!response.ok)throw Error(json.error||'Gagal mengambil data pemeriksaan.');
      if(signal?.aborted)return;
      setStates(old=>({...old,[key]:{loading:false,data:json as Section,error:''}}));
      setUpdated(new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}));
    }catch(error){
      if(signal?.aborted)return;
      setStates(old=>({...old,[key]:{loading:false,data:null,error:error instanceof Error?error.message:'Gagal memuat.'}}));
    }
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    for(const key of keys)void loadOne(key,controller.signal);
    return()=>controller.abort();
  },[loadOne,refresh]);
  const pending=keys.filter(k=>states[k].loading).length;
  const failed=keys.filter(k=>Boolean(states[k].error)).length;
  const unavailable=keys.filter(k=>states[k].data?.unavailable).length;
  const total=keys.reduce((sum,k)=>sum+(states[k].data?.items.length||0),0);
  const finished=pending===0&&failed===0;
  const visible=useMemo(()=>groups.filter(g=>filter==='all'||filter===g.key).map(g=>{
    const status=states[g.key],q=search.trim().toLocaleLowerCase('id-ID');
    const matches=(status.data?.items||[]).filter(x=>!q||[x.title,x.detail].some(s=>s.toLocaleLowerCase('id-ID').includes(q)));
    return {...g,status,matches};
  }).filter(g=>!search.trim()||g.matches.length>0||g.status.loading||Boolean(g.status.error)),[filter,search,states]);
  return <div className="kcPage">
    <header className="kcHeader">
      <div><span className="kcEyebrow"><ClipboardCheck size={16}/> PUSAT PEMERIKSAAN ADMINISTRASI</span>
        <h1>Kelengkapan Data</h1>
        <p>Periksa administrasi yang belum selesai, buka temuan, dan lengkapi langsung di menu asalnya. Data sarana dan prasarana dikelola terpisah di <Link href="/sarpras">Sarana &amp; Prasarana</Link>.</p></div>
      <button type="button" className="kcRefresh" onClick={()=>setRefresh(x=>x+1)} disabled={pending>0}>
        <RefreshCw size={16}/> {pending?'Memeriksa…':'Periksa Ulang'}
      </button>
    </header>
    <div className="kcOverview">
      <div className="kcOverviewMain"><span>Total temuan terdeteksi</span><strong>{total.toLocaleString('id-ID')}</strong>
        <small>{pending?'Memeriksa '+pending+' kategori…':failed?failed+' kategori gagal dimuat':unavailable?unavailable+' kategori di luar akses akun':'Berdasarkan data yang dapat diakses'}</small></div>
      <div className="kcOverviewAside"><div><b>{keys.length-pending-failed-unavailable}</b><span>Kategori berhasil diperiksa</span></div>
        <div><b>{failed}</b><span>Kategori bermasalah</span></div></div>
    </div>
    <div className="kcHelper">
      <CheckCircle2 size={19}/><span><strong>Cara menggunakannya:</strong> pilih kategori yang memiliki temuan, tekan <b>Perbaiki data</b>, isi atau koreksi informasi pada menu terkait, lalu tekan <b>Periksa Ulang</b>.</span>
    </div>
    <div className="kcGrid" aria-label="Ringkasan kelengkapan">
      {groups.map(g=>{const Icon=g.icon;const s=states[g.key];const count=s.data?.items.length??0;return <button key={g.key} type="button"
        onClick={()=>setFilter(f=>f===g.key?'all':g.key)} aria-pressed={filter===g.key} className={'kcMetric'+(filter===g.key?' selected':'')}>
        <span className="kcMetricTop"><Icon size={20}/><span>{s.loading?'Memuat':s.error?'Gagal':s.data?.unavailable?'Terbatas':count?'Perlu dilengkapi':'Lengkap'}</span></span>
        <strong>{s.loading?'…':s.error?'!':s.data?.unavailable?'—':count.toLocaleString('id-ID')}</strong>
        <span className="kcMetricTitle">{g.title}</span><small>{g.caption}</small>
      </button>})}
    </div>
    <div className="kcSectionTitle"><div><h2>Daftar yang Perlu Dilengkapi</h2><p>Pilih kategori atau cari kegiatan dan nama anggota untuk membuka detail.</p></div>
      {updated&&<small>Terakhir diperiksa {updated} WIB</small>}</div>
    <div className="kcToolbar">
      <label className="kcSearch"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari temuan atau nama kegiatan…" aria-label="Cari kelengkapan"/></label>
      <select value={filter} onChange={e=>setFilter(e.target.value as Key|'all')} aria-label="Filter kategori"><option value="all">Semua kategori</option>{groups.map(g=><option key={g.key} value={g.key}>{g.title}</option>)}</select>
    </div>
    {failed>0&&<div className="kcNotice" role="alert"><AlertCircle size={18}/><span>{failed} pemeriksaan gagal dimuat. Temuan di kategori lain tetap dapat dibuka. Coba ulang hanya kategori bermasalah.</span></div>}
    {finished&&total===0&&<div className="kcSuccess"><CheckCircle2 size={29}/><div><strong>Tidak ada temuan pada data yang dapat diakses</strong><p>Belum ada kelengkapan yang perlu diperbaiki dari pemeriksaan saat ini. {unavailable?'Beberapa kategori tidak tersedia untuk akun ini.':''}</p></div></div>}
    <div className="kcSections">{visible.map(g=>{
      const s=g.status,count=s.data?.items.length||0,cap=expanded[g.key]?count:12;
      return <section className="kcSection" key={g.key} id={'kelengkapan-'+g.key}>
        <div className="kcSectionHead"><div><h3>{g.title}</h3><p>{g.caption}</p></div>
          <Link href={g.href} className="kcViewAll">Buka menu <ArrowRight size={15}/></Link></div>
        {s.loading?<div className="kcEmpty">Memeriksa data {g.title.toLowerCase()}…</div>:
        s.error?<div className="kcError"><FileWarning size={19}/><span>Tidak dapat memeriksa {g.title.toLowerCase()}: {s.error}</span><button type="button" onClick={()=>void loadOne(g.key)}>Coba lagi</button></div>:
        s.data?.unavailable?<div className="kcEmpty">Tidak tersedia untuk hak akses akun ini.</div>:
        !g.matches.length?<div className="kcEmpty"><CheckCircle2 size={18}/>{search?'Tidak ada temuan yang cocok dengan pencarian.':'Tidak ada temuan pada kategori ini.'}</div>:
        <><div className="kcIssues">{g.matches.slice(0,cap).map(x=><Link key={x.id} className="kcIssue" href={x.href}>
          <span className="kcIssueDot"/><span className="kcIssueBody"><strong>{x.title}</strong><small>{x.detail}</small></span><span className="kcFix">Perbaiki data <ArrowRight size={15}/></span></Link>)}</div>
          {g.matches.length>cap&&<button type="button" className="kcMore" onClick={()=>setExpanded(v=>({...v,[g.key]:true}))}>Tampilkan {g.matches.length-cap} temuan lainnya</button>}
          {s.data?.partial&&<p className="kcPartial">Daftar ini dibatasi untuk menjaga performa. Periksa ulang setelah beberapa temuan diselesaikan.</p>}</>}
      </section>;
    })}</div>
    {!visible.length&&search&&<div className="kcEmpty">Tidak ditemukan hasil untuk pencarian tersebut.</div>}
  </div>;
}
