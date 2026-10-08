export function studyDuration(start:string,end:string){
 const time=(s:string)=>{if(!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(s))throw Error('Waktu tidak valid.');return Number(s.slice(0,2))*60+Number(s.slice(3,5))};
 let n=time(end)-time(start);if(n<0)n+=1440;if(n===0)throw Error('Durasi pengkajian tidak valid.');return n;
}
export type StudyRow={state?:string;started_at?:string;ended_at?:string;assessment?:{presenter?:string;presenter_id?:string;materials?:Array<{status?:string}>}};
export function studyRecap(rows:StudyRow[]){const done=rows.filter(x=>x.state==='COMPLETED');let minutes=0,completed=0,unfinished=0;const presenters=new Set<string>();for(const r of done){try{minutes+=studyDuration(r.started_at||'',r.ended_at||'')}catch{}const p=r.assessment?.presenter_id||r.assessment?.presenter?.trim().toLowerCase();if(p)presenters.add(p);for(const m of r.assessment?.materials||[]){if(m.status==='TUNTAS')completed++;else unfinished++}}return {sessions:done.length,minutes,presenters:presenters.size,completed,unfinished}}
export function noteInput(input:any){
 if(!input||typeof input!=='object')throw Error('Catatan tidak valid.');
 const title=String(input.title??'').trim(),content=String(input.content??'');
 if(title.length>200||content.length>100000)throw Error('Catatan terlalu panjang.');
 const status=input.status??'ACTIVE';if(!['ACTIVE','ARCHIVED','DELETED'].includes(status))throw Error('Status tidak valid.');
 const context_type=String(input.context_type??'PERSONAL');if(!['PERSONAL','MEMBER','MEETING','CLASS','PROGRAM','GENERAL'].includes(context_type))throw Error('Jenis catatan tidak valid.');
 const visibility=String(input.visibility??'PRIVATE');if(!['PRIVATE','ROLE','ACCESS'].includes(visibility))throw Error('Visibilitas catatan tidak valid.');
 const revision=input.revision??0;if(!Number.isInteger(revision)||revision<0)throw Error('Revisi tidak valid.');
 const id=(v:any)=>v==null||String(v).trim()===''?null:String(v);
 return {title:title||'Tanpa judul',content,status,is_pinned:input.is_pinned===true,revision,context_type,visibility,
  audience:id(input.audience),class_id:id(input.class_id),member_id:id(input.member_id),attendance_event_id:id(input.attendance_event_id),agenda_id:id(input.agenda_id),journal_id:id(input.journal_id)};
}
export function reportRows(d:any){
  const H=Number(d.attendance?.H??0),I=Number(d.attendance?.I??0),A=Number(d.attendance?.A??0);
  const percentage=H+I+A?Math.round(H/(H+I+A)*1000)/10:'Belum diisi';
  return {
    summary:[
      {Indikator:'Bulan acuan',Jumlah:d.month??'-'},
      {Indikator:'Rentang (bulan)',Jumlah:d.span??1},
      {Indikator:'Anggota aktif saat laporan dibuat',Jumlah:d.counts?.total??0},
      {Indikator:'Caberawit aktif',Jumlah:d.counts?.caberawit??0},
      {Indikator:'Muda-Mudi aktif',Jumlah:d.counts?.muda_mudi??0},
      {Indikator:'Ibu-Ibu aktif',Jumlah:d.counts?.ibu_ibu??0},
      {Indikator:'Pengurus aktif',Jumlah:d.counts?.pengurus??0},
      {Indikator:'Pertemuan',Jumlah:d.attendance?.meetings??0},
      {Indikator:'Hadir',Jumlah:H},
      {Indikator:'Izin',Jumlah:I},
      {Indikator:'Alfa',Jumlah:A},
      {Indikator:'Belum absen',Jumlah:d.attendance?.pending??0},
      {Indikator:'Kehadiran dari catatan terisi (%)',Jumlah:percentage},
      {Indikator:'Jurnal selesai',Jumlah:d.journals??0},
      {Indikator:'Metode perhitungan',Jumlah:'H / (H + I + A); catatan kosong tidak dihitung sebagai Alfa'},
    ],
    individuals:(d.individuals||[]).map((p:any)=>({
      Nama:p.name,Kelas:p.class_name||'',Jenjang:p.level_name||'',Hadir:p.H,Izin:p.I,Alfa:p.A,
      'Belum absen':p.pending??0,'Hadir (%)':p.percentage??'Belum diisi',Jurnal:p.journals??0
    }))
  };
}
