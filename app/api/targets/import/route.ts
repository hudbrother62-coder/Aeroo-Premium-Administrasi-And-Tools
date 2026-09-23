import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import * as XLSX from 'xlsx';

export const runtime='nodejs';

const norm=(v:unknown)=>String(v??'').trim();
const low=(v:unknown)=>norm(v).toLowerCase().replace(/[_-]+/g,' ');

function findCol(headers:string[],patterns:RegExp[]){
  const idx=headers.findIndex(h=>patterns.some(p=>p.test(low(h))));
  return idx>=0?idx:null;
}

function inferLevel(text:string){
  const s=low(text);
  if(s.includes('paud')||s.includes('tk'))return 'PAUD';
  const m=s.match(/(?:sd|kelas|grade)?\s*([1-6])\b/);
  return m?`SD ${m[1]}`:'Umum';
}

export async function GET(){
  const s=await db();
  const{data,error}=await s.from('target_versions').select('*').order('created_at',{ascending:false});
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data??[]);
}

export async function POST(req:NextRequest){
  try{
    const form=await req.formData();
    const file=form.get('file');
    if(!(file instanceof File))return NextResponse.json({error:'File Excel wajib dipilih.'},{status:400});
    const title=norm(form.get('title'))||file.name;
    const period_start=norm(form.get('period_start'))||null;
    const period_end=norm(form.get('period_end'))||null;

    const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
    const sheet=wb.Sheets[wb.SheetNames[0]];
    const rows=(XLSX.utils.sheet_to_json(sheet,{header:1,defval:''}) as unknown[][]).map(r=>r.map(norm));
    if(!rows.length)return NextResponse.json({error:'Excel kosong.'},{status:400});

    let headerRow=0,best=-1;
    for(let i=0;i<Math.min(rows.length,20);i++){
      const joined=rows[i].map(low).join(' ');
      let score=rows[i].filter(Boolean).length;
      for(const k of ['target','materi','jenjang','kelas','kode','capaian','deskripsi','satuan'])if(joined.includes(k))score+=3;
      if(score>best){best=score;headerRow=i}
    }
    const headers=rows[headerRow].map(norm);
    const cols={
      level:findCol(headers,[/jenjang/,/grade/,/tingkat/]),
      className:findCol(headers,[/^kelas$/,/nama kelas/]),
      code:findCol(headers,[/kode/,/^code$/]),
      title:findCol(headers,[/target/,/materi/,/capaian/,/kompetensi/,/judul/]),
      description:findCol(headers,[/deskripsi/,/keterangan/,/indikator/,/uraian/]),
      value:findCol(headers,[/nilai target/,/target value/,/jumlah/]),
      unit:findCol(headers,[/satuan/,/unit/])
    };
    if(cols.title===null){
      const firstUseful=headers.findIndex(Boolean);
      cols.title=firstUseful>=0?firstUseful:0;
    }

    const s=await db();
    const[{data:levels,error:lErr},{data:classes,error:cErr},{data:latest,error:vErr}]=await Promise.all([
      s.from('levels').select('id,name'),
      s.from('classes').select('id,name,audience'),
      s.from('target_versions').select('version').order('version',{ascending:false}).limit(1)
    ]);
    if(lErr||cErr||vErr)throw lErr||cErr||vErr;

    const levelMap=new Map((levels??[]).map(x=>[x.name.toLowerCase(),x.id]));
    const classMap=new Map((classes??[]).map(x=>[x.name.toLowerCase(),x.id]));
    const versionNumber=(latest?.[0]?.version??0)+1;
    const analysis={sheet:wb.SheetNames[0],header_row:headerRow+1,columns:Object.fromEntries(Object.entries(cols).filter(([,v])=>v!==null).map(([k,v])=>[k,headers[v as number]])),rows:rows.length-headerRow-1,method:'automatic_structure_detection'};

    const{data:version,error:verError}=await s.from('target_versions').insert({
      title,period_start,period_end,version:versionNumber,source_file_name:file.name,source_structure:{headers},analysis,published_at:new Date().toISOString()
    }).select().single();
    if(verError)throw verError;

    const payload:any[]=[];
    for(let i=headerRow+1;i<rows.length;i++){
      const row=rows[i];
      const target=norm(row[cols.title!]);
      if(!target)continue;
      const levelName=inferLevel(cols.level!==null?row[cols.level]:cols.className!==null?row[cols.className]:'');
      const level_id=levelMap.get(levelName.toLowerCase())||levelMap.get('umum');
      if(!level_id)continue;
      const className=cols.className!==null?norm(row[cols.className]):'';
      const rawValue=cols.value!==null?norm(row[cols.value]):'';
      const num=rawValue?Number(String(rawValue).replace(',','.')):NaN;
      payload.push({
        version_id:version.id,level_id,class_id:className?classMap.get(className.toLowerCase())||null:null,
        code:cols.code!==null?norm(row[cols.code])||null:null,
        title:target,description:cols.description!==null?norm(row[cols.description])||null:null,
        target_value:Number.isFinite(num)?num:null,target_unit:cols.unit!==null?norm(row[cols.unit])||null:null,
        sort_order:payload.length+1,active:true,source_metadata:{sheet:wb.SheetNames[0],row:i+1}
      });
    }
    if(!payload.length){
      await s.from('target_versions').delete().eq('id',version.id);
      return NextResponse.json({error:'Tidak menemukan baris target yang dapat dibaca.'},{status:400});
    }
    const{error:insertError}=await s.from('learning_targets').insert(payload);
    if(insertError){
      await s.from('target_versions').delete().eq('id',version.id);
      throw insertError;
    }
    return NextResponse.json({version_id:version.id,inserted:payload.length,analysis});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Gagal menganalisis Excel.'},{status:400});
  }
}
