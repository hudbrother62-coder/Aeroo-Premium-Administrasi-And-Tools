/**
 * Pure report aggregation. Counting attendance records (not unique people)
 * makes each gender subtotal add up to the original event totals.
 */
export type ReportGender='L'|'P'|'UNKNOWN';
export type ReportRecord={
  member_id:string|null;participant_key:string|null;status:string|null;
};
export type ReportEvent<T extends ReportRecord=ReportRecord>={
  id:string;event_date:string;title:string;audience:string;attendance_records:T[]|null;
};
export type GenderCounts={H:number;I:number;A:number;pending:number;total:number;percentage:number|null};
export type GenderBreakdown={gender:ReportGender;label:string;counts:GenderCounts};
export type GenderMeeting={id:string;date:string;title:string;groups:GenderBreakdown[]};

const genderNames:Record<ReportGender,string>={L:'Laki-laki',P:'Perempuan',UNKNOWN:'Belum tercatat'};
const genders:ReportGender[]=['L','P','UNKNOWN'];
function newCounts():GenderCounts{return {H:0,I:0,A:0,pending:0,total:0,percentage:null};}
function countOne(counts:GenderCounts,status:string|null){
  if(status==='H'||status==='I'||status==='A')counts[status]++;
  else counts.pending++;
  counts.total++;
}
function finish(counts:GenderCounts):GenderCounts{
  const filled=counts.H+counts.I+counts.A;
  counts.percentage=filled>0?Math.round(counts.H/filled*1000)/10:null;
  return counts;
}
export function reportGender(raw:unknown):ReportGender{
  const gender=String(raw??'').toUpperCase().trim().replace(/[\s_-]/g,'');
  if(['L','LK','M','MALE','PRIA','LAKILAKI'].includes(gender))return 'L';
  if(['P','PR','F','FEMALE','WANITA','PEREMPUAN'].includes(gender))return 'P';
  return 'UNKNOWN';
}
export function genderForRecord(record:ReportRecord,genderMap:ReadonlyMap<string,string>):ReportGender{
  return reportGender(
    (record.member_id&&genderMap.get(record.member_id))||
    (record.participant_key&&genderMap.get(record.participant_key))||null
  );
}
function breakdown(counts:Record<ReportGender,GenderCounts>):GenderBreakdown[]{
  return genders.map(gender=>({gender,label:genderNames[gender],counts:finish(counts[gender])}));
}
function bucket():Record<ReportGender,GenderCounts>{
  return {L:newCounts(),P:newCounts(),UNKNOWN:newCounts()};
}
export function kelompokGenderRecap<T extends ReportRecord>(
  events:ReportEvent<T>[],genderMap:ReadonlyMap<string,string>
):{overall:GenderBreakdown[];meetings:GenderMeeting[];total:GenderCounts}|null{
  const kelompok=events.filter(event=>event.audience==='KELOMPOK');
  if(!kelompok.length)return null;
  const summary=bucket();
  const meetings=kelompok.map(event=>{
    const groups=bucket();
    for(const record of event.attendance_records||[]){
      const gender=genderForRecord(record,genderMap);
      countOne(groups[gender],record.status);
      countOne(summary[gender],record.status);
    }
    return {id:event.id,date:event.event_date,title:event.title,groups:breakdown(groups)};
  });
  const total=newCounts();
  for(const group of breakdown(summary)){
    total.H+=group.counts.H;
    total.I+=group.counts.I;
    total.A+=group.counts.A;
    total.pending+=group.counts.pending;
    total.total+=group.counts.total;
  }
  return {overall:breakdown(summary),meetings,total:finish(total)};
}
