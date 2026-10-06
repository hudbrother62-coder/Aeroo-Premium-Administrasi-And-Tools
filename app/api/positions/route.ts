import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
export async function GET(){const s=await db();const {data:role}=await s.rpc('current_app_role');if(!['ADMIN','KELOMPOK'].includes(role))return NextResponse.json({error:'Akses ditolak.'},{status:403});const {data,error}=await s.from('organizational_positions').select('*,members(id,name)').order('section').order('valid_from',{ascending:false});return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data??[])}
export async function POST(req:NextRequest){try{const input=await req.json();const s=await db();const {data,error}=await s.rpc('save_organizational_position',{p_id:input.id||null,p_revision:input.revision??0,p_body:input});return error?NextResponse.json({error:error.message},{status:error.message.includes('CONFLICT')?409:400}):NextResponse.json(data)}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Data tidak valid.'},{status:400})}}

export async function DELETE(req:NextRequest){
  const id=req.nextUrl.searchParams.get('id');
  if(!id)return NextResponse.json({error:'ID dapukan wajib diisi.'},{status:400});
  const s=await db();
  const {data,error}=await s.rpc('deactivate_organizational_position',{p_id:id});
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data);
}
