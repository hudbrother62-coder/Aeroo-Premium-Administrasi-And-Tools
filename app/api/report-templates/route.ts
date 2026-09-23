import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';

export const runtime='nodejs';

export async function GET(){
  const s=await db();
  const{data,error}=await s.from('report_templates').select('id,name,kind,file_name,active,created_at').eq('active',true).order('created_at',{ascending:false});
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data??[]);
}

export async function POST(req:NextRequest){
  try{
    const form=await req.formData();
    const file=form.get('file');
    const name=String(form.get('name')??'').trim();
    const kind=String(form.get('kind')??'').toLowerCase();
    if(!(file instanceof File)||!name||!['pptx','docx'].includes(kind))return NextResponse.json({error:'Template tidak valid.'},{status:400});
    if(file.size>8*1024*1024)return NextResponse.json({error:'Ukuran template maksimal 8 MB.'},{status:400});
    if(!file.name.toLowerCase().endsWith('.'+kind))return NextResponse.json({error:`File harus berformat .${kind}`},{status:400});

    const s=await db();
    const base64=Buffer.from(await file.arrayBuffer()).toString('base64');
    const{data,error}=await s.from('report_templates').insert({
      name,kind,file_path:'database:'+file.name,file_name:file.name,file_base64:base64,mime_type:file.type||null,field_map:{placeholders:['NAMA','PERIODE','KELAS','JENJANG','HADIR','IZIN','ALFA','KEHADIRAN','PROGRES','CATATAN']},active:true
    }).select('id,name,kind,file_name,active,created_at').single();
    return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data,{status:201});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Upload template gagal.'},{status:400});
  }
}
