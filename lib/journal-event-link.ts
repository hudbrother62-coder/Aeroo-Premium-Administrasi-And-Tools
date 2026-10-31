/** Keep journal↔attendance matching consistent across all audience types. */
export type JournalLinkInput={
 journal_kind?:string|null;journal_date?:string|null;
 class_id?:string|null;agenda_id?:string|null;activity_type_id?:string|null;
};
export type JournalEventCandidate={
 id:string;event_date:string;audience:string;state?:string|null;
 class_id?:string|null;agenda_id?:string|null;activity_type_id?:string|null;
};
export function journalAudience(kind?:string|null):string|null {
 if(kind==='PENGKAJIAN'||kind==='KELOMPOK')return 'KELOMPOK';
 if(kind==='IBU_IBU'||kind==='PENGURUS')return kind;
 if(kind?.startsWith('CABERAWIT_'))return 'CABERAWIT';
 if(kind?.startsWith('MUDA_MUDI_'))return 'MUDA_MUDI';
 return null;
}
export function matchingJournalEvents(input:JournalLinkInput,events:JournalEventCandidate[]):JournalEventCandidate[]{
 const audience=journalAudience(input.journal_kind);
 if(!audience||!/^\d{4}-\d{2}-\d{2}$/.test(input.journal_date||''))return [];
 const agenda=input.agenda_id||null,activity=input.activity_type_id||null,categoryClass=input.class_id||null;
 // A blank activity/agenda is not sufficient evidence to associate two records.
 if(!agenda&&!activity)return [];
 return events.filter(e=>e.state!=='CANCELLED'&&e.event_date===input.journal_date&&e.audience===audience
   &&(e.class_id||null)===categoryClass
   &&(agenda?(e.agenda_id||null)===agenda:(e.agenda_id||null)===null&&(e.activity_type_id||null)===activity));
}
export function uniqueJournalEvent(input:JournalLinkInput,events:JournalEventCandidate[]):string|null{
 const matched=matchingJournalEvents(input,events);
 return matched.length===1?matched[0].id:null;
}
