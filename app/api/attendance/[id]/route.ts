import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {publicRows} from '@/lib/public-read';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{const {id}=await params;const s=await db();const {data:role}=await s.rpc('current_app_role');if(!role||role==='VIEWER'){const event=(await publicRows('attendance')).find(e=>e.id===id);return event?NextResponse.json(event):NextResponse.json({error:'Pertemuan tidak ditemukan.'},{status:404})}const {data,error}=await s.from('attendance_events').select('*,attendance_records(*,attendance_changes(*))').eq('id',id).single();return error?NextResponse.json({error:error.message},{status:404}):NextResponse.json(data);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal memuat pertemuan.'},{status:400})}
}
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{const {id}=await params;const b=await req.json();if(!b.participant_key||!Number.isInteger(b.revision)||b.revision<0||![null,'H','I','A'].includes(b.status)||typeof b.notes!=='string'||b.notes.length>2000)return NextResponse.json({error:'Perubahan peserta tidak valid.'},{status:400});const s=await db();const {data,error}=await s.rpc('save_attendance_record',{p_event_id:id,p_participant_key:b.participant_key,p_revision:b.revision,p_status:b.status,p_notes:b.notes});return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data,{status:data?.conflict?409:200});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal menyimpan presensi.'},{status:400})}
}
