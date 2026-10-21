
export type AttendanceBucket={month:string;H:number;I:number;A:number;pending:number;percentage:number|null};
export type RecapPerson={
 id:string;name:string;class_name:string;level_name?:string;
 H:number;I:number;A:number;pending:number;percentage:number|null;
 dates:{H:string[];I:string[];A:string[]};
 monthly:AttendanceBucket[];
};
export type RecapMeeting={id:string;title:string;date:string;audience:string;class_name:string;total:number;summary:{H:number;I:number;A:number;pending:number}};
export type MonthlyRecap={month:string;summary:{H:number;I:number;A:number;pending:number;meetings:number};individuals:Array<Omit<RecapPerson,'monthly'>>;meetings:RecapMeeting[]};
export type CombinedRecap=Omit<MonthlyRecap,'individuals'>&{individuals:RecapPerson[];trend:AttendanceBucket[]};
export function monthsEnding(month:string,span:1|3|6):string[]{
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Bulan tidak valid.');
 const year=Number(month.slice(0,4)),m=Number(month.slice(5,7))-1;
 return Array.from({length:span},(_,i)=>new Date(Date.UTC(year,m-(span-i-1),1)).toISOString().slice(0,7));
}
export function attendancePercentage(h:number,i:number,a:number):number|null{
 const total=h+i+a;return total>0?Math.round(h/total*1000)/10:null;
}
// Largest remainder in tenths: displayed H/I/A always sum to exactly 100.0%.
export function attendanceShares(h:number,i:number,a:number):[number,number,number]|null{
 const vals=[h,i,a];const total=vals.reduce((sum,n)=>sum+n,0);
 if(total<=0)return null;
 const exact=vals.map(n=>1000*n/total);
 const tenths=exact.map(Math.floor);
 let rest=1000-tenths.reduce((sum,n)=>sum+n,0);
 const order=[0,1,2].sort((x,y)=>(exact[y]-tenths[y])-(exact[x]-tenths[x])||x-y);
 for(let j=0;j<rest;j++)tenths[order[j]]++;
 return tenths.map(v=>v/10) as [number,number,number];
}
export function mergeRecapMonths(input:MonthlyRecap[]):CombinedRecap{
 const rows=[...input].sort((a,b)=>a.month.localeCompare(b.month));
 const summary={H:0,I:0,A:0,pending:0,meetings:0};
 const persons=new Map<string,RecapPerson>();
 const trend:AttendanceBucket[]=[];
 const meetings:RecapMeeting[]=[];
 for(const row of rows){
  for(const key of ['H','I','A','pending','meetings'] as const)summary[key]+=Number(row.summary[key]||0);
  trend.push({month:row.month,H:row.summary.H,I:row.summary.I,A:row.summary.A,pending:row.summary.pending,percentage:attendancePercentage(row.summary.H,row.summary.I,row.summary.A)});
  meetings.push(...row.meetings);
  for(const source of row.individuals){
   let current=persons.get(source.id);
   if(!current){
    current={id:source.id,name:source.name,class_name:source.class_name,level_name:source.level_name,H:0,I:0,A:0,pending:0,percentage:null,dates:{H:[],I:[],A:[]},monthly:[]};
    persons.set(source.id,current);
   }
   current.name=source.name||current.name;
   current.class_name=source.class_name||current.class_name;
   current.level_name=source.level_name||current.level_name;
   for(const status of ['H','I','A','pending'] as const)current[status]+=Number(source[status]||0);
   for(const status of ['H','I','A'] as const)current.dates[status].push(...(source.dates?.[status]||[]));
   current.monthly.push({month:row.month,H:source.H,I:source.I,A:source.A,pending:source.pending,percentage:attendancePercentage(source.H,source.I,source.A)});
  }
 }
 for(const person of persons.values()){
  person.percentage=attendancePercentage(person.H,person.I,person.A);
  for(const status of ['H','I','A'] as const)person.dates[status].sort();
  const byMonth=new Map(person.monthly.map(v=>[v.month,v]));
  person.monthly=trend.map(v=>byMonth.get(v.month)||{month:v.month,H:0,I:0,A:0,pending:0,percentage:null});
 }
 return {month:rows.at(-1)?.month||'',summary,individuals:[...persons.values()].sort((a,b)=>a.name.localeCompare(b.name,'id')),meetings:meetings.sort((a,b)=>b.date.localeCompare(a.date)||a.title.localeCompare(b.title)),trend};
}
