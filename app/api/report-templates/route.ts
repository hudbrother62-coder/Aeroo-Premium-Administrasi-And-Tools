import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {analyzeJson} from '@/lib/gemini';
import {validateOfficeTemplate} from '@/lib/report-template';

export const runtime='nodejs';

export async function GET(){
  const s=await db();
  const{data,error}=await s.from('report_templates').select('id,name,kind,file_name,field_map,active,created_at').eq('active',true).order('created_at',{ascending:false});
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
    const {data:role}=await s.rpc('current_app_role');
    if(!['ADMIN','DEWAN_GURU'].includes(role??''))return NextResponse.json({error:'Hanya owner dan dewan guru dapat mengunggah template.'},{status:403});
    const bytes=Buffer.from(await file.arrayBuffer());
    const zip=await validateOfficeTemplate(bytes,kind);
    const entries=Object.keys(zip.files).filter(p=>kind==='pptx'?/^ppt\/slides\/slide\d+\.xml$/.test(p):p==='word/document.xml');
    const textItems:Record<string,string[]>={};
    for(const path of entries){
      const xml=await zip.file(path)!.async('string');
      const tags=kind==='pptx'?xml.matchAll(/<a:t>([^<]*)<\/a:t>/g):xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g);
      textItems[path]=Array.from(tags,x=>x[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')).filter(Boolean).slice(0,120);
    }
    const allowed=['JUMLAH','NAMA','PERIODE','KELAS','JENJANG','HADIR','IZIN','ALFA','KEHADIRAN','PROGRES','CATATAN'];
    type Mapping={path:string;existing:string;field:string};
    const analysis=await analyzeJson<{mappings:Mapping[]}>('Petakan label atau teks contoh pada template laporan ke field yang tepat. Kembalikan JSON {"mappings":[{"path":"path asli","existing":"teks persis pada satu blok","field":"NAMA|PERIODE|KELAS|JENJANG|HADIR|IZIN|ALFA|KEHADIRAN|PROGRES|CATATAN"}]}. Hanya gunakan teks yang terlihat di data; jangan menebak isi data pribadi. Abaikan placeholder {{FIELD}} yang sudah eksplisit.',textItems);
    const mappings=Array.isArray(analysis?.mappings)?analysis.mappings.filter(m=>allowed.includes(m.field)&&textItems[m.path]?.includes(m.existing)&&!m.existing.includes('{{')).slice(0,80):[];
    const base64=Buffer.from(await file.arrayBuffer()).toString('base64');
    const{data,error}=await s.from('report_templates').insert({
      name,kind,file_path:'database:'+file.name,file_name:file.name,file_base64:base64,mime_type:file.type||null,field_map:{placeholders:allowed,mappings,method:analysis?'gemini_mapping':'explicit_placeholders',slide_count:entries.length},active:true
    }).select('id,name,kind,file_name,field_map,active,created_at').single();
    return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data,{status:201});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Upload template gagal.'},{status:400});
  }
}

export async function PATCH(req:NextRequest){
 try{const b=await req.json();if(!b.id||(!(typeof b.name==='string'&&b.name.trim())&&typeof b.active!=='boolean'))return NextResponse.json({error:'Perubahan template tidak valid.'},{status:400});const s=await db();const {data:role}=await s.rpc('current_app_role');if(!['ADMIN','DEWAN_GURU'].includes(role??''))return NextResponse.json({error:'Akses pengelola diperlukan.'},{status:403});const changes:{name?:string;active?:boolean}={};if(typeof b.name==='string')changes.name=b.name.trim().slice(0,120);if(typeof b.active==='boolean')changes.active=b.active;const {data,error}=await s.from('report_templates').update(changes).eq('id',b.id).select('id,name,kind,active').single();return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal mengubah template.'},{status:400})}
}
