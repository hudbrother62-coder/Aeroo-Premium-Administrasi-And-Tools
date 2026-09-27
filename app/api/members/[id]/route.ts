import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase-server';
import {writeScopesForRole} from '@/lib/access';

const allowedFields=new Set(['name','gender','birth_place','birth_date','phone','address','photo_url','notes','level_id','class_id','section','status']);

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const s=await db();
  const body=await req.json();
  const categoryIds:string[]|undefined=body.category_ids;
  delete body.category_ids;
  const {data:role}=await s.rpc('current_app_role');
  if(!writeScopesForRole(role).length)return NextResponse.json({error:'Tidak memiliki akses mengubah data.'},{status:403});
  if(body.status&&role!=='ADMIN')return NextResponse.json({error:'Hanya owner dapat memulihkan arsip.'},{status:403});
  if(Object.keys(body).some(k=>!allowedFields.has(k)))return NextResponse.json({error:'Kolom tidak dikenal.'},{status:400});
  if(categoryIds){
    const {data:categories,error:catError}=await s.from('categories').select('id,slug').in('id',categoryIds);
    if(catError||categories?.length!==categoryIds.length)return NextResponse.json({error:'Kategori tidak valid.'},{status:400});
    const allowed=role==='ADMIN'?['kelompok','muda-mudi','caberawit','ibu-ibu','pengurus']:role==='DEWAN_GURU'?['caberawit','muda-mudi']:['kelompok','ibu-ibu','pengurus'];
    if(categories.some(c=>!allowed.includes(c.slug)))return NextResponse.json({error:'Kategori di luar akses.'},{status:403});
  }

  const {data,error}=await s
    .from('members')
    .update({...body,updated_at:new Date().toISOString()})
    .eq('id',id)
    .select()
    .single();

  if(error) return NextResponse.json({error:error.message},{status:400});

  if(categoryIds){
    const {error:del}=await s.from('member_categories').delete().eq('member_id',id);
    if(del) return NextResponse.json({error:del.message},{status:400});

    if(categoryIds.length){
      const {error:ins}=await s.from('member_categories').insert(
        categoryIds.map(category_id=>({member_id:id,category_id}))
      );
      if(ins) return NextResponse.json({error:ins.message},{status:400});
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const s=await db();
  const {data:role}=await s.rpc('current_app_role');
  if(role!=='ADMIN')return NextResponse.json({error:'Hanya owner dapat mengarsipkan atau menghapus permanen.'},{status:403});
  if(req.nextUrl.searchParams.get('permanent')==='1'){
    const {error}=await s.rpc('permanently_delete_member',{p_member_id:id});
    return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json({ok:true});
  }
  const {data,error}=await s
    .from('members')
    .update({status:'INACTIVE',updated_at:new Date().toISOString()})
    .eq('id',id)
    .select()
    .single();

  return error
    ? NextResponse.json({error:error.message},{status:400})
    : NextResponse.json(data);
}
