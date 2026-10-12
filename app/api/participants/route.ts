import {NextRequest,NextResponse} from 'next/server';
import {readRows} from '@/lib/public-read';
import {effectiveMembership,slugByAudience,jakartaDate} from '@/lib/domain';
export async function GET(req:NextRequest){
 try{
  const q=req.nextUrl.searchParams, audience=q.get('audience')||'KELOMPOK';
  const slug=slugByAudience[audience];if(!slug)return NextResponse.json({error:'Kategori tidak valid'},{status:400});
  const date=q.get('date')||jakartaDate();
  const rows=(await readRows('members')).flatMap((p:any)=>{
   const memberships=(p.member_memberships||[]).filter((m:any)=>effectiveMembership(m,date));
   const selected=audience==='KELOMPOK'
    ? !memberships.some((m:any)=>m.categories?.slug==='caberawit')
    : memberships.some((m:any)=>m.categories?.slug===slug&&(!q.get('class_id')||m.class_id===q.get('class_id')));
   if(!selected||(q.get('gender')&&p.gender!==q.get('gender')))return [];
   const valid=memberships.filter((m:any)=>audience==='KELOMPOK'||m.categories?.slug===slug);
   return [{id:p.id,name:p.name,gender:p.gender||null,type:'member',meta:valid.map((m:any)=>[m.classes?.name,m.levels?.name].filter(Boolean).join(' · ')).filter(Boolean).join(', ')}];
  });
  return NextResponse.json(rows);
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Data tidak tersedia.'},{status:400})}
}
