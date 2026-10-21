export type JournalForSeparation={journal_kind?:string|null;title?:string|null;activity_types?:{name?:string|null}|null;assessment?:{meeting_minutes?:boolean|null}|null};
export function isNotulensi(journal:JournalForSeparation):boolean{
 if(journal.assessment?.meeting_minutes===true)return true;
 if(journal.assessment?.meeting_minutes===false)return false;
 if(journal.journal_kind==='PENGURUS')return true;
 return /musyawarah|rapat|notulen/i.test([journal.title,journal.activity_types?.name].filter(Boolean).join(' '));
}

/** Category of the meeting, independent of journal audience and permission. */
export const meetingTypes=['Kelompok','5 Unsur','Dewan Guru'] as const;
export type MeetingType=typeof meetingTypes[number];
export function normalizeMeetingType(value?:string|null,journalKind?:string|null):MeetingType{
  const name=(value||'').toLowerCase().replace(/[_-]/g,' ').trim();
  if(/^(?:5|lima)\s*unsur$/.test(name))return '5 Unsur';
  if(/^(?:pengajar|dewan\s+guru|guru)$/.test(name))return 'Dewan Guru';
  if(!name&&journalKind?.startsWith('CABERAWIT'))return 'Dewan Guru';
  return 'Kelompok';
}
