import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {writeScopesForRole} from '@/lib/access';

const segmentSlug:Record<string,string>={CABERAWIT:'caberawit',MUDA_MUDI:'muda-mudi',PENGURUS:'pengurus',IBU_IBU:'ibu-ibu'};

export async function GET(req:NextRequest){
  const s=await db();
  const q=req.nextUrl.searchParams.get('q')??'';
  const segment=req.nextUrl.searchParams.get('segment')??'ALL';
  const classId=req.nextUrl.searchParams.get('class_id');
  const levelId=req.nextUrl.searchParams.get('level_id');

  let query=s.from('members')
    .select('*,levels(id,name),classes(id,name,audience),member_categories(category_id,categories(id,name,slug))')
    .eq('status','ACTIVE').order('name');
  if(q)query=query.ilike('name',`%${q}%`);
  if(classId)query=query.eq('class_id',classId);
  if(levelId)query=query.eq('level_id',levelId);

  const{data,error}=await query;
  if(error)return NextResponse.json({error:error.message},{status:400});

  let rows=data??[];
  if(segment==='KELOMPOK'){
    rows=rows.filter((x:any)=>x.member_categories?.some((c:any)=>['kelompok','muda-mudi'].includes(c.categories?.slug)));
  }else{
    const slug=segmentSlug[segment];
    if(slug)rows=rows.filter((x:any)=>x.member_categories?.some((c:any)=>c.categories?.slug===slug));
  }

  return NextResponse.json(rows);
}

export async function POST(req:NextRequest){
  const s=await db();
  const body=await req.json();
  const categories:string[]=Array.isArray(body.category_ids)?body.category_ids:[];
  delete body.category_ids;

  const{data:role}=await s.rpc('current_app_role');
  const writeScopes=writeScopesForRole(role);
  if(!writeScopes.length)return NextResponse.json({error:'Akses hanya-baca.'},{status:403});
  if(!categories.length)return NextResponse.json({error:'Pilih minimal satu kategori.'},{status:400});

  const{data:selectedCategories,error:catCheckError}=await s.from('categories').select('id,slug').in('id',categories);
  if(catCheckError)return NextResponse.json({error:catCheckError.message},{status:400});
  if((selectedCategories??[]).length!==categories.length){
    return NextResponse.json({error:'Kategori tidak valid.'},{status:400});
  }

  const allowedSlugs=new Set(
    role==='ADMIN'?['kelompok','muda-mudi','caberawit','ibu-ibu','pengurus']:
    role==='DEWAN_GURU'?['caberawit','muda-mudi']:
    role==='KELOMPOK'?['kelompok','ibu-ibu','pengurus']:[]
  );
  if((selectedCategories??[]).some(c=>!allowedSlugs.has(c.slug))){
    return NextResponse.json({error:'Kategori di luar akses akun ini.'},{status:403});
  }

  const{data,error}=await s.from('members').insert({
    ...body,
    level_id:body.level_id||null,
    class_id:body.class_id||null,
    status:'ACTIVE'
  }).select().single();
  if(error)return NextResponse.json({error:error.message},{status:400});

  const{error:catError}=await s.from('member_categories').insert(categories.map(category_id=>({member_id:data.id,category_id})));
  if(catError){
    await s.from('members').delete().eq('id',data.id);
    return NextResponse.json({error:catError.message},{status:400});
  }

  return NextResponse.json(data,{status:201});
}
