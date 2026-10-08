import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {learningReportExport} from '@/lib/learning-report-export';
import {appendReportDetails,replaceReportXml,escapeXml as esc,validateOfficeTemplate,defaultPresentation} from '@/lib/report-template';
import {reportMemberships,reportTargets,snapshotPlacements} from '@/lib/report-scope';
import {latestProgressRows,validDate,summarizeProgress} from '@/lib/domain';
import {AlignmentType,Document,HeadingLevel,Packer,Paragraph,Table,TableCell,TableRow,TextRun} from 'docx';
import {analyzeJson} from '@/lib/gemini';

export const runtime='nodejs';

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
    if(!memberId||!validDate(from)||!validDate(to)||from>to||!['docx','pptx','pdf','xlsx'].includes(format))return NextResponse.json({error:'Individu dan periode wajib dipilih.'},{status:400});

    const s=await db();
    const {data:role}=await s.rpc('current_app_role');if(!['ADMIN','DEWAN_GURU'].includes(role??''))return NextResponse.json({error:'Cetak laporan memerlukan akses pengelola.'},{status:403});
    const member=await s.from('members').select('id,name,class_id,level_id,classes!members_class_id_fkey(name),levels(name),member_categories(categories(slug,name)),member_memberships(*,categories(slug),classes(name),levels(name))').eq('id',memberId).single();
    if(member.error)throw member.error;
    const[att,progress]=await Promise.all([
      s.from('attendance_records').select('event_id,participant_key,status,class_id_snapshot,level_id_snapshot,class_name_snapshot,level_name_snapshot,attendance_events!inner(event_date,audience,state)').eq('member_id',memberId).eq('attendance_events.audience','CABERAWIT').neq('attendance_events.state','CANCELLED').gte('attendance_events.event_date',from).lte('attendance_events.event_date',to),
      s.from('journal_progress').select('participant_key,target_id,created_at,progress_value,progress_note,follow_up,learning_targets(title),journals!inner(journal_date,state,journal_kind,event_id)').eq('participant_key',memberId).eq('journals.state','COMPLETED').eq('journals.journal_kind','CABERAWIT_INDIVIDUAL').gte('journals.journal_date',from).lte('journals.journal_date',to).order('created_at',{ascending:false})
    ]);
    if(att.error||progress.error)throw att.error||progress.error;

    const records=att.data??[];const placements=[...reportMemberships((member.data as any).member_memberships??[],from,to),...snapshotPlacements(records)];if(!placements.length)return NextResponse.json({error:'Tidak ada keikutsertaan Caberawit dalam periode ini.'},{status:400});
    const H=records.filter(x=>x.status==='H').length,I=records.filter(x=>x.status==='I').length,A=records.filter(x=>x.status==='A').length;
    const total=H+I+A;
    const pct=total?Math.round(H/total*1000)/10:null;
    const pr=latestProgressRows(((progress.data??[]) as any[]).filter(p=>{const j=Array.isArray(p.journals)?p.journals[0]:p.journals;return records.some(r=>r.event_id===j?.event_id&&r.participant_key===p.participant_key&&r.status==='H')}));
    const targets=await s.from('learning_targets').select('id,title,class_id,level_id,target_month,active,version_id').eq('active',true);if(targets.error)throw targets.error;
    const versionId=String(b.version_id??'');if(!versionId)return NextResponse.json({error:'Pilih versi target untuk laporan.'},{status:400});
    const assigned=reportTargets(targets.data??[],placements,from,to,versionId);
    const summary=summarizeProgress(assigned.map(t=>t.id),pr);
    const latest=new Map<string,any>();for(const row of pr){if(row.target_id&&!latest.has(row.target_id))latest.set(row.target_id,row)}
    const details=assigned.map(t=>({...latest.get(t.id),learning_targets:{title:t.title}}));
    let notes=pr.slice(0,5).map(x=>`${x.learning_targets?.title?x.learning_targets.title+': ':''}${x.progress_note}`).join(' | ')||'Belum ada catatan progres.';
    if(b.ai_note){
      const result=await analyzeJson<{note:string}>('Tulis satu paragraf catatan perkembangan yang faktual berdasarkan data. Jangan mengarang pencapaian, tanggal, atau diagnosis. Kembalikan JSON {"note":"..."}. Instruksi tambahan pengguna: '+String(b.ai_instruction??'').slice(0,500),{name:member.data.name,attendance:{H,I,A},progress:pr.slice(0,20).map(x=>({target:x.learning_targets?.title,value:x.progress_value,note:x.progress_note}))});
      if(result?.note)notes=String(result.note).slice(0,2000);
      else return NextResponse.json({error:'Catatan otomatis belum tersedia. Coba tanpa catatan otomatis.'},{status:503});
    }
    const m:any=member.data;
    const vals:Record<string,string>={
      NAMA:m.name,PERIODE:`${from} s.d. ${to}`,KELAS:Array.from(new Set(placements.map(p=>p.class_name).filter(Boolean))).join(', ')||'-',JENJANG:Array.from(new Set(placements.map(p=>p.level_name).filter(Boolean))).join(', ')||'-',
      HADIR:String(H),IZIN:String(I),ALFA:String(A),KEHADIRAN:pct===null?'Belum dicatat':`${pct}%`,PROGRES:summary.percentage!==null?`${summary.percentage}% (${summary.assessed}/${summary.assigned} target)`:'Belum ada nilai',CATATAN:notes
    };

    if(b.preview)return NextResponse.json({title:'Laporan Perkembangan Caberawit',values:vals,details:details.map(x=>({target:x.learning_targets.title,value:x.progress_value??null,note:x.progress_note||'Belum dinilai'}))});
    if(format==='pdf'||format==='xlsx'){
      if(b.template_id)return NextResponse.json({error:'Template unggahan khusus Word/PowerPoint; untuk PDF/Excel gunakan format standar.'},{status:400});
      return learningReportExport({
        title:'Laporan Perkembangan Caberawit',values:vals,
        details:details.map(x=>({'Target':x.learning_targets?.title||'Progres','Nilai':x.progress_value??'Belum dinilai','Catatan':x.progress_note||'-'})),
        filename:'laporan-caberawit-'+memberId+'-'+from+'-'+to,
      },format);
    }
    if(b.template_id){
      const t=await s.from('report_templates').select('*').eq('id',b.template_id).eq('active',true).single();
      if(t.error)throw t.error;
      const template:any=t.data;
      if(template.kind!==format)return NextResponse.json({error:'Jenis template tidak sesuai format laporan.'},{status:400});
      if(!template.file_base64)return NextResponse.json({error:'Isi template tidak tersedia.'},{status:400});

      const zip=await validateOfficeTemplate(Buffer.from(template.file_base64,'base64'),format);
      const targets=Object.keys(zip.files).filter(p=>format==='pptx'?/^ppt\/slides\/slide\d+\.xml$/.test(p):/^word\/(document|header\d+|footer\d+)\.xml$/.test(p));
      let replaced=0;
      for(const path of targets){
        const original=await zip.file(path)!.async('string');
        let xml=replaceReportXml(original,vals);
        if(xml!==original)replaced++;
        const mapping=(template.field_map?.mappings??[]) as Array<{path:string;existing:string;field:string}>;
        for(const m of mapping.filter(m=>m.path===path&&Object.hasOwn(vals,m.field))){
          const tag=format==='pptx'?'a:t':'w:t';
          const before=xml;
          xml=xml.replace(`<${tag}>${esc(m.existing)}</${tag}>`,`<${tag}>${esc(vals[m.field])}</${tag}>`);
          if(before!==xml)replaced++;
        }
        zip.file(path,xml);
      }
      if(!replaced)return NextResponse.json({error:'Template tidak memiliki placeholder atau posisi data yang dapat diisi. Tambahkan {{NAMA}}, {{KELAS}}, {{PROGRES}}, lalu unggah ulang.'},{status:400});
      await appendReportDetails(zip,format,[{title:'Perkembangan Target',lines:details.map(x=>`${x.learning_targets.title}: ${x.progress_value??'Belum dinilai'} — ${x.progress_note||'-'}`)}]);
      const out=await zip.generateAsync({type:'uint8array'});
      return response(out,format==='pptx'?'application/vnd.openxmlformats-officedocument.presentationml.presentation':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',`laporan-${m.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.${format}`);
    }

    if(format==='pptx'){const slides=[{title:`Laporan ${m.name}`,lines:Object.entries(vals).filter(([k])=>k!=='CATATAN').map(([k,v])=>`${k}: ${v}`)},{title:'Catatan',lines:[notes]}];for(let i=0;i<details.length;i+=10)slides.push({title:'Perkembangan Target',lines:details.slice(i,i+10).map(x=>`${x.learning_targets.title}: ${x.progress_value??'Belum dinilai'} — ${x.progress_note||'-'}`)});return response(await defaultPresentation(slides),'application/vnd.openxmlformats-officedocument.presentationml.presentation',`laporan-${memberId}.pptx`);}

    const progressRows=details.length?details.map(x=>new TableRow({children:[
      new TableCell({children:[new Paragraph(x.learning_targets?.title||'Progres')]}),
      new TableCell({children:[new Paragraph(x.progress_value==null?'-':String(x.progress_value))]}),
      new TableCell({children:[new Paragraph(x.progress_note||'-')]})
    ]})):[new TableRow({children:[new TableCell({children:[new Paragraph('Belum ada data progres')]}),new TableCell({children:[new Paragraph('-')]}),new TableCell({children:[new Paragraph('-')]})]})];

    const doc=new Document({sections:[{children:[
      new Paragraph({text:'Simpul',heading:HeadingLevel.TITLE,alignment:AlignmentType.CENTER}),
      new Paragraph({text:'Laporan Perkembangan Caberawit',heading:HeadingLevel.HEADING_1,alignment:AlignmentType.CENTER}),
      new Paragraph({text:`Periode ${from} s.d. ${to}`,alignment:AlignmentType.CENTER}),
      new Paragraph({text:''}),
      new Table({rows:[
        new TableRow({children:[new TableCell({children:[new Paragraph('Nama')]}),new TableCell({children:[new Paragraph(m.name)]})]}),
        new TableRow({children:[new TableCell({children:[new Paragraph('Kelas / Jenjang')]}),new TableCell({children:[new Paragraph(`${vals.KELAS} / ${vals.JENJANG}`)]})]}),
        new TableRow({children:[new TableCell({children:[new Paragraph('Kehadiran')]}),new TableCell({children:[new Paragraph(`H ${H} · I ${I} · A ${A} · ${pct===null?'Belum dicatat':pct+'% hadir'}`)]})]})
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
