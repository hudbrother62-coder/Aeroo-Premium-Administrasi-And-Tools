'use client';

import Link from 'next/link';
import Image from 'next/image';
import {useEffect,useState,type ReactNode} from 'react';
import {Activity,ArrowRight,BarChart3,BookOpen,CalendarDays,CheckCircle2,ChevronRight,ClipboardCheck,Clock3,Download,Eye,GraduationCap,LogIn,RefreshCw,Target,Users,AlertCircle} from 'lucide-react';
import type {DashboardAnalytics,DashboardBucket,DashboardGroup} from '@/lib/dashboard-analytics';
import './dashboard.css';

type Task={id:string;title:string;journal_id?:string};
type TaskFeed={todayEvents:Task[];unfinishedAttendance:Task[];draftJournals:Task[];overdueDecisions:Task[]};
type Dashboard=DashboardAnalytics&{
  role?:string;todayEvents?:Task[];unfinishedAttendance?:Task[];draftJournals?:Task[];
  overdueDecisions?:Task[];completeness?:{members:number;attendance:number;journals:number;followups:number;imports:number};
};
const number=new Intl.NumberFormat('id-ID');
function pct(value:number|null|undefined){return value==null?'—':number.format(value)+'%';}
function chartLine(bucket:DashboardBucket[],color='var(--sim-blue)'){
  const left=50,right=640,top=20,bottom=170;
  const point=(index:number,value:number)=>({x:left+(bucket.length===1?0:index/(bucket.length-1))*(right-left),y:bottom-(value/100)*(bottom-top)});
  const segments:string[]=[];let segment='';
  bucket.forEach((item,index)=>{
    if(item.percentage===null){if(segment)segments.push(segment);segment='';return;}
    const pos=point(index,item.percentage);
    segment+=(segment?' L ':'M ')+pos.x.toFixed(1)+' '+pos.y.toFixed(1);
  });
  if(segment)segments.push(segment);
  return <div className="simLineWrap">
    <svg className="simLine" viewBox="0 0 690 230" role="img" aria-label="Grafik tren persentase kehadiran berdasarkan periode">
      {[0,25,50,75,100].map(t=>{
        const y=bottom-t/100*(bottom-top);
        return <g key={t}><line x1={left} x2={right+7} y1={y} y2={y} stroke="currentColor" opacity=".12" strokeDasharray={t===0?'0':'4 6'}/><text x={left-10} y={y+4} textAnchor="end" className="simAxisText">{t}%</text></g>;
      })}
      {segments.map((path,i)=><path key={i} d={path} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>)}
      {bucket.map((item,i)=>item.percentage===null?null:<circle key={i} cx={point(i,item.percentage).x} cy={point(i,item.percentage).y} r="5.5" stroke="var(--sim-panel)" strokeWidth="3" fill={color}><title>{item.label}: {pct(item.percentage)} ({item.present} hadir dari {item.total} tercatat)</title></circle>)}
      {bucket.map((item,i)=><text key={i} x={point(i,0).x} y="204" textAnchor="middle" className="simAxisText">{item.label}</text>)}
    </svg>
    {!bucket.some(b=>b.percentage!==null)&&<div className="simChartEmpty">Belum ada hasil presensi pada periode ini.</div>}
  </div>;
}
function HorizontalStats({items,mode}:{items:DashboardGroup[];mode:'attendance'|'count'|'progress'}){
  const list=items,max=Math.max(1,...list.map(x=>x.count));
  if(!list.length)return <p className="simMuted simEmptyMini">Belum ada data untuk ditampilkan.</p>;
  return <div className="simHorizontal">{list.map((x,i)=><div className="simHorizontalItem" key={x.id}>
    <div className="simHorizontalHead"><strong title={x.name}>{x.name}</strong><b>{mode==='count'?number.format(x.count):pct(x.percentage)}</b></div>
    <div className="simTrack"><span style={{width:(mode==='count'?(x.count/max*100):(x.percentage??0))+'%',background:['var(--sim-blue)','var(--sim-purple)','var(--sim-green)','var(--sim-amber)','var(--sim-sky)'][i%5]}}/></div>
    <small>{mode==='attendance'?(x.total?number.format(x.present)+' hadir dari '+number.format(x.total)+' tercatat':'Belum ada presensi'):(x.count===1?'1 anggota':number.format(x.count)+' anggota')}</small>
  </div>)}</div>;
}
function VerticalStats({items,format}:{items:Array<{label:string;value:number}>;format?:string}){
  const max=Math.max(1,...items.map(x=>x.value));
  if(!items.length)return <p className="simMuted simEmptyMini">Belum ada data.</p>;
  return <div className="simVerticalChart">{items.map((x,i)=><div className="simVerticalItem" key={i}>
    <div className="simVerticalValue">{number.format(x.value)}{format||''}</div>
    <div className="simVerticalTrack"><div className="simVerticalFill" style={{height:(x.value?Math.max(4,x.value/max*100):0)+'%'}}/></div>
    <span title={x.label}>{x.label}</span>
  </div>)}</div>;
}
function StatCard({href,icon,label,value,detail,tone}:{href:string;icon:ReactNode;label:string;value:string;detail:string;tone:string}){
  return <Link className={'simStat simStat-'+tone} href={href}><div className="simStatTop"><span className="simStatIcon">{icon}</span><ArrowRight size={17}/></div><span className="simStatLabel">{label}</span><strong className="simStatValue">{value}</strong><small>{detail}</small></Link>;
}
function ChartCard({title,subtitle,children,action}:{title:string;subtitle?:string;children:ReactNode;action?:ReactNode}){
  return <section className="simPanel"><div className="simPanelTitle"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>{children}</section>;
}
function monthLabel(month:string){
  try{return new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T00:00:00Z'));}
  catch{return month;}
}
export default function Home(){
  const [data,setData]=useState<Dashboard|null>(null);
  const [loggedIn,setLoggedIn]=useState(false);
  const [canOperate,setCanOperate]=useState(false);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [tasks,setTasks]=useState<TaskFeed|null>(null);
  const [tasksLoading,setTasksLoading]=useState(false);
  const [tasksError,setTasksError]=useState(false);
  const [level,setLevel]=useState('');
  const [month,setMonth]=useState(()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'}).slice(0,7));
  const [span,setSpan]=useState<1|3|6>(1);
  const [reload,setReload]=useState(0);
  const [visitorName,setVisitorName]=useState('');
  const [visitMessage,setVisitMessage]=useState('');
  useEffect(()=>{
    let alive=true;
    const controller=new AbortController();
    async function load(){
      setLoading(true);setError('');
      try{
        const auth=await fetch('/api/auth/me',{cache:'no-store',signal:controller.signal});
        if(!auth.ok)throw new Error('Tidak dapat memeriksa akses pengguna.');
        const user=await auth.json();
        const signed=Boolean(user&&!user.public&&user.role!=='VIEWER');
        const q=new URLSearchParams({month,span:String(span)});
        if(level)q.set('level_id',level);
        const response=await fetch((signed?'/api/dashboard':'/api/public/recap')+'?'+q.toString(),{cache:'no-store',signal:controller.signal});
        const result=await response.json();
        if(!response.ok)throw new Error(result.error||'Ringkasan belum dapat dimuat.');
        if(!alive)return;
        setData(result);setLoggedIn(signed);setCanOperate(signed&&Array.isArray(user.write_scopes)&&user.write_scopes.length>0);
      }catch(e){
        if(!alive)return;
        // Keep the last successful charts visible if a refresh times out.
        setError(e instanceof Error?e.message:'Gagal memuat ringkasan.');
      }finally{if(alive)setLoading(false);}
    }
    void load();
    return ()=>{alive=false;controller.abort();};
  },[month,span,level,reload]);
  useEffect(()=>{
    if(!loggedIn){setTasks(null);setTasksError(false);return;}
    let alive=true;
    const controller=new AbortController();
    setTasks(null);setTasksLoading(true);setTasksError(false);
    const q=level?'?level_id='+encodeURIComponent(level):'';
    void (async()=>{
      try{
        const response=await fetch('/api/dashboard/tasks'+q,{cache:'no-store',signal:controller.signal});
        if(!response.ok)throw new Error('Tindak lanjut sementara tidak tersedia.');
        const result=await response.json();
        if(alive)setTasks(result as TaskFeed);
      }catch{
        if(alive)setTasksError(true);
      }finally{if(alive)setTasksLoading(false);}
    })();
    return ()=>{alive=false;controller.abort();};
  },[loggedIn,level,reload]);
  useEffect(()=>{
    if(!loggedIn&&data){
      try{
        if(!sessionStorage.getItem('aeroo-viewer-visited')){
          sessionStorage.setItem('aeroo-viewer-visited','1');
          void fetch('/api/public/visit',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
        }
      }catch{/* Kunjungan opsional, tidak menghalangi dashboard. */}
    }
  },[loggedIn,data]);
  async function identify(){
    const r=await fetch('/api/public/visit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:visitorName.trim()})});
    setVisitMessage(r.ok?'Nama kunjungan tercatat.':'Gagal mencatat kunjungan.');
  }
  const attendance=data?.attendance;
  const levelName=level?data?.levels?.find(x=>x.id===level)?.name||'Jenjang':'Semua Jenjang';
  const trend=data?.trend||[];
  const checklist=0;
  const hasActions=Boolean(tasks?.unfinishedAttendance?.length||tasks?.draftJournals?.length||tasks?.overdueDecisions?.length);
  const period=span===1?'bulan ini':span+' bulan';
  return <div className="simDashboard">
    <div className="simHero">
      <div><span className="simEyebrow"><Activity size={14}/> PUSAT ANALISIS SIMPUL</span><h1>Ringkasan Organisasi</h1><p>Pantau presensi, kegiatan, dan perkembangan setiap jenjang dalam satu tampilan.</p></div>
      <div className="simHeroLogo"><Image src="/simpul-logo.webp" alt="Simpul" width={64} height={64} priority/></div>
    </div>
    <div className="simControls">
      <div className="simFilterGroup">
        <label><span><GraduationCap size={15}/> Jenjang</span><select className="simSelect" aria-label="Pilih jenjang dashboard" value={level} onChange={e=>setLevel(e.target.value)}><option value="">Semua Jenjang</option>{(data?.levels||[]).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label><span><CalendarDays size={15}/> Bulan</span><input type="month" className="simSelect" aria-label="Pilih bulan dashboard" value={month} onChange={e=>setMonth(e.target.value)}/></label>
        <label><span><Clock3 size={15}/> Periode</span><select className="simSelect" aria-label="Pilih periode grafik" value={span} onChange={e=>setSpan(Number(e.target.value) as 1|3|6)}><option value="1">1 bulan</option><option value="3">3 bulan</option><option value="6">6 bulan</option></select></label>
      </div>
      <div className="simControlActions"><button className="simIconButton" aria-label="Segarkan grafik" title="Segarkan dari database" onClick={()=>setReload(x=>x+1)} disabled={loading}><RefreshCw size={18} className={loading?'simSpin':''}/></button><Link className="simReportLink" href="/laporan"><Download size={16}/> Laporan</Link></div>
    </div>
    <div className="simScope"><span className="simDot"/> Menampilkan <strong>{levelName}</strong> · {monthLabel(month)} · {period}{loading&&<span className="simLoadingNote"> · Memuat data…</span>}</div>
    {error&&<div className="notice error simError"><AlertCircle size={17}/>{error}<button onClick={()=>setReload(x=>x+1)}>Coba lagi</button></div>}
    {!loggedIn&&!loading&&data&&<div className="simViewerHint"><Eye size={17}/><span>Mode viewer: grafik menggunakan data publik dan hanya bisa dibaca.</span><Link href="/login"><LogIn size={15}/> Masuk</Link></div>}
    {canOperate&&<div className="simQuickActions"><Link href="/agenda?create=1"><CalendarDays size={16}/> Buat Agenda</Link><Link href="/presensi/buat"><ClipboardCheck size={16}/> Presensi</Link><Link href="/jurnal/buat"><BookOpen size={16}/> Tulis Jurnal</Link></div>}
    {loading&&!data?<div className="simLoadingGrid" role="status" aria-label="Memuat ringkasan"><div className="simSkeleton"/><div className="simSkeleton"/><div className="simSkeleton"/><div className="simSkeleton"/></div>:data?<>
      <div className="simStats">
        <StatCard href="/database" icon={<Users size={22}/>} tone="purple" label="Total Anggota" value={number.format(data.members)} detail={level?'Aktif pada jenjang ini':'Anggota aktif dalam cakupan akses'}/>
        <StatCard href="/rekap-presensi" icon={<CheckCircle2 size={22}/>} tone="blue" label="Tingkat Kehadiran" value={pct(attendance?.percentage)} detail={attendance?.total?number.format(attendance.total)+' status presensi tercatat':'Belum ada status presensi'}/>
        <StatCard href="/agenda" icon={<CalendarDays size={22}/>} tone="cyan" label="Pertemuan" value={number.format(attendance?.meetings||0)} detail={'Sesi presensi · '+period}/>
        <StatCard href="/target" icon={<Target size={22}/>} tone="green" label="Capaian Target" value={pct(data.targets.percentage)} detail={data.targets.assessed?number.format(data.targets.assessed)+' penilaian tercatat':'Belum ada penilaian target'}/>
      </div>
      <div className="simMajor">
        <ChartCard title="Tren Kehadiran" subtitle={'Persentase hadir dari status H, I, A yang sudah dicatat · '+period} action={<Link href="/rekap-presensi" className="simTextLink">Detail <ArrowRight size={15}/></Link>}>
          {chartLine(trend)}
          <div className="simLegend"><span><i className="simBlueLegend"/> Kehadiran aktual</span><span>Pending tidak dihitung dalam persentase</span></div>{data.levelMapping?.inferred>0&&<div className="simLegacyNotice">{number.format(data.levelMapping.inferred)} catatan lama dipetakan menurut kelas / keanggotaan yang tersedia. <span>Data asli tidak diubah.</span></div>}
        </ChartCard>
        <ChartCard title={level?'Kehadiran per Kelas':'Kehadiran per Jenjang'} subtitle="Perbandingan persentase kehadiran tercatat">
          <HorizontalStats items={data.comparison} mode="attendance"/>
          <div className="simCardFoot"><ClipboardCheck size={15}/> {number.format(attendance?.pending||0)} status presensi belum diisi</div>
        </ChartCard>
      </div>
      <div className="simTriple">
        <ChartCard title="Progres Pembelajaran" subtitle="Nilai progres terbaru dari jurnal yang dinilai">
          {data.targets.assessed?<HorizontalStats mode="progress" items={data.targetByLevel.filter(x=>x.assessed>0).map(x=>({id:x.id,name:x.name,count:x.assessed,present:0,total:0,percentage:x.percentage}))}/>:<div className="simSpecialEmpty"><Target size={24}/><strong>Belum ada progres dinilai</strong><p>Grafik akan muncul setelah target dan penilaian jurnal tercatat.</p></div>}
          <Link href="/target" className="simTextLink simBottomLink">Lihat Target & Progres <ChevronRight size={15}/></Link>
        </ChartCard>
        <ChartCard title={span===1?'Pertemuan per Pekan':'Pertemuan per Bulan'} subtitle="Jumlah sesi presensi yang terdaftar">
          <VerticalStats items={trend.map(b=>({label:b.label,value:b.meetings}))}/>
        </ChartCard>
        <ChartCard title={level?'Sebaran Anggota per Kelas':'Sebaran Anggota per Jenjang'} subtitle="Berdasarkan keanggotaan yang masih aktif">
          <VerticalStats items={data.distribution.map(x=>({label:x.name,value:x.count}))}/>
        </ChartCard>
      </div>
      <div className="simBottomGrid">
        <ChartCard title="Komposisi Presensi" subtitle={'Status selama '+period}>
          {attendance?.total||attendance?.pending?<div className="simAttendanceBreakdown">
            <div className="simDonut" style={{background:'conic-gradient(var(--sim-green) 0 '+((attendance.present/(attendance.total+attendance.pending))*100)+'%, var(--sim-amber) '+((attendance.present/(attendance.total+attendance.pending))*100)+'% '+(((attendance.present+attendance.excused)/(attendance.total+attendance.pending))*100)+'%, var(--sim-red) '+(((attendance.present+attendance.excused)/(attendance.total+attendance.pending))*100)+'% '+((attendance.total/(attendance.total+attendance.pending))*100)+'%, var(--sim-subtle) '+((attendance.total/(attendance.total+attendance.pending))*100)+'% 100%)'}}><div><b>{pct(attendance.percentage)}</b><small>Hadir</small></div></div>
            <div className="simBreakdownLegend"><div><i style={{background:'var(--sim-green)'}}/>Hadir <strong>{number.format(attendance.present)}</strong></div><div><i style={{background:'var(--sim-amber)'}}/>Izin <strong>{number.format(attendance.excused)}</strong></div><div><i style={{background:'var(--sim-red)'}}/>Alpa <strong>{number.format(attendance.absent)}</strong></div><div><i style={{background:'var(--sim-subtle)'}}/>Belum diisi <strong>{number.format(attendance.pending)}</strong></div></div>
          </div>:<div className="simSpecialEmpty"><ClipboardCheck size={25}/><p>Belum ada presensi pada periode ini.</p></div>}
        </ChartCard>
        <ChartCard title="Perlu Ditindaklanjuti" subtitle="Prioritas administrasi yang perlu diperiksa" action={loggedIn?<Link className="simTextLink" href="/kelengkapan">Lihat semua <ArrowRight size={15}/></Link>:undefined}>
          {loggedIn&&tasksLoading?<div className="simSpecialEmpty" role="status"><RefreshCw className="simSpin" size={22}/><p>Memuat tindak lanjut…</p></div>:
          loggedIn&&tasksError?<div className="simSpecialEmpty"><AlertCircle size={23}/><strong>Tindak lanjut belum dapat dimuat</strong><p>Grafik tetap tersedia. Segarkan untuk mencoba lagi.</p><button className="simRetryMini" onClick={()=>setReload(x=>x+1)}>Coba lagi</button></div>:
          loggedIn&&hasActions?<div className="simTaskList">
            {(tasks?.unfinishedAttendance||[]).slice(0,2).map(x=><Link key={x.id} href={'/presensi/buat?event_id='+encodeURIComponent(x.id)}><span className="simTaskIcon simTaskAmber"><ClipboardCheck size={18}/></span><span><strong>Presensi belum lengkap</strong><small>{x.title}</small></span><ArrowRight size={16}/></Link>)}
            {(tasks?.draftJournals||[]).slice(0,2).map(x=><Link key={x.id} href={'/jurnal/buat?journal_id='+encodeURIComponent(x.id)}><span className="simTaskIcon"><BookOpen size={18}/></span><span><strong>Jurnal belum diselesaikan</strong><small>{x.title}</small></span><ArrowRight size={16}/></Link>)}
            {(tasks?.overdueDecisions||[]).slice(0,2).map(x=><Link key={x.id} href={'/jurnal/buat?journal_id='+encodeURIComponent(x.journal_id||'')}><span className="simTaskIcon simTaskRed"><AlertCircle size={18}/></span><span><strong>Tindak lanjut terlambat</strong><small>{x.title}</small></span><ArrowRight size={16}/></Link>)}
            {checklist>0&&<Link href="/kelengkapan"><span className="simTaskIcon simTaskAmber"><BarChart3 size={18}/></span><span><strong>{number.format(checklist)} item perlu diperiksa</strong><small>Lihat kelengkapan data organisasi</small></span><ArrowRight size={16}/></Link>}
          </div>:<div className="simSuccessEmpty"><CheckCircle2 size={24}/><strong>{loggedIn?'Tidak ada tindak lanjut mendesak':'Ringkasan hanya-baca'}</strong><p>{loggedIn?'Tidak ditemukan pekerjaan tertunda pada cakupan ini.':'Masuk untuk melihat pekerjaan internal.'}</p></div>}
        </ChartCard>
        <ChartCard title="Kegiatan Hari Ini" subtitle={'Jurnal selesai: '+number.format(data.journals)+' · '+period} action={<Link href="/agenda" className="simTextLink">Agenda <ArrowRight size={15}/></Link>}>
          {loggedIn&&tasksLoading?<div className="simSpecialEmpty"><RefreshCw className="simSpin" size={21}/><p>Memuat agenda hari ini…</p></div>:loggedIn&&tasksError?<div className="simSpecialEmpty"><AlertCircle size={21}/><p>Agenda hari ini belum bisa dimuat. Grafik lainnya tetap tersedia.</p></div>:tasks?.todayEvents?.length?<div className="simTaskList">{tasks.todayEvents.slice(0,4).map(x=><Link key={x.id} href={'/agenda'}><span className="simTaskIcon"><CalendarDays size={18}/></span><span><strong>{x.title}</strong><small>Kegiatan hari ini</small></span><ChevronRight size={15}/></Link>)}</div>:<div className="simSpecialEmpty"><CalendarDays size={24}/><strong>Belum ada pertemuan hari ini</strong><p>Lihat kalender untuk jadwal kegiatan berikutnya.</p></div>}
        </ChartCard>
      </div>
      {!loggedIn&&<div className="simVisit"><span>Kunjungan publik (opsional)</span><input value={visitorName} onChange={e=>setVisitorName(e.target.value)} maxLength={80} placeholder="Nama pengunjung" aria-label="Nama pengunjung"/><button disabled={!visitorName.trim()} onClick={()=>void identify()}>Catat kunjungan</button>{visitMessage&&<small>{visitMessage}</small>}</div>}
    </>:!loading&&<div className="simOfflineState"><AlertCircle size={20}/><strong>Grafik belum bisa dimuat.</strong><p>Data dari database sedang tidak tersedia. Silakan coba lagi, data yang tersimpan tidak berubah.</p><button className="simRetryMini" onClick={()=>setReload(x=>x+1)}>Coba muat lagi</button></div>}
  </div>;
}
