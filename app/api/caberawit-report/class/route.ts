import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase-server';
import {analyzeJson} from '@/lib/gemini';
import {appendReportDetails,replaceReportXml,validateOfficeTemplate,defaultPresentation} from '@/lib/report-template';
import {reportMemberships,reportTargets,snapshotPlacements} from '@/lib/report-scope';
import {latestProgressRows,validDate,summarizeProgress} from '@/lib/domain';
import {Document,Packer,Paragraph,HeadingLevel,Table,TableRow,TableCell} from 'docx';

export const runtime='nodejs';
const esc=(s:unknown)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const cell=(text:string)=>new TableCell({children:[new Paragraph(text)]});

export async function POST(req:NextRequest){
  try{
    const b=await req.json();const classId=String(b.class_id??''),from=String(b.period_start??''),to=String(b.period_end??''),format=String(b.format??'docx');
    if(!classId||!validDate(from)||!validDate(to)||from>to||!['docx','pptx'].includes(format))return NextResponse.json({error:'Kelas, periode, atau format tidak valid.'},{status:400});
    const s=await db();const {data:role}=await s.rpc('current_app_role');if(!['ADMIN','DEWAN_GURU'].includes(role??''))return NextResponse.json({error:'Cetak laporan memerlukan akses pengelola.'},{status:403});const [klass,memberResult,att]=await Promise.all([
      s.from('classes').select('id,name,audience').eq('id',classId).single(),
      s.from('members').select('id,name,member_memberships(*,categories(slug),classes(name),levels(name))'),
      s.from('attendance_records').select('event_id,member_id,participant_key,member_name_snapshot,status,class_id_snapshot,level_id_snapshot,class_name_snapshot,level_name_snapshot,attendance_events!inner(event_date,audience,state)').eq('class_id_snapshot',classId).eq('attendance_events.audience','CABERAWIT').neq('attendance_events.state','CANCELLED').gte('attendance_events.event_date',from).lte('attendance_events.event_date',to)
    ]);
    if(klass.error||memberResult.error||att.error)throw klass.error||memberResult.error||att.error;
    if(klass.data.audience!=='CABERAWIT')return NextResponse.json({error:'Laporan kelas khusus Jabirawit.'},{status:400});
    const records=att.data??[];const roster=new Map<string,{id:string;name:string;placements:ReturnType<typeof snapshotPlacements>}>();
    for(const m of memberResult.data??[]){const placements=reportMemberships((m as any).member_memberships??[],from,to,classId);if(placements.length)roster.set(m.id,{id:m.id,name:m.name,placements})}
    for(const r of records){const key=r.member_id||r.participant_key;const existing=roster.get(key);const placements=[...(existing?.placements??[]),...snapshotPlacements([r])];roster.set(key,{id:key,name:r.member_name_snapshot||existing?.name||'Peserta',placements})}
    const members=[...roster.values()].sort((a,b)=>a.name.localeCompare(b.name)),ids=members.map(m=>m.id);
    const eventIds=Array.from(new Set(records.map(r=>r.event_id)));
    const progress=ids.length&&eventIds.length?await s.from('journal_progress').select('member_id,participant_key,target_id,created_at,progress_value,progress_note,journals!inner(journal_date,state,journal_kind,class_id,event_id)').in('participant_key',ids).eq('journals.state','COMPLETED').eq('journals.journal_kind','CABERAWIT_INDIVIDUAL').in('journals.event_id',eventIds).gte('journals.journal_date',from).lte('journals.journal_date',to).order('created_at',{ascending:false}):{data:[],error:null};
    if(progress.error)throw progress.error;const pr=latestProgressRows(((progress.data??[]) as any[]).filter(p=>{const j=Array.isArray(p.journals)?p.journals[0]:p.journals;return records.some(r=>r.event_id===j?.event_id&&r.participant_key===p.participant_key&&r.status==='H')}));
    const targets=await s.from('learning_targets').select('id,title,class_id,level_id,target_month,active,version_id').eq('active',true);if(targets.error)throw targets.error;
    const versionId=String(b.version_id??'');if(!versionId)return NextResponse.json({error:'Pilih versi target untuk laporan.'},{status:400});
    const perMember=members.map(m=>{const a=records.filter(r=>(r.member_id||r.participant_key)===m.id);const H=a.filter(r=>r.status==='H').length,I=a.filter(r=>r.status==='I').length,A=a.filter(r=>r.status==='A').length;const assigned=reportTargets(targets.data??[],m.placements,from,to,versionId);const rows=pr.filter(p=>p.participant_key===m.id);const summary=summarizeProgress(assigned.map(t=>t.id),rows);return {name:m.name,H,I,A,attendance:H+I+A?Math.round(H/(H+I+A)*100):null,progress:summary.percentage,coverage:`${summary.assessed}/${summary.assigned}`,details:assigned.map(t=>{const p=rows.find(p=>p.target_id===t.id);return {target:t.title,value:p?.progress_value??null,note:p?.progress_note||'Belum dinilai'}})};});
    const H=records.filter(r=>r.status==='H').length,I=records.filter(r=>r.status==='I').length,A=records.filter(r=>r.status==='A').length;
    const pct=H+I+A?Math.round(H/(H+I+A)*100):null;
    const assessed=perMember.filter(p=>p.progress!==null);const avg=assessed.length?Math.round(assessed.reduce((sum,p)=>sum+(p.progress??0),0)/assessed.length):null;
    let note=String(b.note??'').slice(0,1500)||'Ringkasan perkembangan disusun dari data jurnal individu.';
    if(b.ai_note){const ai=await analyzeJson<{note:string}>('Tulis satu paragraf laporan kelas yang faktual. Jangan mengarang pencapaian, diagnosis, atau saran klinis. Kembalikan JSON {"note":"..."}. Petunjuk tambahan: '+String(b.ai_instruction??'').slice(0,500),{class_name:klass.data.name,period:{from,to},attendance:{H,I,A},individuals:perMember,notes:pr.slice(0,30).map(p=>p.progress_note)});if(!ai?.note)return NextResponse.json({error:'Catatan otomatis belum tersedia. Coba tanpa catatan otomatis.'},{status:503});note=String(ai.note).slice(0,2000)}
    const vals:Record<string,string>={KELAS:klass.data.name,PERIODE:`${from} s.d. ${to}`,JUMLAH:String(members.length),HADIR:String(H),IZIN:String(I),ALFA:String(A),KEHADIRAN:pct===null?'Belum dicatat':`${pct}%`,PROGRES:avg===null?'Belum dinilai':`${avg}%`,CATATAN:note,NAMA:klass.data.name,JENJANG:'Jabirawit'};
    if(b.preview)return NextResponse.json({title:'Laporan Kelas Caberawit',values:vals,individuals:perMember});
    let bytes:Uint8Array;
    if(b.template_id){
      const t=await s.from('report_templates').select('*').eq('id',b.template_id).eq('active',true).single();if(t.error)throw t.error;
      if(t.data.kind!==format||!t.data.file_base64)return NextResponse.json({error:'Template tidak sesuai format.'},{status:400});
      const zip=await validateOfficeTemplate(Buffer.from(t.data.file_base64,'base64'),format);let replaced=0;
      const paths=Object.keys(zip.files).filter(path=>format==='pptx'?/^ppt\/slides\/slide\d+\.xml$/.test(path):/^word\/(document|header\d+|footer\d+)\.xml$/.test(path));
      for(const path of paths){let xml=await zip.file(path)!.async('string');const before=xml;xml=replaceReportXml(xml,vals);if(before!==xml)replaced++;for(const map of t.data.field_map?.mappings??[]){if(map.path!==path||!Object.hasOwn(vals,map.field))continue;const tag=format==='pptx'?'a:t':'w:t';const old=`<${tag}>${esc(map.existing)}</${tag}>`;if(xml.includes(old)){xml=xml.replace(old,`<${tag}>${esc(vals[map.field])}</${tag}>`);replaced++}}zip.file(path,xml)}
      if(!replaced)return NextResponse.json({error:'Template tidak memiliki posisi data yang dapat diisi. Tambahkan placeholder seperti {{KELAS}}, {{PROGRES}}, atau unggah ulang untuk dipetakan.'},{status:400});
      await appendReportDetails(zip,format,perMember.flatMap(p=>{const lines=p.details.map(d=>`${d.target}: ${d.value??'Belum dinilai'} — ${d.note}`);return Array.from({length:Math.max(1,Math.ceil(lines.length/10))},(_,i)=>({title:p.name,lines:lines.slice(i*10,(i+1)*10)}))}));
      bytes=await zip.generateAsync({type:'uint8array'});
    }else{
      if(format==='pptx'){bytes=await defaultPresentation([{title:`Laporan Kelas ${klass.data.name}`,lines:[vals.PERIODE,`${members.length} anggota`, `Kehadiran ${vals.KEHADIRAN}`,`Progres ${vals.PROGRES}`,note]},...perMember.flatMap(p=>{const lines=[`H ${p.H} · I ${p.I} · A ${p.A}`,`Progres ${p.progress??'Belum dinilai'} · ${p.coverage} target`,...p.details.map(d=>`${d.target}: ${d.value??'Belum dinilai'} — ${d.note}`)];return Array.from({length:Math.max(1,Math.ceil(lines.length/10))},(_,i)=>({title:p.name,lines:lines.slice(i*10,(i+1)*10)}))})]);}else{
      const rows=[
        new TableRow({children:['Nama','H','I','A','Kehadiran','Progres'].map(cell)}),
        ...perMember.map(p=>new TableRow({children:[p.name,String(p.H),String(p.I),String(p.A),p.attendance===null?'Belum dicatat':`${p.attendance}%`,p.progress===null?'Belum dinilai':`${p.progress}% (${p.coverage})`].map(cell)}))
      ];
      const doc=new Document({sections:[{children:[
        new Paragraph({text:'Laporan Kelas Jabirawit',heading:HeadingLevel.TITLE}),
        new Paragraph(`${klass.data.name} · ${from} s.d. ${to}`),
        new Paragraph({text:'Ringkasan',heading:HeadingLevel.HEADING_2}),
        new Paragraph(`${members.length} anggota · Kehadiran ${vals.KEHADIRAN} · Progres ${vals.PROGRES}`),
        new Paragraph(note),
        new Paragraph({text:'Rincian individu',heading:HeadingLevel.HEADING_2}),
        new Table({rows}),...perMember.flatMap(p=>[new Paragraph({text:p.name,heading:HeadingLevel.HEADING_2}),new Table({rows:[new TableRow({children:['Target','Nilai','Catatan'].map(cell)}),...p.details.map(d=>new TableRow({children:[d.target,d.value===null?'Belum dinilai':String(d.value),d.note].map(cell)}))]})])
      ]}]});
      bytes=new Uint8Array(await Packer.toBuffer(doc));}
    }
    return new Response(bytes as unknown as BodyInit,{headers:{'Content-Type':format==='pptx'?'application/vnd.openxmlformats-officedocument.presentationml.presentation':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':`attachment; filename="laporan-kelas-${from}-${to}.${format}"`,'Cache-Control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gagal membuat laporan kelas.'},{status:400})}
}
