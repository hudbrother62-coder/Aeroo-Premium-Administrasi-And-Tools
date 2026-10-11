import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

type Kind='MAIN'|'TEACHING';
function fail(error:string,status=400){return NextResponse.json({error},{status});}
function validId(value:unknown){return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);}
function parseItem(input:any){
  const kind:Kind=input?.kind;
  if(!['MAIN','TEACHING'].includes(kind))throw new Error('Jenis sarpras wajib dipilih.');
  if(!validId(input?.org_unit_id))throw new Error('Pilih Daerah, Desa, atau Kelompok.');
  const name=String(input?.name??'').trim();
  if(!name||name.length>160)throw new Error('Nama sarpras wajib diisi (maksimal 160 karakter).');
  const quantity=Number(input?.quantity);
  if(!Number.isFinite(quantity)||quantity<0||quantity>9999999999)throw new Error('Jumlah sarpras tidak valid.');
  const unit=String(input?.unit??'unit').trim();
  if(!unit||unit.length>32)throw new Error('Satuan barang tidak valid.');
  const condition=String(input?.asset_condition??'BAIK');
  if(!['BAIK','RUSAK_RINGAN','RUSAK_BERAT'].includes(condition))throw new Error('Kondisi barang tidak valid.');
  const level_id=kind==='TEACHING'&&validId(input?.level_id)?String(input.level_id):null;
  const class_id=kind==='TEACHING'&&validId(input?.class_id)?String(input.class_id):null;
  if(kind==='TEACHING'&&!level_id)throw new Error('Alat bantu mengajar wajib memiliki jenjang Caberawit.');
  const trim=(k:string,max:number)=>{const v=String(input?.[k]??'').trim();if(v.length>max)throw new Error('Kolom '+k+' terlalu panjang.');return v||null;};
  const acquired_on=input?.acquired_on?String(input.acquired_on):null;
  if(acquired_on&&!/^\d{4}-\d{2}-\d{2}$/.test(acquired_on))throw new Error('Tanggal pengadaan tidak valid.');
  return {kind,org_unit_id:String(input.org_unit_id),level_id,class_id,name,quantity,unit,asset_condition:condition,
    asset_code:trim('asset_code',64),location:trim('location',200),responsible_name:trim('responsible_name',160),
    notes:trim('notes',3000),acquired_on};
}
export async function GET(req:NextRequest){
  const s=await db();
  const {data:user,error:authError}=await s.rpc('get_current_app_user');
  if(authError||!user?.length)return fail('Silakan masuk untuk melihat sarana prasarana.',401);
  const kind=req.nextUrl.searchParams.get('kind');
  if(kind&&kind!=='MAIN'&&kind!=='TEACHING')return fail('Jenis inventaris tidak valid.');
  const status=req.nextUrl.searchParams.get('status')||'ACTIVE';
  if(!['ACTIVE','ARCHIVED'].includes(status))return fail('Status inventaris tidak valid.');
  let q=s.from('simpul_inventory').select('*,simpul_org_units(name,unit_type,parent_id),levels(name),classes(name)').eq('status',status).order('updated_at',{ascending:false}).limit(1500);
  if(kind)q=q.eq('kind',kind);
  const [items,units,levels,classes]=await Promise.all([
    q,
    s.from('simpul_org_units').select('id,parent_id,name,unit_type').order('name'),
    s.from('levels').select('id,name').eq('active',true).order('sort_order'),
    s.from('classes').select('id,name,level_id,audience').eq('active',true).eq('audience','CABERAWIT').order('sort_order')
  ]);
  const err=[items,units,levels,classes].find(x=>x.error)?.error;
  if(err)return fail(err.message);
  return NextResponse.json({items:items.data??[],units:units.data??[],levels:levels.data??[],classes:classes.data??[],
    role:user[0].role},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(req:NextRequest){
  try{
    const s=await db(),payload=parseItem(await req.json());
    const {data,error}=await s.from('simpul_inventory').insert(payload).select('id').single();
    if(error)return fail(error.code==='42501'?'Akses menambah sarpras ditolak.':error.message,error.code==='42501'?403:400);
    return NextResponse.json(data,{status:201});
  }catch(e){return fail(e instanceof Error?e.message:'Data tidak valid.');}
}
export async function PATCH(req:NextRequest){
  try{
    const input=await req.json();
    if(!validId(input?.id)||!Number.isInteger(input?.revision)||input.revision<0)return fail('ID atau revisi tidak valid.');
    const s=await db();
    const payload=input?.action==='ARCHIVE'?{status:'ARCHIVED'}:input?.action==='RESTORE'?{status:'ACTIVE'}:parseItem(input);
    const {data,error}=await s.from('simpul_inventory').update(payload).eq('id',input.id).eq('revision',input.revision).select('id,revision').maybeSingle();
    if(error)return fail(error.message,error.code==='42501'?403:400);
    if(!data)return fail('Data sudah berubah, telah diarsip, atau di luar akses. Muat ulang daftar.',409);
    return NextResponse.json(data);
  }catch(e){return fail(e instanceof Error?e.message:'Gagal memperbarui sarpras.');}
}
