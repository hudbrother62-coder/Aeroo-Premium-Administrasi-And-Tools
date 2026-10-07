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
 const status=String(input.status??'ACTIVE'),visibility=String(input.visibility??'PRIVATE'),context_type=String(input.context_type??'PERSONAL');
 if(!['ACTIVE','ARCHIVED','DELETED'].includes(status))throw Error('Status tidak valid.');
 if(!['PRIVATE','ACCESS'].includes(visibility))throw Error('Visibilitas catatan tidak valid.');
 if(!['PERSONAL','MEMBER','EVENT','AGENDA','CLASS','AUDIENCE','JOURNAL','ENTITY'].includes(context_type))throw Error('Jenis konteks catatan tidak valid.');
 const revision=input.revision??0;if(!Number.isInteger(revision)||revision<0)throw Error('Revisi tidak valid.');
 const optional=(v:any)=>v===null||v===undefined||v===''?null:String(v);
 const context_label=optional(input.context_label);if(context_label&&context_label.length>300)throw Error('Label konteks terlalu panjang.');
 const entity_type=optional(input.entity_type);if(entity_type&&entity_type.length>100)throw Error('Jenis unsur terlalu panjang.');
 return {
  title:title||'Tanpa judul',content,status,visibility,context_type,is_pinned:input.is_pinned===true,revision,
  audience:optional(input.audience),class_id:optional(input.class_id),member_id:optional(input.member_id),
  agenda_id:optional(input.agenda_id),event_id:optional(input.event_id),journal_id:optional(input.journal_id),
  entity_type,entity_id:optional(input.entity_id),context_label
 };
}
export function reportRows(d:any){return {summary:[{Indikator:'Anggota',Jumlah:d.counts.total},{Indikator:'Pertemuan',Jumlah:d.attendance.meetings??0},{Indikator:'Hadir',Jumlah:d.attendance.H},{Indikator:'Izin',Jumlah:d.attendance.I},{Indikator:'Alfa',Jumlah:d.attendance.A},{Indikator:'Belum absen',Jumlah:d.attendance.pending??0},{Indikator:'Jurnal selesai',Jumlah:d.journals}],individuals:(d.individuals||[]).map((p:any)=>({Nama:p.name,Kelas:p.class_name||'',Jenjang:p.level_name||'',Hadir:p.H,Izin:p.I,Alfa:p.A,'Belum absen':p.pending??0,'Hadir (%)':p.percentage??'Belum diisi',Jurnal:p.journals??0}))}}
