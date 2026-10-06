import {effectiveMembership,projectMember} from '@/lib/domain';
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
  const archived=req.nextUrl.searchParams.get('archived')==='1';

  let query=s.from('members')
    .select('*,levels(id,name),classes!members_class_id_fkey(id,name,audience),member_categories(category_id,categories(id,name,slug)),member_memberships(*,categories(id,name,slug),classes(id,name),levels(id,name))')
    .eq('status',archived?'INACTIVE':'ACTIVE').order('name');
  if(q)query=query.ilike('name',`%${q}%`);



  const{data,error}=await query;
  if(error)return NextResponse.json({error:error.message},{status:400});

  let rows=data??[];
  const slug=segmentSlug[segment];


  const office=req.nextUrl.searchParams.get('office');
  if(slug||classId||levelId||office)rows=rows.filter((p:any)=>p.member_memberships?.some((m:any)=>effectiveMembership(m)&&(!slug||m.categories?.slug===slug)&&(!classId||m.class_id===classId)&&(!levelId||m.level_id===levelId)&&(!office||[m.office,m.section].some(v=>v?.toLowerCase().includes(office.toLowerCase())))));
  return NextResponse.json(rows.map((p:any)=>projectMember(p)));
}

export async function POST(req:NextRequest){return saveMember(await req.json(),null)}
