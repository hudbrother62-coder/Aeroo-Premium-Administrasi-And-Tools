/** Small pure helpers for the non-technical journal workflow.
 * Explicit assessment only: a present attendee must never receive an invented score. */
export type EasyAttendee={participant_key?:string;member_id?:string;status?:string|null;level_id_snapshot?:string|null;class_id_snapshot?:string|null};
export type EasyTarget={id:string;level_id?:string|null;class_id?:string|null};
export type EasyAssessment={value:string;note:string};
export function getAttendanceId(p:EasyAttendee){return p.participant_key||p.member_id||'';}
export function eligibleForTarget(p:EasyAttendee,t:EasyTarget){
  return p.status==='H'&&Boolean(getAttendanceId(p))&&
    (!t.level_id||t.level_id===p.level_id_snapshot)&&
    (!t.class_id||t.class_id===p.class_id_snapshot);
}
export function recordedAssessments(eligible:EasyAttendee[],scores:Record<string,EasyAssessment>,targetId:string){
  return eligible.flatMap(p=>{
    const id=getAttendanceId(p),raw=scores[id]?.value;
    if(raw===undefined||raw===''||raw===null)return [];
    const value=Number(raw);
    if(!Number.isFinite(value)||value<0||value>100)return [];
    return [{
      member_id:id,target_id:targetId,progress_value:value,
      progress_note:scores[id]?.note||'',follow_up:'',source:'JOURNAL' as const
    }];
  });
}
