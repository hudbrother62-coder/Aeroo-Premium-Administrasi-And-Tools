export const slugByAudience:Record<string,string>={KELOMPOK:'kelompok',CABERAWIT:'caberawit',MUDA_MUDI:'muda-mudi',IBU_IBU:'ibu-ibu',PENGURUS:'pengurus'};
export function jakartaDate(value:Date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(value)}
export function validDate(s:unknown):boolean{return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s}
export function summarizeProgress(targetIds:string[],rows:Array<{target_id:string|null;progress_value:number|null;created_at?:string;journal_date?:string;journals?:{journal_date?:string}|{journal_date?:string}[]}>){
 const assigned=new Set(targetIds),latest=new Map<string,number>(),seen=new Set<string>();
 for(const row of latestProgressRows(rows)){if(!row.target_id||!assigned.has(row.target_id)||seen.has(row.target_id))continue;seen.add(row.target_id);if(row.progress_value===null)continue;const n=Number(row.progress_value);if(Number.isFinite(n))latest.set(row.target_id,Math.max(0,Math.min(100,n)))}
 const values=[...latest.values()];return {assigned:assigned.size,assessed:values.length,percentage:values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*10)/10:null};
}
export function summarizeAttendance(rows:Array<{status:string|null}>){const H=rows.filter(r=>r.status==='H').length,I=rows.filter(r=>r.status==='I').length,A=rows.filter(r=>r.status==='A').length;return {H,I,A,pending:rows.length-H-I-A,total:H+I+A,percentage:H+I+A?Math.round(H/(H+I+A)*1000)/10:null}}
export function recurrenceDates(start:string,frequency:string,until:string){
 if(!validDate(start)||!validDate(until)||until<start)throw new Error('Periode agenda tidak valid.');
 const dates:string[]=[];const first=new Date(start+'T12:00:00Z');let cursor=new Date(first);let i=0;
 while(cursor.toISOString().slice(0,10)<=until){if(dates.length>=366)throw new Error('Maksimal 366 pertemuan dalam satu rangkaian.');dates.push(cursor.toISOString().slice(0,10));if(frequency==='once')break;i++;if(frequency==='monthly'){const y=first.getUTCFullYear(),m=first.getUTCMonth()+i;cursor=new Date(Date.UTC(y,m,Math.min(first.getUTCDate(),new Date(Date.UTC(y,m+1,0)).getUTCDate()),12))}else if(frequency==='weekly'||frequency==='daily'){cursor=new Date(first);cursor.setUTCDate(first.getUTCDate()+i*(frequency==='weekly'?7:1))}else throw new Error('Pengulangan tidak valid.');}return dates;
}

export function latestProgressRows<T extends {created_at?:string;journal_date?:string;journals?:{journal_date?:string}|{journal_date?:string}[]}>(rows:T[]):T[]{const date=(r:T)=>r.journal_date||(Array.isArray(r.journals)?r.journals[0]?.journal_date:r.journals?.journal_date)||'';return [...rows].sort((a,b)=>date(b).localeCompare(date(a))||(b.created_at||'').localeCompare(a.created_at||''))}

export function effectiveMembership(m:any,date=jakartaDate()){return (!m.valid_from||m.valid_from<=date)&&(!m.valid_to||m.valid_to>=date)&&(!m.ended_on||m.ended_on>date)&&(m.active!==false||!!m.ended_on)}
