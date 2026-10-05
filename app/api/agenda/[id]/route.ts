import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {publicRows} from '@/lib/public-read';
import {saveAgenda} from '@/lib/agenda-save';
type Params={params:Promise<{id:string}>};
export async function GET(req:NextRequest,{params}:Params){const{id}=await params;const s=await db();const{data:role}=await s.rpc('current_app_role');if(!role||role==='VIEWER'){const row=(await publicRows('agenda')).find(r=>r.id===id);return row?NextResponse.json(row):NextResponse.json({error:'Agenda tidak ditemukan.'},{status:404})}const{data,error}=await s.from('agenda').select('*').eq('id',id).single();return error?NextResponse.json({error:error.message},{status:404}):NextResponse.json(data)}
export async function PATCH(req:NextRequest,{params}:Params){return saveAgenda(req,(await params).id)}
export async function DELETE(req:NextRequest,{params}:Params){const{id}=await params;const s=await db();const{data:old,error:load}=await s.from('agenda').select('*').eq('id',id).single();if(load)return NextResponse.json({error:'Agenda tidak ditemukan.'},{status:404});const{data,error}=await s.rpc('save_agenda',{p_id:id,p_revision:old.revision,p_items:[{status:'CANCELLED'}],p_scope:'this'});return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data)}
