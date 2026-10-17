export type JournalForSeparation={journal_kind?:string|null;title?:string|null;activity_types?:{name?:string|null}|null;assessment?:{meeting_minutes?:boolean|null}|null};
export function isNotulensi(journal:JournalForSeparation):boolean{
 if(journal.assessment?.meeting_minutes===true)return true;
 if(journal.assessment?.meeting_minutes===false)return false;
 if(journal.journal_kind==='PENGURUS')return true;
 return /musyawarah|rapat|notulen/i.test([journal.title,journal.activity_types?.name].filter(Boolean).join(' '));
}
