'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {useParams} from 'next/navigation';

type Data=any;
const tabNames=['Ringkasan','Keanggotaan','Presensi','Jurnal','Progres','Dapukan','Riwayat'] as const;
export default function PersonProfile(){
  const params=useParams<{id:string}>();const id=params.id;
  const[data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[tab,setTab]=useState<(typeof tabNames)[number]>('Ringkasan');
  useEffect(()=>{let live=true;setLoading(true);fetch('/api/members/'+id+'/profile',{cache:'no-store'}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error);if(live)setData(j)}).catch(e=>live&&setError(e.message)).finally(()=>live&&setLoading(false));return()=>{live=false}},[id]);
  const memberships=useMemo(()=>data?.person?.member_memberships||[],[data]);
  const active=memberships.filter((m:any)=>m.active);
  const history=memberships.filter((m:any)=>!m.active||m.valid_to||m.ended_on);
  if(loading)return <div className="card"><div className="skeleton" style={{height:160}}/></div>;
  if(error||!data)return <div className="notice error">{error||'Data tidak ditemukan.'}</div>;
  const p=data.person;
  return <><div className="pageHeader"><div><h1>{p.name}</h1><div className="itemMeta">{active.map((m:any)=>m.categories?.name).filter(Boolean).join(' · ')||'Belum ditempatkan'}</div></div><Link className="btn" href={'/database/tambah?id='+id}>Edit</Link></div>
    <div className="tabBar personTabs">{tabNames.map(t=><button key={t} className={tab===t?'tab active':'tab'} onClick={()=>setTab(t)}>{t}</button>)}</div>
    {tab==='Ringkasan'&&<><div className="metricGrid section"><div className="metricCard"><span>Kehadiran</span><strong>{data.attendance_summary.percentage===null?'—':data.attendance_summary.percentage+'%'}</strong></div><div className="metricCard"><span>Jurnal Individu</span><strong>{data.journals.length}</strong></div><div className="metricCard"><span>Progres</span><strong>{data.progress.length}</strong></div><div className="metricCard"><span>Dapukan</span><strong>{data.positions.filter((x:any)=>x.active).length}</strong></div></div>
      <div className="dashboardGrid section"><section className="card"><h2>Identitas</h2><div className="profileFacts section">{[['Jenis Kelamin',p.gender],['Tanggal Lahir',p.birth_date],['Nomor HP',p.phone],['Alamat',p.address],['Wali',p.guardian_name],['HP Wali',p.guardian_phone]].map(([k,v])=><div key={k}><span>{k}</span><strong>{v||'—'}</strong></div>)}</div></section><section className="card"><h2>Keanggotaan Aktif</h2>{active.map((m:any)=><div className="categoryRow" key={m.id}><span><strong>{m.categories?.name}</strong><small className="itemMeta">{m.levels?.name||''}{m.classes?.name?' · '+m.classes.name:''}</small></span></div>)}{!active.length&&<div className="emptyState">Belum ada keanggotaan aktif.</div>}</section></div></>}
    {tab==='Keanggotaan'&&<section className="card section"><h2>Keanggotaan</h2>{memberships.map((m:any)=><div className="categoryRow" key={m.id}><span><strong>{m.categories?.name}</strong><small className="itemMeta">{m.levels?.name||''}{m.classes?.name?' · '+m.classes.name:''} · {m.valid_from||'—'} – {m.valid_to||m.ended_on||'Sekarang'}</small></span><span className="badge">{m.active?'Aktif':'Riwayat'}</span></div>)}</section>}
    {tab==='Presensi'&&<section className="card section"><div className="attendanceSummary"><div><span>H</span><strong>{data.attendance_summary.H}</strong></div><div><span>I</span><strong>{data.attendance_summary.I}</strong></div><div><span>A</span><strong>{data.attendance_summary.A}</strong></div></div><div className="list section">{data.attendance.map((r:any)=><div className="item row between" key={r.id}><div><strong>{r.attendance_events?.title||'Kegiatan'}</strong><div className="itemMeta">{r.attendance_events?.event_date||''}</div></div><span className="badge">{r.status||'Belum'}</span></div>)}{!data.attendance.length&&<div className="emptyState">Belum ada presensi.</div>}</div></section>}
    {tab==='Jurnal'&&<section className="card section"><div className="list">{data.journals.map((j:any)=><Link className="item" key={j.id} href={'/jurnal/buat?journal_id='+j.id}><strong>{j.title}</strong><div className="itemMeta">{j.journal_date} · {j.journal_kind}</div></Link>)}{!data.journals.length&&<div className="emptyState">Belum ada jurnal individu.</div>}</div></section>}
    {tab==='Progres'&&<section className="card section"><div className="list">{data.progress.map((x:any)=><div className="item" key={x.id}><div className="row between"><strong>{x.learning_targets?.title||'Target'}</strong><span className="badge">{x.progress_value??'—'}{x.progress_value!=null?'%':''}</span></div><div className="itemMeta">{x.progress_note||x.follow_up||''}</div></div>)}{!data.progress.length&&<div className="emptyState">Belum ada progres.</div>}</div></section>}
    {tab==='Dapukan'&&<section className="card section">{data.positions.map((x:any)=><div className="categoryRow" key={x.id}><span><strong>{x.title}</strong><small className="itemMeta">{x.section||'Pengurus'} · Mulai {x.valid_from}</small></span><span className="badge">{x.active?'Aktif':'Selesai'}</span></div>)}{!data.positions.length&&<div className="emptyState">Belum ada dapukan.</div>}</section>}
    {tab==='Riwayat'&&<section className="card section">{history.map((m:any)=><div className="timelineItem" key={m.id}><strong>{m.categories?.name}</strong><span>{m.valid_from||'—'} – {m.valid_to||m.ended_on||'Sekarang'}</span><small>{m.levels?.name||''}{m.classes?.name?' · '+m.classes.name:''}</small></div>)}{!history.length&&<div className="emptyState">Belum ada riwayat perubahan.</div>}</section>}
  </>;
}
