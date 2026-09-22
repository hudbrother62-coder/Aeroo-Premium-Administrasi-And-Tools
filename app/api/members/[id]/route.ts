import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params; const s=(await (await db())); const body=await req.json(); const categoryIds:string[]|undefined=body.category_ids; delete body.category_ids;
 const {data,error}=await s.from('members').update({...body,updated_at:new Date().toISOString()}).eq('id',id).select().single();
 if(error)return NextResponse.json({error:error.message},{status:400});
 if(categoryIds){const {error:del}=await s.from('member_categories').delete().eq('member_id',id);if(del)return NextResponse.json({error:del.message},{status:400});if(categoryIds.length){const {error:ins}=await s.from('member_categories').insert(categoryIds.map(category_id=>({member_id:id,category_id})));if(ins)return NextResponse.json({error:ins.message},{status:400});}}
 return NextResponse.json(data);
}
export async function DELETE(_:NextRequest,{params}:{params:Promise<{id:string}>}){const {id}=await params;const {data,error}=await (await (await db())).from('members').update({status:'INACTIVE',updated_at:new Date().toISOString()}).eq('id',id).select().single();return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data)}
