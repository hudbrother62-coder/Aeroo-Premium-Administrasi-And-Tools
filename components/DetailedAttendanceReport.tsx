'use client';

import {useState} from 'react';
import {jakartaDate} from '@/lib/domain';

type EventRow={
  Tanggal:string;Kegiatan:string;Kategori:string;Hadir:number;Izin:number;Alfa:number;
  'Belum absen':number;'Total peserta':number;'Kehadiran (%)':string|number;
};
type Detail={Tanggal:string;Kegiatan:string;Kategori:string;Kelas:string;Peserta:string;Status:string};
type Report={events:EventRow[];details:Detail[];summary:{meetings:number;H:number;I:number;A:number;pending:number;total:number;percentage:number|null}};
const audiences=[['','Semua kategori'],['CABERAWIT','Caberawit'],['MUDA_MUDI','Muda-Mudi'],['IBU_IBU','Ibu-Ibu'],['KELOMPOK','Kelompok'],['PENGURUS','Pengurus']];
export default function DetailedAttendanceReport(){
  const today=jakartaDate();
  const [from,setFrom]=useState(today.slice(0,7)+'-01'),[to,setTo]=useState(today);
  const [audience,setAudience]=useState(''),[report,setReport]=useState<Report|null>(null);
  const [error,setError]=useState(''),[loading,setLoading]=useState(false),[search,setSearch]=useState('');
  const query=()=>new URLSearchParams({from,to,...(audience?{audience}:{})});
  async function load(){
    setLoading(true);setError('');setReport(null);
    try{
      const res=await fetch('/api/reports?'+query(),{cache:'no-store'});
      const body=await res.json();
      if(!res.ok)throw new Error(body.error||'Tidak dapat memuat laporan.');
      setReport(body);
    }catch(e){setError(e instanceof Error?e.message:'Gagal memuat laporan.')}finally{setLoading(false)}
  }
  const details=report?.details.filter(d=>(d.Peserta+' '+d.Kegiatan+' '+d.Kelas).toLowerCase().includes(search.toLowerCase()))||[];
  return <section className="card section">
    <h2>Laporan Presensi Terperinci</h2>
    <p className="itemMeta">Pratinjau web dan unduhan memakai satu sumber data. Rekap tidak menganggap catatan belum diisi sebagai Alfa.</p>
    <div className="formGrid section">
      <label>Mulai<input className="input" type="date" value={from} onChange={e=>{setFrom(e.target.value);setReport(null)}}/></label>
      <label>Sampai<input className="input" type="date" value={to} onChange={e=>{setTo(e.target.value);setReport(null)}}/></label>
      <label>Kategori<select className="select" value={audience} onChange={e=>{setAudience(e.target.value);setReport(null)}}>
        {audiences.map(([id,name])=><option key={id} value={id}>{name}</option>)}
      </select></label>
    </div>
    <div className="taskLinks section"><button className="btn" disabled={loading||!from||!to||from>to} onClick={()=>void load()}>{loading?'Memuat…':'Tampilkan laporan'}</button>
      {(['xlsx','docx','pdf'] as const).map(f=><a className="btn ghost" key={f} href={'/api/reports/export?'+query()+'&format='+f}>{f==='xlsx'?'Excel':f==='docx'?'Word':'PDF'}</a>)}
    </div>
    {error&&<div className="notice error section">{error}</div>}
    {report&&<div className="section">
      <div className="metricGrid">
        <div className="metricCard"><span>Kegiatan</span><strong>{report.summary.meetings}</strong></div>
        <div className="metricCard"><span>Hadir</span><strong>{report.summary.H}</strong></div>
        <div className="metricCard"><span>Izin</span><strong>{report.summary.I}</strong></div>
        <div className="metricCard"><span>Alfa</span><strong>{report.summary.A}</strong></div>
        <div className="metricCard"><span>Belum absen</span><strong>{report.summary.pending}</strong></div>
        <div className="metricCard"><span>Kehadiran</span><strong>{report.summary.percentage===null?'Belum diisi':report.summary.percentage+'%'}</strong></div>
      </div>
      <h3 className="section">Rincian per kegiatan</h3>
      <div className="tableWrap"><table className="table"><thead><tr><th>Tanggal</th><th>Kegiatan</th><th>Kategori</th><th>H</th><th>I</th><th>A</th><th>Belum</th><th>Total</th><th>Kehadiran</th></tr></thead>
        <tbody>{report.events.map((r,i)=><tr key={r.Tanggal+'-'+i}><td>{r.Tanggal}</td><td>{r.Kegiatan}</td><td>{r.Kategori}</td><td>{r.Hadir}</td><td>{r.Izin}</td><td>{r.Alfa}</td><td>{r['Belum absen']}</td><td>{r['Total peserta']}</td><td>{r['Kehadiran (%)']}{typeof r['Kehadiran (%)']==='number'?'%':''}</td></tr>)}
        {!report.events.length&&<tr><td colSpan={9}>Tidak ada kegiatan pada periode ini.</td></tr>}</tbody>
      </table></div>
      <h3 className="section">Detail individu</h3>
      <input className="input section" aria-label="Cari peserta atau kegiatan" placeholder="Cari nama, kegiatan, atau kelas…" value={search} onChange={e=>setSearch(e.target.value)}/>
      <p className="itemMeta">Menampilkan {Math.min(200,details.length)} dari {details.length} baris yang cocok. Unduhan Excel memuat seluruh baris.</p>
      <div className="tableWrap"><table className="table"><thead><tr><th>Tanggal</th><th>Kegiatan</th><th>Peserta</th><th>Kelas</th><th>Status</th></tr></thead>
        <tbody>{details.slice(0,200).map((r,i)=><tr key={i}><td>{r.Tanggal}</td><td>{r.Kegiatan}</td><td>{r.Peserta}</td><td>{r.Kelas}</td><td>{r.Status}</td></tr>)}
        {!details.length&&<tr><td colSpan={5}>Tidak ada detail individu.</td></tr>}</tbody></table></div>
    </div>}
  </section>;
}
