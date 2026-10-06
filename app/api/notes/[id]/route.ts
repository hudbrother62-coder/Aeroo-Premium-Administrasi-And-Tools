import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {noteInput} from '@/lib/rebuild';
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;const input=noteInput(await req.json());const s=await db();const {data,error}=await s.rpc('save_personal_note',{p_id:id,p_revision:input.revision,p_body:input});return error?NextResponse.json({error:error.message},{status:error.message.includes('CONFLICT')?409:400}):NextResponse.json(data)}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal menyimpan.'},{status:400})}}
