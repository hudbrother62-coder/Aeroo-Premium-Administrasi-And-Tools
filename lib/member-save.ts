import {NextResponse} from 'next/server';
import {db} from './supabase-server';
export async function saveMember(body:any,id:string|null){
 const s=await db(); let memberships=body.memberships;
 if(!Array.isArray(memberships)){
  const {data:cats}=await s.from('categories').select('id,slug');
  memberships=(body.category_ids||[]).map((category_id:string)=>{const slug=cats?.find(c=>c.id===category_id)?.slug;return {category_id,...(['caberawit','muda-mudi'].includes(slug||'')?{class_id:body.class_id,level_id:body.level_id}:slug==='pengurus'?{section:body.section}:{})}});
 }
 const {data,error}=await s.rpc('save_member',{p_id:id,p_revision:body.revision??0,p_person:body,p_memberships:memberships});
 return error?NextResponse.json({error:error.message},{status:error.message.includes('CONFLICT')?409:400}):NextResponse.json(data,{status:id?200:201});
}
