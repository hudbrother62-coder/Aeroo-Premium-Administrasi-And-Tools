export type AttendanceStatus='H'|'I'|'A'|null;
export type AttendanceValue={status:AttendanceStatus;notes:string};
export type AttendanceRow=AttendanceValue&{revision:number};
export type SaveResult={record:AttendanceRow;conflict?:boolean};
export class AttendanceSaveQueue {
 private pending=new Map<string,AttendanceValue>();private running=new Set<string>();private blocked=new Set<string>();private errors=new Set<string>();private rows=new Map<string,AttendanceRow>();
 constructor(private send:(key:string,value:AttendanceValue,revision:number)=>Promise<SaveResult>,private update:(key:string,state:'saving'|'saved'|'error'|'conflict',record?:AttendanceRow)=>void,private persist:(pending:Record<string,AttendanceValue>)=>void=()=>{}){}
 seed(key:string,row:AttendanceRow){this.rows.set(key,row)}
 enqueue(key:string,value:AttendanceValue){this.pending.set(key,{...value});this.flushStorage();void this.drain(key)}
 retry(key?:string){for(const k of key?[key]:this.errors){if(this.errors.has(k)){this.blocked.delete(k);this.errors.delete(k);void this.drain(k)}}}
 resolve(key:string,server:AttendanceRow,keepMine:boolean){this.rows.set(key,server);this.blocked.delete(key);if(!keepMine){this.pending.delete(key);this.flushStorage();this.update(key,'saved',server)}else void this.drain(key)}
 snapshot(){return Object.fromEntries(Array.from(this.pending).map(([key,value])=>[key,{...value,revision:this.rows.get(key)?.revision??0}]))}
 private flushStorage(){this.persist(this.snapshot())}
 private async drain(key:string){if(this.running.has(key)||this.blocked.has(key)||!this.pending.has(key))return;this.running.add(key);try{while(this.pending.has(key)){const value=this.pending.get(key)!;const row=this.rows.get(key);if(!row)throw new Error('Daftar peserta belum tersedia');this.update(key,'saving');const result=await this.send(key,value,row.revision);if(result.conflict){this.blocked.add(key);this.update(key,'conflict',result.record);break;}this.rows.set(key,result.record);if(this.pending.get(key)===value){this.pending.delete(key);this.flushStorage();this.update(key,'saved',result.record)}}}catch{this.blocked.add(key);this.errors.add(key);this.update(key,'error')}finally{this.running.delete(key)}}
}
export function attendancePendingKey(eventId:string,writerId:string){return `attendance-pending:${eventId}:${writerId}`}
export function persistAttendancePending(storage:Pick<Storage,'setItem'|'removeItem'>,key:string,pending:Record<string,AttendanceValue>){if(Object.keys(pending).length)storage.setItem(key,JSON.stringify(pending));else storage.removeItem(key)}
