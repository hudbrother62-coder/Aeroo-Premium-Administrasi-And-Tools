import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {publicRows} from '@/lib/public-read';

export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;const s=await db();
  const {data:role}=await s.rpc('current_app_role');
  if(!role||role==='VIEWER'){
    const event=(await publicRows('attendance')).find(e=>e.id===id);
    return event?NextResponse.json(event):NextResponse.json({error:'Pertemuan tidak ditemukan.'},{status:404});
  }
  const {data,error}=await s.from('attendance_events').select('*,attendance_records(*,attendance_changes(*))').eq('id',id).single();
  if(error)return NextResponse.json({error:error.message},{status:404});

  let records=data.attendance_records||[];
  const today=new Date(Date.now()+7*60*60*1000).toISOString().slice(0,10);
  // A routine class roster can change while today's session is already open.
  // Never rewrite earlier attendance or custom-agenda participant snapshots.
  if(data.audience==='CABERAWIT'&&data.class_id&&!data.agenda_id&&data.event_date>=today){
    const {data:canWrite}=await s.rpc('can_write_scoped_audience',{p_audience:data.audience,p_class_id:data.class_id});
    if(canWrite){
      const {data:memberIds,error:syncError}=await s.rpc('sync_caberawit_attendance_roster',{p_event_id:id});
      if(syncError)return NextResponse.json({error:syncError.message},{status:400});
      if(Array.isArray(memberIds)){
        const {data:currentRecords,error:recordsError}=await s.from('attendance_records')
          .select('*,attendance_changes(*)').eq('event_id',id);
        if(recordsError)return NextResponse.json({error:recordsError.message},{status:400});
        const currentMembers=new Set<string>(memberIds);
        records=(currentRecords||[]).filter((r:any)=>r.member_id&&currentMembers.has(r.member_id));
      }
    }
  }

  if(data.audience!=='KELOMPOK')return NextResponse.json({...data,attendance_records:records});
  const ids=records.map((r:any)=>r.member_id||r.participant_key).filter(Boolean);
  const people=ids.length?await s.from('members').select('id,gender').in('id',ids):{data:[]};
  const genders=new Map((people.data||[]).map((m:any)=>[m.id,m.gender]));
  return NextResponse.json({...data,attendance_records:records.map((r:any)=>({
    ...r,gender:genders.get(r.member_id||r.participant_key)||null
  }))});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal memuat pertemuan.'},{status:400})}
}
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{const {id}=await params;const b=await req.json();if(!b.participant_key||!Number.isInteger(b.revision)||b.revision<0||![null,'H','I','A'].includes(b.status)||typeof b.notes!=='string'||b.notes.length>2000)return NextResponse.json({error:'Perubahan peserta tidak valid.'},{status:400});const s=await db();const {data:canEdit,error:permissionError}=await s.rpc('has_app_permission',{p_permission:'attendance.write'});if(permissionError||!canEdit)return NextResponse.json({error:'Akun tidak memiliki izin koreksi presensi.'},{status:403});const {data,error}=await s.rpc('save_attendance_record',{p_event_id:id,p_participant_key:b.participant_key,p_revision:b.revision,p_status:b.status,p_notes:b.notes});return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data,{status:data?.conflict?409:200});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal menyimpan presensi.'},{status:400})}
}
