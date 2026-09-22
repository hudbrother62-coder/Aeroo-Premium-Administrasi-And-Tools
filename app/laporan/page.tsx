'use client';

import { useState } from 'react';

export default function Page(){
  const now=new Date().toISOString().slice(0,10);
  const[from,setFrom]=useState(now);
  const[to,setTo]=useState(now);
  const[aud,setAud]=useState('');
  const[report,setReport]=useState<any>(null);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');

  const qs=()=>`from=${from}&to=${to}${aud?'&audience='+aud:''}`;

  const preview=async()=>{
    setLoading(true);setError('');
    try{
      const r=await fetch(`/api/reports?${qs()}`);
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||'Gagal membuat laporan');
      setReport(j);
    }catch(e:unknown){
      setError(e instanceof Error?e.message:'Gagal membuat laporan');
    }finally{setLoading(false)}
  };

  const exp=(format:string)=>{window.location.href=`/api/reports/export?${qs()}&format=${format}`};

  return <>
    <div className="pageHeader">
      <div><div className="eyebrow">Analisis & Dokumen</div><h1>Laporan</h1><p>Buat rekap presensi dari satu hari sampai lintas bulan. Preview dan file ekspor menggunakan dataset yang sama.</p></div>
    </div>

    <div className="two">
      <section className="card">
        <div className="sectionTitle"><div><h2>Atur laporan</h2><p>Pilih periode dan kategori yang ingin direkap.</p></div></div>
        <div className="formGrid">
          <label>Tanggal mulai<input type="date" className="input" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label>
          <label>Tanggal akhir<input type="date" className="input" value={to} min={from} onChange={e=>setTo(e.target.value)}/></label>
          <label>Kategori<select className="select" value={aud} onChange={e=>setAud(e.target.value)}>
            <option value="">Semua kategori</option><option value="KELOMPOK">Kelompok</option><option value="MUDA_MUDI">Muda-Mudi</option><option value="CABERAWIT">Caberawit</option><option value="IBU_IBU">Ibu-Ibu</option><option value="PENGURUS">Pengurus</option>
          </select></label>
        </div>
        {error&&<div className="notice error" role="alert" style={{marginTop:14}}>{error}</div>}
        <button className="btn" style={{marginTop:18,width:'100%'}} disabled={loading||from>to} onClick={()=>void preview()}>{loading?'Menyiapkan preview…':'Tampilkan Preview'}</button>
      </section>

      <section className="card">
        <div className="sectionTitle"><div><h2>Ekspor dokumen</h2><p>Pilih format sesuai kebutuhan administrasi.</p></div></div>
        <div className="list">
          <button className="quickAction" onClick={()=>exp('xlsx')} style={{width:'100%',cursor:'pointer'}}>
            <span className="quickIcon">X</span><div style={{textAlign:'left'}}><strong>Excel (.xlsx)</strong><small>Cocok untuk olah data dan arsip</small></div>
          </button>
          <button className="quickAction" onClick={()=>exp('docx')} style={{width:'100%',cursor:'pointer'}}>
            <span className="quickIcon">W</span><div style={{textAlign:'left'}}><strong>Word (.docx)</strong><small>Cocok untuk dokumen yang akan diedit</small></div>
          </button>
          <button className="quickAction" onClick={()=>exp('pdf')} style={{width:'100%',cursor:'pointer'}}>
            <span className="quickIcon">P</span><div style={{textAlign:'left'}}><strong>PDF (.pdf)</strong><small>Cocok untuk cetak dan dibagikan</small></div>
          </button>
        </div>
      </section>
    </div>

    {report&&<section className="card reportPreview section">
      <div className="reportHeader">
        <div className="brandWord">AEROO <span>PREMIUM</span> ADMINISTRASI</div>
        <h2>Laporan Rekap Presensi</h2>
        <div className="itemMeta">{report.period.from} — {report.period.to}</div>
      </div>
      <div className="grid section">
        {[['Pertemuan',report.summary.meetings,'P'],['Hadir',report.summary.H,'H'],['Izin',report.summary.I,'I'],['Alfa',report.summary.A,'A']].map(([k,v,i])=><div className="statCard" style={{padding:14}} key={String(k)}>
          <div className="statTop"><span className="muted" style={{fontSize:11,fontWeight:750}}>{k}</span><span className="statIcon">{i}</span></div>
          <strong>{v}</strong>
        </div>)}
      </div>
      <div className="notice section">Preview ini menggunakan sumber data yang sama dengan file Excel, Word, dan PDF untuk menjaga konsistensi angka.</div>
    </section>}
  </>;
}
