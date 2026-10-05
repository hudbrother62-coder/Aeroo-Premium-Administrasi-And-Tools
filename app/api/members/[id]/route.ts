import {saveMember} from '@/lib/member-save';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase-server';
import {writeScopesForRole} from '@/lib/access';

const allowedFields=new Set(['name','gender','birth_place','birth_date','phone','address','photo_url','notes','level_id','class_id','section','status']);

export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const s=await db();const {data,error}=await s.from('members').select('*,member_memberships(*,categories(id,name,slug),classes(name),levels(name))').eq('id',id).single();return error?NextResponse.json({error:'Anggota tidak ditemukan.'},{status:404}):NextResponse.json(data);
}
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const body=await req.json();
 if(Object.keys(body).length===1&&['ACTIVE','INACTIVE'].includes(body.status)){const s=await db();const {data:role}=await s.rpc('current_app_role');if(role!=='ADMIN')return NextResponse.json({error:'Hanya owner dapat memulihkan.'},{status:403});const{data,error}=await s.rpc('archive_member',{p_id:id,p_archive:body.status!=='ACTIVE'});return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data)}
 return saveMember(body,id);
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
  const {data,error}=await s.rpc('archive_member',{p_id:id,p_archive:true});

  return error
    ? NextResponse.json({error:error.message},{status:400})
    : NextResponse.json(data);
}
