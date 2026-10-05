import {readWorkbook,excelDate} from '@/lib/spreadsheet';
import {validDate} from '@/lib/domain';
import {publicProjection} from '@/lib/public-read';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import * as XLSX from 'xlsx';
import {analyzeJson} from '@/lib/gemini';

export const runtime='nodejs';

const norm=(v:unknown)=>String(v??'').trim();
const low=(v:unknown)=>norm(v).toLowerCase().replace(/[_-]+/g,' ');

function findCol(headers:string[],patterns:RegExp[]){
  const idx=headers.findIndex(h=>patterns.some(p=>p.test(low(h))));
  return idx>=0?idx:null;
}

function inferLevel(text:string){
  const s=low(text);
  if(s.includes('remaja'))return 'Remaja';
  if(s.includes('produktif'))return 'Generasi Produktif';
  if(s.includes('paud')||s.includes('tk'))return 'PAUD';
  const m=s.match(/(?:sd|kelas|grade)?\s*([1-6])\b/);
  return m?`SD ${m[1]}`:'Umum';
}

export async function GET(req:NextRequest){
  if(req.nextUrl.searchParams.get('template')==='1'){
    const book=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Bulan','Jenjang','Kelas','Kode','Target / Materi','Deskripsi','Nilai target','Satuan'],['2026-10','SD 1','', 'T-01','Contoh materi','','100','%'],['2026-11','Remaja','','T-02','Contoh materi','','100','%']]),'Target');
    return new Response(XLSX.write(book,{type:'buffer',bookType:'xlsx'}),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="template-target-enam-bulan.xlsx"'}});
  }
  const projection=await publicProjection(req,'versions');if(projection)return projection;
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

    const authDb=await db();const {data:role}=await authDb.rpc('current_app_role');if(!['ADMIN','DEWAN_GURU'].includes(role||''))return NextResponse.json({error:'Akses input ditolak.'},{status:403});
    if(period_start&&!validDate(period_start)||period_end&&!validDate(period_end)||period_start&&period_end&&period_end<period_start)throw Error('Periode tidak valid.');
    const wb=await readWorkbook(file);
    const sheet=wb.Sheets[wb.SheetNames[0]];
    const rawRows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:''}) as unknown[][];const rows=rawRows.map(r=>r.map(norm));if(rows.length>3020)throw Error('Maksimal 3000 baris target.');
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
      month:findCol(headers,[/^bulan$/,/target bulan/,/month/]),
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
    const ai=await analyzeJson<{columns:Record<string,string>}>('Identifikasi kolom target pembelajaran pada spreadsheet. Kembalikan JSON {"columns":{"month":"header asli", "level":"header asli", "className":"header asli", "code":"header asli", "title":"header asli", "description":"header asli", "value":"header asli", "unit":"header asli"}}. Isi hanya header yang benar-benar ada.',{headers,sample:rows.slice(headerRow+1,headerRow+5)});
    if(ai?.columns)for(const key of Object.keys(cols) as Array<keyof typeof cols>){const index=headers.indexOf(ai.columns[key]);if(index>=0)cols[key]=index}

    const s=await db();
    const[{data:levels,error:lErr},{data:classes,error:cErr},{data:latest,error:vErr}]=await Promise.all([
      s.from('levels').select('id,name'),
      s.from('classes').select('id,name,audience,level_id'),
      s.from('target_versions').select('version').order('version',{ascending:false}).limit(1)
    ]);
    if(lErr||cErr||vErr)throw lErr||cErr||vErr;

    const levelMap=new Map((levels??[]).map(x=>[x.name.toLowerCase(),x.id]));
    const classMap=new Map((classes??[]).map(x=>[x.name.toLowerCase(),x.id]));
    const versionNumber=(latest?.[0]?.version??0)+1;
    const analysis={sheet:wb.SheetNames[0],header_row:headerRow+1,columns:Object.fromEntries(Object.entries(cols).filter(([,v])=>v!==null).map(([k,v])=>[k,headers[v as number]])),rows:rows.length-headerRow-1,method:ai?'gemini_assisted_mapping':'automatic_structure_detection'};

    const payload:any[]=[];
    for(let i=headerRow+1;i<rows.length;i++){
      const row=rows[i];
      const target=norm(row[cols.title!]);
      if(!target)continue;
      const rawLevel=cols.level!==null?row[cols.level]:'';const levelName=levelMap.has(rawLevel.toLowerCase())?rawLevel:inferLevel(rawLevel);
      const level_id=levelMap.get(levelName.toLowerCase());if(!level_id||!rawLevel)throw Error(`Baris ${i+1}: jenjang tidak ditemukan.`);
      const className=cols.className!==null?norm(row[cols.className]):'';
      const rawValue=cols.value!==null?norm(row[cols.value]):'';
      const rawMonth=cols.month!==null?norm(row[cols.month]):period_start??'';
      const monthValue=cols.month!==null?rawRows[i][cols.month]:rawMonth;const targetMonth=/^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth)?rawMonth+'-01':excelDate(monthValue)?.slice(0,7)+'-01';if(!targetMonth||!validDate(targetMonth))throw Error(`Baris ${i+1}: bulan wajib diisi.`);
      if(className&&!(classes||[]).some(k=>k.name.toLowerCase()===className.toLowerCase()&&k.level_id===level_id&&['CABERAWIT','MUDA_MUDI'].includes(k.audience)))throw Error(`Baris ${i+1}: kelas tidak sesuai jenjang.`);if(className&&(classes||[]).filter(k=>k.name.toLowerCase()===className.toLowerCase()).length!==1)throw Error(`Baris ${i+1}: nama kelas ambigu.`);
      if(rawValue&&!Number.isFinite(Number(rawValue.replace(',','.'))))throw Error(`Baris ${i+1}: nilai target tidak valid.`);
      const num=rawValue?Number(String(rawValue).replace(',','.')):NaN;
      payload.push({
        level_id,class_id:className?classMap.get(className.toLowerCase())||null:null,
        code:cols.code!==null?norm(row[cols.code])||null:null,
        target_month:targetMonth,
        title:target,description:cols.description!==null?norm(row[cols.description])||null:null,
        target_value:Number.isFinite(num)?num:null,target_unit:cols.unit!==null?norm(row[cols.unit])||null:null,
        sort_order:payload.length+1,active:true,source_metadata:{sheet:wb.SheetNames[0],row:i+1}
      });
    }
    if(!payload.length)throw Error('Tidak menemukan target yang dapat dibaca.');
    const{data,error:saveError}=await s.rpc('import_target_version',{p_meta:{title,period_start,period_end,source_file_name:file.name,source_structure:{headers},analysis},p_targets:payload});if(saveError)throw Error(saveError.message);return NextResponse.json(data);
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal menganalisis Excel.'},{status:400})}
}
