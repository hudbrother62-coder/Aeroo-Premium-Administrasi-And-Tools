import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export async function POST(req:NextRequest){
  const s=await db();
  const {data:role}=await s.rpc('current_app_role');
  if(!['ADMIN','DEWAN_GURU','KELOMPOK'].includes(role??''))return NextResponse.json({error:'Akses ditolak.'},{status:403});
  const body=await req.json();
  const ids:string[]=Array.isArray(body.member_ids)?body.member_ids:[];
  const categoryIds:string[]=Array.isArray(body.category_ids)?body.category_ids:[];
  if(!ids.length||(!categoryIds.length&&!body.class_id)||ids.length>500)return NextResponse.json({error:'Pilih anggota dan kategori atau kelas (maksimal 500).'}, {status:400});
  const {data:categories,error:cErr}=categoryIds.length?await s.from('categories').select('id,slug').in('id',categoryIds):{data:[],error:null};
  if(cErr||categories?.length!==categoryIds.length)return NextResponse.json({error:'Kategori tidak valid.'},{status:400});
  const allowed=role==='ADMIN'?['kelompok','muda-mudi','caberawit','ibu-ibu','pengurus']:role==='DEWAN_GURU'?['caberawit','muda-mudi']:['kelompok','ibu-ibu','pengurus'];
  if(categories.some(c=>!allowed.includes(c.slug)))return NextResponse.json({error:'Kategori di luar akses.'},{status:403});
  const {data:existing,error:eErr}=await s.from('member_categories').select('member_id,category_id').in('member_id',ids);
  if(eErr)return NextResponse.json({error:eErr.message},{status:400});
  const seen=new Set((existing??[]).map(x=>`${x.member_id}:${x.category_id}`));
  const insert=ids.flatMap(member_id=>categoryIds.filter(category_id=>!seen.has(`${member_id}:${category_id}`)).map(category_id=>({member_id,category_id})));
  if(insert.length){const {error}=await s.from('member_categories').insert(insert);if(error)return NextResponse.json({error:error.message},{status:400})}
  if(body.class_id){const {error}=await s.from('members').update({class_id:body.class_id}).in('id',ids);if(error)return NextResponse.json({error:error.message},{status:400})}
  return NextResponse.json({added:insert.length,updated:ids.length});
}
