import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {parseNoteScope,parseNoteStatus,parseNoteBody} from '@/lib/note-scopes';

export async function GET(req:NextRequest){
 try {
  const scope=parseNoteScope(req.nextUrl.searchParams.get('scope')||'PERSONAL');
  const status=parseNoteStatus(req.nextUrl.searchParams.get('status')||'ACTIVE');
  const s=await db();
  const {data,error}=await s.rpc('list_scope_notes',{p_scope:scope,p_status:status});
  return error?NextResponse.json({error:error.message},{status:400}):
   NextResponse.json(data??[],{headers:{'Cache-Control':'no-store, private'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal memuat catatan.'},{status:400});}
}

export async function POST(req:NextRequest){
 try{
  const input=parseNoteBody(await req.json());const s=await db();
  const {data,error}=await s.rpc('save_scope_note',{
   p_scope:input.scope,p_id:null,p_revision:0,p_body:input.body
  });
  return error?NextResponse.json({error:error.message},{status:400}):
   NextResponse.json(data,{status:201,headers:{'Cache-Control':'no-store, private'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal membuat catatan.'},{status:400});}
}
