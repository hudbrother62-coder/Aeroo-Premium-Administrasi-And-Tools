import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import JSZip from 'jszip';
import {AlignmentType,Document,HeadingLevel,Packer,Paragraph,Table,TableCell,TableRow,TextRun} from 'docx';

export const runtime='nodejs';

function esc(s:unknown){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function replaceAllXml(xml:string,values:Record<string,string>){
  let out=xml;
  for(const[k,v]of Object.entries(values)){
    out=out.split(`{{${k}}}`).join(esc(v));
  }
  return out;
}
function response(body:Uint8Array,contentType:string,fileName:string){
  return new Response(body as unknown as BodyInit,{headers:{'Content-Type':contentType,'Content-Disposition':`attachment; filename="${fileName}"`,'Cache-Control':'no-store'}});
}

export async function POST(req:NextRequest){
  try{
    const b=await req.json();
    const memberId=String(b.member_id??'');
    const from=String(b.period_start??'');
    const to=String(b.period_end??'');
    const format=String(b.format??'docx');
    if(!memberId||!from||!to)return NextResponse.json({error:'Individu dan periode wajib dipilih.'},{status:400});

    const s=await db();
    const member=await s.from('members').select('id,name,classes(name),levels(name),member_categories(categories(slug,name))').eq('id',memberId).single();
    if(member.error)throw member.error;
    const isCaberawit=(member.data as any).member_categories?.some((c:any)=>c.categories?.slug==='caberawit');
    if(!isCaberawit)return NextResponse.json({error:'Laporan hanya tersedia untuk data Caberawit.'},{status:400});

    const[att,progress]=await Promise.all([
      s.from('attendance_records').select('status,attendance_events!inner(event_date,audience)').eq('member_id',memberId).eq('attendance_events.audience','CABERAWIT').gte('attendance_events.event_date',from).lte('attendance_events.event_date',to),
      s.from('journal_progress').select('progress_value,progress_note,follow_up,learning_targets(title),journals!inner(journal_date)').eq('member_id',memberId).gte('journals.journal_date',from).lte('journals.journal_date',to).order('created_at',{ascending:false})
    ]);
    if(att.error||progress.error)throw att.error||progress.error;

    const records=att.data??[];
    const H=records.filter(x=>x.status==='H').length,I=records.filter(x=>x.status==='I').length,A=records.filter(x=>x.status==='A').length;
    const total=H+I+A;
    const pct=total?Math.round(H/total*1000)/10:0;
    const pr=(progress.data??[]) as any[];
    const values=pr.map(x=>Number(x.progress_value)).filter(Number.isFinite);
    const avg=values.length?Math.round(values.reduce((a,c)=>a+c,0)/values.length*10)/10:0;
    const notes=pr.slice(0,5).map(x=>`${x.learning_targets?.title?x.learning_targets.title+': ':''}${x.progress_note}`).join(' | ')||'Belum ada catatan progres.';
    const m:any=member.data;
    const vals:Record<string,string>={
      NAMA:m.name,PERIODE:`${from} s.d. ${to}`,KELAS:m.classes?.name||'-',JENJANG:m.levels?.name||'-',
      HADIR:String(H),IZIN:String(I),ALFA:String(A),KEHADIRAN:`${pct}%`,PROGRES:values.length?`${avg}%`:'Belum ada nilai',CATATAN:notes
    };

    if(b.template_id){
      const t=await s.from('report_templates').select('*').eq('id',b.template_id).eq('active',true).single();
      if(t.error)throw t.error;
      const template:any=t.data;
      if(template.kind!==format)return NextResponse.json({error:'Jenis template tidak sesuai format laporan.'},{status:400});
      if(!template.file_base64)return NextResponse.json({error:'Isi template tidak tersedia.'},{status:400});

      const zip=await JSZip.loadAsync(Buffer.from(template.file_base64,'base64'));
      const targets=Object.keys(zip.files).filter(p=>format==='pptx'?/^ppt\/slides\/slide\d+\.xml$/.test(p):/^word\/(document|header\d+|footer\d+)\.xml$/.test(p));
      for(const path of targets){
        const xml=await zip.file(path)!.async('string');
        zip.file(path,replaceAllXml(xml,vals));
      }
      const out=await zip.generateAsync({type:'uint8array'});
      return response(out,format==='pptx'?'application/vnd.openxmlformats-officedocument.presentationml.presentation':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',`laporan-${m.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.${format}`);
    }

    if(format==='pptx')return NextResponse.json({error:'PowerPoint memerlukan template PPTX.'},{status:400});

    const progressRows=pr.length?pr.slice(0,12).map(x=>new TableRow({children:[
      new TableCell({children:[new Paragraph(x.learning_targets?.title||'Progres')]}),
      new TableCell({children:[new Paragraph(x.progress_value==null?'-':String(x.progress_value))]}),
      new TableCell({children:[new Paragraph(x.progress_note||'-')]})
    ]})):[new TableRow({children:[new TableCell({children:[new Paragraph('Belum ada data progres')]}),new TableCell({children:[new Paragraph('-')]}),new TableCell({children:[new Paragraph('-')]})]})];

    const doc=new Document({sections:[{children:[
      new Paragraph({text:'AEROO',heading:HeadingLevel.TITLE,alignment:AlignmentType.CENTER}),
      new Paragraph({text:'Laporan Perkembangan Caberawit',heading:HeadingLevel.HEADING_1,alignment:AlignmentType.CENTER}),
      new Paragraph({text:`Periode ${from} s.d. ${to}`,alignment:AlignmentType.CENTER}),
      new Paragraph({text:''}),
      new Table({rows:[
        new TableRow({children:[new TableCell({children:[new Paragraph('Nama')]}),new TableCell({children:[new Paragraph(m.name)]})]}),
        new TableRow({children:[new TableCell({children:[new Paragraph('Kelas / Jenjang')]}),new TableCell({children:[new Paragraph(`${m.classes?.name||'-'} / ${m.levels?.name||'-'}`)]})]}),
        new TableRow({children:[new TableCell({children:[new Paragraph('Kehadiran')]}),new TableCell({children:[new Paragraph(`H ${H} · I ${I} · A ${A} · ${pct}% hadir`)]})]})
      ]}),
      new Paragraph({text:'Perkembangan Target',heading:HeadingLevel.HEADING_2}),
      new Table({rows:[
        new TableRow({children:[new TableCell({children:[new Paragraph({children:[new TextRun({text:'Target',bold:true})]})]}),new TableCell({children:[new Paragraph({children:[new TextRun({text:'Nilai',bold:true})]})]}),new TableCell({children:[new Paragraph({children:[new TextRun({text:'Catatan',bold:true})]})]})]}),
        ...progressRows
      ]}),
      new Paragraph({text:''}),
      new Paragraph({text:'Ringkasan',heading:HeadingLevel.HEADING_2}),
      new Paragraph(notes)
    ]}]});
    const out=await Packer.toBuffer(doc);
    return response(new Uint8Array(out),'application/vnd.openxmlformats-officedocument.wordprocessingml.document',`laporan-${m.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.docx`);
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Gagal membuat laporan.'},{status:400});
  }
}
