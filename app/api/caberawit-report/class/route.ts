import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {analyzeJson} from '@/lib/gemini';
import JSZip from 'jszip';
import {Document,Packer,Paragraph,HeadingLevel,Table,TableRow,TableCell} from 'docx';

export const runtime='nodejs';
const esc=(s:unknown)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const cell=(text:string)=>new TableCell({children:[new Paragraph(text)]});

export async function POST(req:NextRequest){
  try{
    const b=await req.json();const classId=String(b.class_id??''),from=String(b.period_start??''),to=String(b.period_end??''),format=String(b.format??'docx');
    if(!classId||!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to||!['docx','pptx'].includes(format))return NextResponse.json({error:'Kelas, periode, atau format tidak valid.'},{status:400});
    const s=await db();const [klass,memberResult]=await Promise.all([s.from('classes').select('id,name,audience').eq('id',classId).single(),s.from('members').select('id,name').eq('class_id',classId).eq('status','ACTIVE').order('name')]);
    if(klass.error||memberResult.error)throw klass.error||memberResult.error;
    if(klass.data.audience!=='CABERAWIT')return NextResponse.json({error:'Laporan kelas khusus Jabirawit.'},{status:400});
    const members=memberResult.data??[],ids=members.map(m=>m.id);
    const [att,progress]=await Promise.all([
      ids.length?s.from('attendance_records').select('member_id,status,attendance_events!inner(event_date,audience)').in('member_id',ids).eq('attendance_events.audience','CABERAWIT').gte('attendance_events.event_date',from).lte('attendance_events.event_date',to):Promise.resolve({data:[],error:null}),
      ids.length?s.from('journal_progress').select('member_id,target_id,progress_value,progress_note,journals!inner(journal_date)').in('member_id',ids).gte('journals.journal_date',from).lte('journals.journal_date',to).order('created_at',{ascending:false}):Promise.resolve({data:[],error:null})
    ]);
    if(att.error||progress.error)throw att.error||progress.error;
    const records=att.data??[],pr=(progress.data??[]) as Array<{member_id:string;target_id:string|null;progress_value:number|null;progress_note:string}>;
    const perMember=members.map(m=>{
      const a=records.filter(r=>r.member_id===m.id);const H=a.filter(r=>r.status==='H').length,I=a.filter(r=>r.status==='I').length,A=a.filter(r=>r.status==='A').length;
      const latest=new Map<string,number>();for(const p of pr.filter(p=>p.member_id===m.id)){const key=p.target_id||p.progress_note;if(!latest.has(key)&&p.progress_value!==null)latest.set(key,Number(p.progress_value))}
      const values=Array.from(latest.values());return {name:m.name,H,I,A,attendance:H+I+A?Math.round(H/(H+I+A)*100):0,progress:values.length?Math.round(values.reduce((x,y)=>x+y,0)/values.length):0};
    });
    const H=records.filter(r=>r.status==='H').length,I=records.filter(r=>r.status==='I').length,A=records.filter(r=>r.status==='A').length;
    const pct=H+I+A?Math.round(H/(H+I+A)*100):0;
    const avg=perMember.length?Math.round(perMember.reduce((sum,p)=>sum+p.progress,0)/perMember.length):0;
    let note=String(b.note??'').slice(0,1500)||'Ringkasan perkembangan disusun dari data jurnal individu.';
    if(b.ai_note){const ai=await analyzeJson<{note:string}>('Tulis satu paragraf laporan kelas yang faktual. Jangan mengarang pencapaian, diagnosis, atau saran klinis. Kembalikan JSON {"note":"..."}. Petunjuk tambahan: '+String(b.ai_instruction??'').slice(0,500),{class_name:klass.data.name,period:{from,to},attendance:{H,I,A},individuals:perMember,notes:pr.slice(0,30).map(p=>p.progress_note)});if(!ai?.note)return NextResponse.json({error:'Gemini belum tersedia. Coba tanpa catatan AI.'},{status:503});note=String(ai.note).slice(0,2000)}
    const vals:Record<string,string>={KELAS:klass.data.name,PERIODE:`${from} s.d. ${to}`,JUMLAH:String(members.length),HADIR:String(H),IZIN:String(I),ALFA:String(A),KEHADIRAN:`${pct}%`,PROGRES:`${avg}%`,CATATAN:note,NAMA:klass.data.name,JENJANG:'Jabirawit'};
    let bytes:Uint8Array;
    if(b.template_id){
      const t=await s.from('report_templates').select('*').eq('id',b.template_id).eq('active',true).single();if(t.error)throw t.error;
      if(t.data.kind!==format||!t.data.file_base64)return NextResponse.json({error:'Template tidak sesuai format.'},{status:400});
      const zip=await JSZip.loadAsync(Buffer.from(t.data.file_base64,'base64'));let replaced=0;
      const paths=Object.keys(zip.files).filter(path=>format==='pptx'?/^ppt\/slides\/slide\d+\.xml$/.test(path):/^word\/(document|header\d+|footer\d+)\.xml$/.test(path));
      for(const path of paths){let xml=await zip.file(path)!.async('string');for(const[k,v]of Object.entries(vals)){const token=`{{${k}}}`;if(xml.includes(token)){xml=xml.split(token).join(esc(v));replaced++}}for(const map of t.data.field_map?.mappings??[]){if(map.path!==path||!Object.hasOwn(vals,map.field))continue;const tag=format==='pptx'?'a:t':'w:t';const old=`<${tag}>${esc(map.existing)}</${tag}>`;if(xml.includes(old)){xml=xml.replace(old,`<${tag}>${esc(vals[map.field])}</${tag}>`);replaced++}}zip.file(path,xml)}
      if(!replaced)return NextResponse.json({error:'Template tidak memiliki posisi data yang dapat diisi. Tambahkan placeholder seperti {{KELAS}}, {{PROGRES}}, atau unggah ulang untuk dipetakan.'},{status:400});
      bytes=await zip.generateAsync({type:'uint8array'});
    }else{
      if(format==='pptx')return NextResponse.json({error:'Pilih template PPTX untuk laporan kelas.'},{status:400});
      const rows=[
        new TableRow({children:['Nama','H','I','A','Kehadiran','Progres'].map(cell)}),
        ...perMember.map(p=>new TableRow({children:[p.name,String(p.H),String(p.I),String(p.A),`${p.attendance}%`,`${p.progress}%`].map(cell)}))
      ];
      const doc=new Document({sections:[{children:[
        new Paragraph({text:'Laporan Kelas Jabirawit',heading:HeadingLevel.TITLE}),
        new Paragraph(`${klass.data.name} · ${from} s.d. ${to}`),
        new Paragraph({text:'Ringkasan',heading:HeadingLevel.HEADING_2}),
        new Paragraph(`${members.length} anggota · Kehadiran ${pct}% · Progres ${avg}%`),
        new Paragraph(note),
        new Paragraph({text:'Rincian individu',heading:HeadingLevel.HEADING_2}),
        new Table({rows})
      ]}]});
      bytes=new Uint8Array(await Packer.toBuffer(doc));
    }
    return new Response(bytes as unknown as BodyInit,{headers:{'Content-Type':format==='pptx'?'application/vnd.openxmlformats-officedocument.presentationml.presentation':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':`attachment; filename="laporan-kelas-${from}-${to}.${format}"`,'Cache-Control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal membuat laporan kelas.'},{status:400})}
}
