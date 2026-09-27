import {NextRequest,NextResponse} from 'next/server';
import * as XLSX from 'xlsx';
import {db} from '@/lib/supabase-server';

export const runtime='nodejs';
const columns=['Nama','Jenis Kelamin','Tempat Lahir','Tanggal Lahir','Nomor HP','Alamat','Jenjang','Kelas','Bagian Pengurus','Kategori (pisahkan koma)','Catatan'];
function workbook(rows:unknown[][],name:string){
  const sheet=XLSX.utils.aoa_to_sheet(rows);
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Anggota');
  const bytes=XLSX.write(book,{type:'buffer',bookType:'xlsx'});
  return new Response(bytes,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${name}"`}});
}
const norm=(v:unknown)=>String(v??'').trim();

export async function GET(req:NextRequest){
  if(req.nextUrl.searchParams.get('template')==='1')return workbook([columns,['Contoh Nama','L','Malang','2010-01-01','08123456789','Alamat lengkap','SD 1','Kelas A','Sekretariat','Caberawit, Kelompok','']], 'template-anggota-airo.xlsx');
  const s=await db();const {data:role}=await s.rpc('current_app_role');
  if(!role)return NextResponse.json({error:'Login diperlukan.'},{status:401});
  const {data,error}=await s.from('members').select('*,levels(name),classes(name),member_categories(categories(name))').eq('status','ACTIVE').order('name');
  if(error)return NextResponse.json({error:error.message},{status:400});
  const rows=[columns,...(data??[]).map((m:any)=>[m.name,m.gender,m.birth_place,m.birth_date,m.phone,m.address,m.levels?.name,m.classes?.name,m.section,m.member_categories?.map((c:any)=>c.categories?.name).filter(Boolean).join(', '),m.notes])];
  if(req.nextUrl.searchParams.get('format')==='csv'){
    const csv='\ufeff'+rows.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
    return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="anggota-airo.csv"'}});
  }
  return workbook(rows,'anggota-airo.xlsx');
}

export async function POST(req:NextRequest){
  const s=await db();const {data:role}=await s.rpc('current_app_role');
  if(!['ADMIN','DEWAN_GURU','KELOMPOK'].includes(role??''))return NextResponse.json({error:'Akses input ditolak.'},{status:403});
  const form=await req.formData();const file=form.get('file');
  if(!(file instanceof File)||file.size>5_000_000)return NextResponse.json({error:'Pilih file XLSX maksimal 5 MB.'},{status:400});
  try{
    const book=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
    const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(book.Sheets[book.SheetNames[0]],{defval:''});
    if(rows.length>500)return NextResponse.json({error:'Maksimal 500 anggota per impor.'},{status:400});
    const [catRes,levRes,classRes]=await Promise.all([s.from('categories').select('id,name,slug'),s.from('levels').select('id,name'),s.from('classes').select('id,name')]);
    if(catRes.error||levRes.error||classRes.error)throw catRes.error||levRes.error||classRes.error;
    const categories=catRes.data??[],levels=levRes.data??[],classes=classRes.data??[];
    const allowed=role==='ADMIN'?['kelompok','muda-mudi','caberawit','ibu-ibu','pengurus']:role==='DEWAN_GURU'?['caberawit','muda-mudi']:['kelompok','ibu-ibu','pengurus'];
    let inserted=0;const errors:string[]=[];
    for(let i=0;i<rows.length;i++){
      const row=rows[i],name=norm(row['Nama']);if(!name){errors.push(`Baris ${i+2}: nama kosong.`);continue}
      const categoryNames=norm(row['Kategori (pisahkan koma)']).split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
      const selected=categoryNames.map(v=>categories.find(c=>c.name.toLowerCase()===v||c.slug===v));
      if(!selected.length||selected.some(x=>!x||!allowed.includes(x.slug))){errors.push(`Baris ${i+2}: kategori tidak valid atau di luar akses.`);continue}
      const level=levels.find(x=>x.name.toLowerCase()===norm(row['Jenjang']).toLowerCase());
      const classRow=classes.find(x=>x.name.toLowerCase()===norm(row['Kelas']).toLowerCase());
      const {data,error}=await s.from('members').insert({name,gender:norm(row['Jenis Kelamin'])||null,birth_place:norm(row['Tempat Lahir'])||null,birth_date:norm(row['Tanggal Lahir'])||null,phone:norm(row['Nomor HP'])||null,address:norm(row['Alamat'])||null,level_id:level?.id??null,class_id:classRow?.id??null,section:norm(row['Bagian Pengurus'])||null,notes:norm(row['Catatan'])||null,status:'ACTIVE'}).select('id').single();
      if(error){errors.push(`Baris ${i+2}: ${error.message}`);continue}
      const {error:categoryError}=await s.from('member_categories').insert(selected.map(c=>({member_id:data.id,category_id:c!.id})));
      if(categoryError){await s.from('members').delete().eq('id',data.id);errors.push(`Baris ${i+2}: ${categoryError.message}`);continue}
      inserted++;
    }
    return NextResponse.json({inserted,errors});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'File tidak dapat dibaca.'},{status:400})}
}
