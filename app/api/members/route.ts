import {effectiveMembership} from '@/lib/domain';
import {saveMember} from '@/lib/member-save';
import {publicProjection} from '@/lib/public-read';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {writeScopesForRole} from '@/lib/access';

const segmentSlug:Record<string,string>={KELOMPOK:'kelompok',CABERAWIT:'caberawit',MUDA_MUDI:'muda-mudi',PENGURUS:'pengurus',IBU_IBU:'ibu-ibu'};

export async function GET(req:NextRequest){
  const publicResponse=await publicProjection(req,'members');if(publicResponse)return publicResponse;
  const s=await db();
  const q=req.nextUrl.searchParams.get('q')??'';
  const segment=req.nextUrl.searchParams.get('segment')??'ALL';
  const classId=req.nextUrl.searchParams.get('class_id');
  const levelId=req.nextUrl.searchParams.get('level_id');
  const archivedParam=req.nextUrl.searchParams.get('archived');
  const status=req.nextUrl.searchParams.get('status')??(archivedParam==='1'?'INACTIVE':'ACTIVE');
  const sort=req.nextUrl.searchParams.get('sort')??'name_asc';

  let query=s.from('members')
    .select('*,levels(id,name),classes!members_class_id_fkey(id,name,audience),member_categories(category_id,categories(id,name,slug)),member_memberships(*,categories(id,name,slug),classes(id,name),levels(id,name))');
  if(status==='ACTIVE'||status==='INACTIVE')query=query.eq('status',status);
  if(q)query=query.ilike('name',`%${q}%`);
  if(sort==='source')query=query.order('source_order',{ascending:true,nullsFirst:false}).order('name',{ascending:true});
  else if(sort==='name_desc')query=query.order('name',{ascending:false});
  else if(sort==='newest')query=query.order('created_at',{ascending:false}).order('name',{ascending:true});
  else if(sort==='oldest')query=query.order('created_at',{ascending:true}).order('name',{ascending:true});
  else query=query.order('name',{ascending:true});



  const{data,error}=await query;
  if(error)return NextResponse.json({error:error.message},{status:400});

  let rows=data??[];
  const slug=segmentSlug[segment];


  const office=req.nextUrl.searchParams.get('office');
  if(slug||classId||levelId||office)rows=rows.filter((p:any)=>p.member_memberships?.some((m:any)=>effectiveMembership(m)&&(!slug||m.categories?.slug===slug)&&(!classId||m.class_id===classId)&&(!levelId||m.level_id===levelId)&&(!office||[m.office,m.section].some(v=>v?.toLowerCase().includes(office.toLowerCase())))));
  return NextResponse.json(rows.map((p:any)=>({...p,member_memberships:p.member_memberships?.map((m:any)=>({...m,effective:effectiveMembership(m)}))})));
}

export async function POST(req:NextRequest){return saveMember(await req.json(),null)}
