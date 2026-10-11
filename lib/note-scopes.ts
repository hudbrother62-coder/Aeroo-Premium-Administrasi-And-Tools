export type NoteScope='PERSONAL'|'ROLE'|'MAIN';
export type NoteStatus='ACTIVE'|'ARCHIVED'|'DELETED';

export function parseNoteScope(value:unknown):NoteScope {
 if(value==='PERSONAL'||value==='ROLE'||value==='MAIN')return value;
 throw Error('Jenis catatan tidak valid.');
}
export function parseNoteStatus(value:unknown):NoteStatus {
 if(value==='ACTIVE'||value==='ARCHIVED'||value==='DELETED')return value;
 throw Error('Status catatan tidak valid.');
}
export function parseNoteBody(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Catatan tidak valid.');
 const body=value as Record<string,unknown>;
 const title=String(body.title??'').trim()||'Tanpa judul';
 const content=String(body.content??'');
 if(title.length>200||content.length>100000)throw Error('Catatan terlalu panjang.');
 const revision=body.revision??0;
 if(!Number.isInteger(revision)||Number(revision)<0)throw Error('Revisi tidak valid.');
 return {
  scope:parseNoteScope(body.scope),
  revision:Number(revision),
  body:{title,content,status:parseNoteStatus(body.status??'ACTIVE'),is_pinned:body.is_pinned===true}
 };
}
