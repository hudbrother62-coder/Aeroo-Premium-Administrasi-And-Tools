'use client';

import {useEffect,useState} from 'react';
import type {Audience} from '@/lib/access';

type Status='H'|'I'|'A'|null;
type AttendanceRecord={id:string;participant_key:string;member_name_snapshot:string;class_name_snapshot?:string|null;status:Status;notes:string|null;revision:number;attendance_changes?:Array<{id:string;changed_at:string;old_status:Status;new_status:Status;actor_name?:string}>};
type Meeting={id:string;title:string;event_date:string;audience:string;class_id?:string|null;state?:string;teacher_name?:string|null;classes?:{name:string}|null;attendance_records?:AttendanceRecord[]};
type User={role:string;public?:boolean;write_scopes?:Audience[];permissions?:Record<string,boolean>;class_scope?:{class_id:string;can_write:boolean}|null};
type Draft={status:Status;notes:string};
const labels:Record<string,string>={KELOMPOK:'Kelompok',MUDA_MUDI:'Muda-Mudi',CABERAWIT:'Caberawit',IBU_IBU:'Ibu-Ibu',PENGURUS:'Pengurus'};
const dateLabel=(v:string)=>new Date(v+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
const statusLabel=(v:Status)=>v==='H'?'Hadir':v==='I'?'Izin':v==='A'?'Alfa':'Belum diisi';
function summarize(rows:AttendanceRecord[]=[]){return {H:rows.filter(r=>r.status==='H').length,I:rows.filter(r=>r.status==='I').length,A:rows.filter(r=>r.status==='A').length,pending:rows.filter(r=>r.status==null).length};}

export default function AttendanceHistory({month,audience,classId,onChanged}:{month:string;audience:string;classId:string;onChanged:()=>void}){
  const[events,setEvents]=useState<Meeting[]>([]);
  const[user,setUser]=useState<User|null>(null);
  const[search,setSearch]=useState('');
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  const[detail,setDetail]=useState<Meeting|null>(null);
  const[opening,setOpening]=useState(false);
  const[message,setMessage]=useState('');
  const[detailError,setDetailError]=useState('');
  const[drafts,setDrafts]=useState<Record<string,Draft>>({});
  const[saving,setSaving]=useState<string|null>(null);
  const[version,setVersion]=useState(0);

  useEffect(()=>{
    let active=true;
    const lastDay=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
    const query=new URLSearchParams({from:month+'-01',to:month+'-'+String(lastDay).padStart(2,'0')});
    if(audience)query.set('audience',audience);
    if(classId)query.set('class_id',classId);
    setLoading(true);setError('');
    Promise.all([fetch('/api/attendance?'+query,{cache:'no-store'}),fetch('/api/auth/me',{cache:'no-store'})]).then(async([r,u])=>{
      if(!r.ok||!u.ok)throw Error('Riwayat presensi belum dapat dimuat.');
      const [rows,me]=await Promise.all([r.json(),u.json()]);
      if(!Array.isArray(rows))throw Error('Format riwayat tidak sesuai.');
      if(active){setEvents(rows.filter((e:Meeting)=>e.state!=='CANCELLED'&&(e.attendance_records||[]).some(r=>['H','I','A'].includes(r.status||''))));setUser(me);}
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Gagal memuat riwayat.');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[month,audience,classId,version]);

  useEffect(()=>{setDetail(null);setMessage('');setDetailError('')},[month,audience,classId]);

  function canEdit(meeting:Meeting){
    if(!user||user.public||user.role==='VIEWER'||user.permissions?.['attendance.write']===false)return false;
    if(!(user.write_scopes??[]).includes(meeting.audience as Audience)||meeting.state==='CANCELLED')return false;
    if(user.role==='DEWAN_GURU'&&user.class_scope?.can_write&&meeting.audience==='CABERAWIT'&&meeting.class_id&&meeting.class_id!==user.class_scope.class_id)return false;
    return true;
  }

  async function openMeeting(meeting:Meeting){
    setOpening(true);setMessage('');setDetailError('');
    try{
      const response=await fetch('/api/attendance/'+meeting.id,{cache:'no-store'});
      const result=await response.json();
      if(!response.ok)throw Error(result.error||'Detail pertemuan tidak dapat dibuka.');
      setDetail({...meeting,...result});
      setDrafts(Object.fromEntries((result.attendance_records??[]).map((r:AttendanceRecord)=>[r.participant_key,{status:r.status??null,notes:r.notes??''}])));
    }catch(e){setDetailError(e instanceof Error?e.message:'Gagal membuka detail.');}
    finally{setOpening(false);}
  }

  async function saveRow(row:AttendanceRecord){
    if(!detail||!canEdit(detail)||saving)return;
    const draft=drafts[row.participant_key];
    if(!draft||draft.status===row.status&&draft.notes===(row.notes??''))return;
    setSaving(row.participant_key);setDetailError('');setMessage('');
    try{
      const response=await fetch('/api/attendance/'+detail.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({participant_key:row.participant_key,revision:row.revision,status:draft.status,notes:draft.notes})});
      const result=await response.json();
      if(response.status===409&&result.record){
        const server=result.record as AttendanceRecord;
        setDetail(v=>v?{...v,attendance_records:v.attendance_records?.map(r=>r.participant_key===row.participant_key?{...r,...server}:r)}:null);
        setDrafts(v=>({...v,[row.participant_key]:{status:server.status,notes:server.notes??''}}));
        throw Error('Data sudah diubah oleh petugas lain. Versi terbaru telah dimuat; silakan periksa kembali.');
      }
      if(!response.ok||!result.record)throw Error(result.error||'Koreksi gagal tersimpan.');
      const record=result.record as AttendanceRecord;
      setDetail(v=>v?{...v,attendance_records:v.attendance_records?.map(r=>r.participant_key===row.participant_key?{...r,...record}:r)}:null);
      setDrafts(v=>({...v,[row.participant_key]:{status:record.status,notes:record.notes??''}}));
      setMessage('Perubahan '+row.member_name_snapshot+' tersimpan. Rekap diperbarui.');
      setVersion(v=>v+1);onChanged();
    }catch(e){setDetailError(e instanceof Error?e.message:'Gagal menyimpan koreksi.');}
    finally{setSaving(null);}
  }

  const shown=events.filter(e=>[e.title,e.event_date,labels[e.audience]||e.audience,e.teacher_name,e.classes?.name].some(v=>String(v??'').toLowerCase().includes(search.toLowerCase())));
  return <>
    <section className="card section">
      <div className="cardHead"><div><h2>Riwayat Pertemuan</h2><p>Buka daftar peserta untuk melihat atau mengoreksi kehadiran. Perubahan otomatis masuk rekap.</p></div><span className="badge">{events.length} kegiatan</span></div>
      <input className="input" aria-label="Cari riwayat kegiatan" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama kegiatan, kelas, guru, atau tanggal (YYYY-MM-DD)…"/>
      {error&&<div className="notice error section">{error}<button className="smallAction" type="button" onClick={()=>setVersion(v=>v+1)}>Coba lagi</button></div>}
      {detailError&&!detail&&<div className="notice error section">{detailError}</div>}
      <div className="list section">
        {loading?<div className="skeleton" style={{height:68}}/>:shown.map(event=>{
          const counts=summarize(event.attendance_records);
          return <article className="item attendanceHistoryItem" key={event.id}>
            <div><strong className="itemTitle">{event.title}</strong><div className="itemMeta">{dateLabel(event.event_date)} · {labels[event.audience]||event.audience}{event.classes?.name?' · '+event.classes.name:''}{event.teacher_name?' · '+event.teacher_name:''}</div></div>
            <div className="attendanceHistoryActions"><span className="badge">{counts.H} H · {counts.I} I · {counts.A} A · {counts.pending} kosong</span><button type="button" className="btn ghost" disabled={opening} onClick={()=>void openMeeting(event)}>{canEdit(event)?'Lihat & Koreksi':'Lihat Detail'}</button></div>
          </article>;
        })}
        {!loading&&!shown.length&&<div className="emptyState">Tidak ada presensi pada periode dan filter ini.</div>}
      </div>
    </section>
    {detail&&<div className="dialogBackdrop"><section className="dialogCard attendanceHistoryDialog" role="dialog" aria-modal="true" aria-label={'Detail '+detail.title}>
      <div className="cardHead"><div><h2>{detail.title}</h2><p>{dateLabel(detail.event_date)} · {labels[detail.audience]||detail.audience}</p></div><button type="button" className="smallAction" disabled={!!saving} onClick={()=>{setDetail(null);setDetailError('');setMessage('')}}>Tutup ✕</button></div>
      <div className="notice">{canEdit(detail)?'Ubah status atau keterangan peserta lalu tekan Simpan. Semua koreksi dicatat dalam riwayat.':'Akses hanya-baca: akun ini tidak memiliki izin mengubah data pertemuan.'}</div>
      {message&&<div className="notice success" role="status">{message}</div>}
      {detailError&&<div className="notice error" role="alert">{detailError}</div>}
      <div className="list">
        {(detail.attendance_records??[]).map(row=>{
          const draft=drafts[row.participant_key]??{status:row.status,notes:row.notes??''};
          const changed=draft.status!==row.status||draft.notes!==(row.notes??'');
          return <div className="item" key={row.participant_key}>
            <div className="row between"><div><strong className="itemTitle">{row.member_name_snapshot||'Peserta'}</strong><div className="itemMeta">{row.class_name_snapshot||'Tanpa kelas'} · {statusLabel(row.status)}</div></div>{!canEdit(detail)&&<span className="badge">{statusLabel(row.status)}</span>}</div>
            {canEdit(detail)?<div className="attendanceCorrectionRow">
              <label>Status<select className="select" aria-label={'Status '+row.member_name_snapshot} disabled={!!saving} value={draft.status??''} onChange={e=>setDrafts(v=>({...v,[row.participant_key]:{...draft,status:e.target.value===''?null:e.target.value as Status}}))}><option value="">Belum diisi</option><option value="H">Hadir</option><option value="I">Izin</option><option value="A">Alfa</option></select></label>
              <label>Keterangan<input className="input" aria-label={'Keterangan '+row.member_name_snapshot} maxLength={2000} disabled={!!saving} value={draft.notes} placeholder="Opsional" onChange={e=>setDrafts(v=>({...v,[row.participant_key]:{...draft,notes:e.target.value}}))}/></label>
              <button className="btn" type="button" disabled={!changed||!!saving} onClick={()=>void saveRow(row)}>{saving===row.participant_key?'Menyimpan…':'Simpan'}</button>
            </div>:row.notes&&<div className="itemMeta">Keterangan: {row.notes}</div>}
            {!!row.attendance_changes?.length&&<details className="section"><summary className="itemMeta">Jejak koreksi ({row.attendance_changes.length})</summary>{row.attendance_changes.map(c=><p key={c.id} className="itemMeta">{new Date(c.changed_at).toLocaleString('id-ID')} · {statusLabel(c.old_status)} → {statusLabel(c.new_status)}</p>)}</details>}
          </div>;
        })}
        {!detail.attendance_records?.length&&<div className="emptyState">Daftar peserta masih kosong.</div>}
      </div>
    </section></div>}
  </>;
}
