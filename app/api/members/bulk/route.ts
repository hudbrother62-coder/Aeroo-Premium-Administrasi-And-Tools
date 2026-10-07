import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {slugByAudience,programSlugs} from '@/lib/domain';

export async function POST(req:NextRequest){try{
 const s=await db();
 const {data:uid}=await s.rpc('current_app_user_id');
 if(!uid)return NextResponse.json({error:'Akses ditolak.'},{status:403});

 const body=await req.json();
 const ids=[...new Set<string>(body.member_ids||[])];
 if(!ids.length||ids.length>500||(!(body.category_ids||[]).length&&!body.class_id))throw Error('Pilih maksimal 500 anggota dan tujuan');

 const [peopleRes,catsRes,klassRes,globalCabRes,globalMmRes,globalIbuRes,classScopeRes]=await Promise.all([
  s.from('members').select('*,member_memberships(*,categories(slug))').in('id',ids),
  s.from('categories').select('id,slug'),
  body.class_id?s.from('classes').select('*').eq('id',body.class_id).single():Promise.resolve({data:null,error:null} as any),
  s.rpc('can_write_audience_global',{p_audience:'CABERAWIT'}),
  s.rpc('can_write_audience_global',{p_audience:'MUDA_MUDI'}),
  s.rpc('can_write_audience_global',{p_audience:'IBU_IBU'}),
  s.from('user_class_scopes').select('class_id,can_write').eq('user_id',uid).maybeSingle()
 ]);
 const people=peopleRes.data,cats=catsRes.data,klass=klassRes.data;
 if(peopleRes.error)throw Error(peopleRes.error.message);
 if(catsRes.error)throw Error(catsRes.error.message);
 if(klassRes.error&&body.class_id)throw Error('Kelas tujuan tidak ditemukan atau di luar akses.');
 if(body.class_id&&!klass)throw Error('Kelas tujuan tidak ditemukan atau di luar akses.');
 if(people?.length!==ids.length)throw Error('Sebagian anggota tidak ditemukan atau di luar akses');

 const globalCab=globalCabRes.data===true,globalMm=globalMmRes.data===true,globalIbu=globalIbuRes.data===true;
 const classScope=classScopeRes.data as {class_id:string;can_write:boolean}|null;
 const canWriteMembership=(m:any)=>{
   const slug=m.categories?.slug;
   if(slug==='caberawit')return globalCab||!!(classScope?.can_write&&m.class_id===classScope.class_id);
   if(slug==='muda-mudi')return globalMm;
   if(slug==='ibu-ibu')return globalIbu;
   return false;
 };
 const requestedCats=(body.category_ids||[]).map((id:string)=>cats?.find(c=>c.id===id)).filter(Boolean);
 if(requestedCats.length!==(body.category_ids||[]).length||requestedCats.some((c:any)=>!programSlugs.includes(c.slug)))throw Error('Pilih program Caberawit, Muda-Mudi, atau Ibu-Ibu');
 for(const c of requestedCats as any[]){
   if(c.slug==='caberawit'&&!body.class_id)throw Error('Perubahan Caberawit wajib memilih kelas.');
   if(c.slug==='caberawit'&&!(globalCab||!!(classScope?.can_write&&body.class_id===classScope.class_id)))throw Error('Kelas Caberawit di luar akses.');
   if(c.slug==='muda-mudi'&&!globalMm)throw Error('Muda-Mudi di luar akses.');
   if(c.slug==='ibu-ibu'&&!globalIbu)throw Error('Ibu-Ibu di luar akses.');
 }
 if(klass){
   if(klass.audience==='CABERAWIT'&&!(globalCab||!!(classScope?.can_write&&klass.id===classScope.class_id)))throw Error('Kelas Caberawit di luar akses.');
   if(klass.audience==='MUDA_MUDI'&&!globalMm)throw Error('Kelas Muda-Mudi di luar akses.');
 }

 const rows=people.map((p:any)=>{
   let memberships=(p.member_memberships||[]).filter((m:any)=>m.active&&programSlugs.includes(m.categories?.slug)&&canWriteMembership(m));
   for(const category_id of body.category_ids||[]){
     const category=cats?.find(c=>c.id===category_id);
     const existing=memberships.find((m:any)=>m.category_id===category_id);
     if(!existing)memberships.push({category_id,active:true,class_id:category?.slug==='caberawit'?body.class_id||null:null});
   }
   if(klass){
     const category=cats?.find(c=>c.slug===slugByAudience[klass.audience]);
     if(!category)throw Error('Kategori kelas tujuan tidak ditemukan.');
     let has=memberships.some((m:any)=>m.category_id===category.id);
     if(!has&&(body.category_ids||[]).includes(category.id)){memberships.push({category_id:category.id,active:true});has=true}
     if(!has)throw Error('Anggota belum mengikuti kategori kelas tujuan.');
     memberships=memberships.map((m:any)=>m.category_id===category.id?{...m,class_id:klass.id,level_id:klass.level_id}:m);
   }
   return {id:p.id,revision:p.revision,person:p,memberships};
 });
 const{data,error:save}=await s.rpc('save_members_batch',{p_rows:rows});
 return save?NextResponse.json({error:save.message},{status:save.message.includes('CONFLICT')?409:400}):NextResponse.json({updated:data,added:0});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Perubahan gagal.'},{status:400})}}
