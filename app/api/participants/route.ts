import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

const slugByAudience:Record<string,string>={CABERAWIT:'caberawit',MUDA_MUDI:'muda-mudi',IBU_IBU:'ibu-ibu',PENGURUS:'pengurus'};

export async function GET(req:NextRequest){
  const s=await db();
  const audience=req.nextUrl.searchParams.get('audience')??'KELOMPOK';
  const level=req.nextUrl.searchParams.get('level_id');
  const classId=req.nextUrl.searchParams.get('class_id');

  let q=s.from('members')
    .select('id,name,level_id,class_id,levels(name),classes(name),member_categories(categories(slug,name))')
    .eq('status','ACTIVE').order('name');
  if(level)q=q.eq('level_id',level);
  if(classId)q=q.eq('class_id',classId);

  const{data,error}=await q;
  if(error)return NextResponse.json({error:error.message},{status:400});
  const slug=slugByAudience[audience];
  const rows=(data??[])
    .filter((x:any)=>!slug||x.member_categories?.some((c:any)=>c.categories?.slug===slug))
    .map((x:any)=>({
      id:x.id,name:x.name,type:'member',
      meta:[x.classes?.name,x.levels?.name,x.member_categories?.map((c:any)=>c.categories?.name).filter(Boolean).join(' • ')].filter(Boolean).join(' · ')
    }));
  return NextResponse.json(rows);
}
