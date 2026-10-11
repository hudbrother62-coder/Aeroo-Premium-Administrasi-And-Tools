import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {parseNoteBody} from '@/lib/note-scopes';

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;
  const input=parseNoteBody(await req.json());const s=await db();
  const {data,error}=await s.rpc('save_scope_note',{
   p_scope:input.scope,p_id:id,p_revision:input.revision,p_body:input.body
  });
  return error?NextResponse.json({error:error.message},{status:error.message.includes('CONFLICT')?409:400}):
   NextResponse.json(data,{headers:{'Cache-Control':'no-store, private'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal mengubah catatan.'},{status:400});}
}
