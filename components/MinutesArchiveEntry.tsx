'use client';
import {CalendarDays,ExternalLink} from 'lucide-react';
import type {MeetingType} from '@/lib/journal-kind';
export type ArchivedLine={text:string;depth:number;list:boolean};
export type ArchivedSection={label:string;lines:ArchivedLine[]};
export type ArchivedMinute={
  id:string;title:string;meeting_type:MeetingType;meeting_month:string;meeting_date:string|null;
  date_status:'EXACT'|'MONTH_ONLY'|'CONFLICT';requires_review:boolean;
  source_heading:string;source_tab_title:string;source_url:string;source_text:string;
  sections:ArchivedSection[];source_blocks:Array<{i:number;text:string;depth:number;list:boolean}>;
};
const monthLabel=(month:string)=>new Date(month+'-01T12:00:00').toLocaleDateString('id-ID',{month:'long',year:'numeric'});
const dateLabel=(day:string)=>new Date(day+'T12:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

function SectionContent({section}:{section:ArchivedSection}){
 let number=0;
 const items=section.lines.map((line,i)=>{
  const depth=Math.min(Math.max(Number(line.depth)||0,0),2);
  const hasOriginalPrefix=/^\s*(?:\d+[.)]|[A-Za-z][.)])\s*/.test(line.text);
  const marker=hasOriginalPrefix?'':line.list?(depth===0?String(++number)+'.':depth===1?'•':'–'):'';
  return {...line,depth,marker,key:i};
 });
 return <section className="minutesArchiveSection">
   <h3>{section.label}</h3>
   <div className="minutesArchiveLines">
     {items.map(line=><div className={'minutesArchiveLine minutesArchiveDepth'+line.depth} key={line.key}>
       {line.marker&&<span className="minutesArchiveMarker" aria-hidden="true">{line.marker}</span>}
       <span className="minutesArchiveWords">{line.text}</span>
     </div>)}
   </div>
 </section>;
}
function Inner({item}:{item:ArchivedMinute}){
 return <div className="minutesArchiveContent">
   {item.date_status==='CONFLICT'&&<div className="minutesArchiveWarning" role="note">
     <strong>Perlu verifikasi bulan / tanggal.</strong> Tab sumber berjudul “{item.source_tab_title}”,
     tetapi judul isinya “{item.source_heading}”. Arsip dikelompokkan menurut nama tab tanpa menetapkan tanggal pertemuan.
   </div>}
   <div className="minutesArchiveSections">
     {item.sections.map((section,i)=><SectionContent key={section.label+'-'+i} section={section}/>)}
   </div>
   <details className="minutesOriginal">
     <summary>Lihat teks sumber asli</summary>
     <div className="minutesDocumentText">{item.source_text}</div>
   </details>
   <div className="minutesEntryActions">
     <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="minutesSourceLink">
       <ExternalLink size={15}/> Lihat Google Docs asli
     </a>
   </div>
 </div>;
}
function Header({item}:{item:ArchivedMinute}){
 return <div className="minutesEntryHeading">
   <div className="minutesEntryMeta">
     <CalendarDays size={16}/>
     <span>{item.meeting_date?dateLabel(item.meeting_date):monthLabel(item.meeting_month)}</span>
     {!item.meeting_date&&<span className="minutesUnspecifiedDate">Tanggal pertemuan belum tercantum</span>}
   </div>
   <h2>{item.title}</h2>
   <div className="minutesEntryBadges">
     <span>{item.meeting_type}</span><span>Arsip dokumen</span>
     {item.requires_review&&<span className="minutesStatusDraft">Perlu verifikasi</span>}
   </div>
 </div>;
}
export default function MinutesArchiveEntry({item,collapsed}:{item:ArchivedMinute;collapsed:boolean}){
 if(collapsed)return <details className="card minutesAccordion minutesArchived" key={item.id}>
   <summary><Header item={item}/><span className="minutesExpandLabel">Buka isi</span></summary>
   <Inner item={item}/>
 </details>;
 return <article className="card minutesFullCard minutesArchived">
   <Header item={item}/><Inner item={item}/>
 </article>;
}
