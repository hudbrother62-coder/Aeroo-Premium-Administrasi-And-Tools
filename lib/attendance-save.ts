export type AttendanceStatus='H'|'I'|'A'|null;
export type AttendanceValue={status:AttendanceStatus;notes:string};
export type AttendanceRow=AttendanceValue&{revision:number};
export type SaveResult={record:AttendanceRow;conflict?:boolean};
export type AttendanceSyncState='pending'|'saving'|'saved'|'error'|'conflict';

export class AttendanceSaveQueue {
  private pending=new Map<string,AttendanceValue>();
  private running=new Set<string>();
  private blocked=new Set<string>();
  private errors=new Set<string>();
  private rows=new Map<string,AttendanceRow>();

  constructor(
    private send:(key:string,value:AttendanceValue,revision:number)=>Promise<SaveResult>,
    private update:(key:string,state:AttendanceSyncState,record?:AttendanceRow)=>void,
    private persist:(pending:Record<string,AttendanceValue>)=>void=()=>{},
    private canSend:()=>boolean=()=>true
  ){}

  seed(key:string,row:AttendanceRow){this.rows.set(key,row)}

  enqueue(key:string,value:AttendanceValue){
    this.pending.set(key,{...value});
    this.flushStorage();
    if(!this.canSend()){
      this.update(key,'pending');
      return;
    }
    void this.drain(key);
  }

  retry(key?:string){
    const keys=key?[key]:Array.from(new Set([...this.errors,...this.pending.keys()]));
    for(const k of keys){
      if(!this.pending.has(k))continue;
      if(this.errors.has(k)){
        this.blocked.delete(k);
        this.errors.delete(k);
      }else if(this.blocked.has(k)){
        continue;
      }
      if(!this.canSend()){
        this.update(k,'pending');
        continue;
      }
      void this.drain(k);
    }
  }

  resolve(key:string,server:AttendanceRow,keepMine:boolean){
    this.rows.set(key,server);
    this.blocked.delete(key);
    this.errors.delete(key);
    if(!keepMine){
      this.pending.delete(key);
      this.flushStorage();
      this.update(key,'saved',server);
    }else if(!this.canSend()){
      this.update(key,'pending',server);
    }else{
      void this.drain(key);
    }
  }

  snapshot(){
    return Object.fromEntries(Array.from(this.pending).map(([key,value])=>[
      key,{...value,revision:this.rows.get(key)?.revision??0}
    ]));
  }

  hasPending(){return this.pending.size>0}

  private flushStorage(){this.persist(this.snapshot())}

  private async drain(key:string){
    if(this.running.has(key)||this.blocked.has(key)||!this.pending.has(key))return;
    if(!this.canSend()){
      this.update(key,'pending');
      return;
    }

    this.running.add(key);
    try{
      while(this.pending.has(key)){
        if(!this.canSend()){
          this.update(key,'pending');
          break;
        }

        const value=this.pending.get(key)!;
        const row=this.rows.get(key);
        if(!row)throw new Error('Daftar peserta belum tersedia');

        this.update(key,'saving');
        const result=await this.send(key,value,row.revision);
        if(result.conflict){
          this.blocked.add(key);
          this.update(key,'conflict',result.record);
          break;
        }

        this.rows.set(key,result.record);
        if(this.pending.get(key)===value){
          this.pending.delete(key);
          this.flushStorage();
          this.update(key,'saved',result.record);
        }
      }
    }catch{
      this.blocked.add(key);
      this.errors.add(key);
      this.update(key,this.canSend()?'error':'pending');
    }finally{
      this.running.delete(key);
    }
  }
}

export function attendancePendingKey(eventId:string,writerId:string){
  return `attendance-pending:${eventId}:${writerId}`;
}

export function persistAttendancePending(
  storage:Pick<Storage,'setItem'|'removeItem'>,
  key:string,
  pending:Record<string,AttendanceValue>
){
  if(Object.keys(pending).length)storage.setItem(key,JSON.stringify(pending));
  else storage.removeItem(key);
}

export function moveAttendancePending(
  storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,
  fromKey:string,
  toKey:string
){
  if(fromKey===toKey)return {};
  const raw=storage.getItem(fromKey);
  if(!raw)return {};
  const parsed=JSON.parse(raw) as Record<string,AttendanceValue&{revision?:number}>;
  if(parsed&&Object.keys(parsed).length)storage.setItem(toKey,JSON.stringify(parsed));
  storage.removeItem(fromKey);
  return parsed||{};
}
