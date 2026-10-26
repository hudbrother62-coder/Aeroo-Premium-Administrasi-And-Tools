import {NextRequest,NextResponse} from 'next/server';
import * as XLSX from 'xlsx';
import {db} from '@/lib/supabase-server';
import {spreadsheetCell} from '@/lib/spreadsheet';
import {styledReportXlsx} from '@/lib/report-xlsx-style';

export const runtime='nodejs';

type RecordRow={
  member_id:string|null;participant_key:string|null;member_name_snapshot:string|null;
  class_name_snapshot:string|null;status:string|null;notes:string|null;
};
type EventRow={
  id:string;event_date:string;title:string;audience:string;class_id:string|null;
  teacher_name:string|null;classes:{name:string}|null;attendance_records:RecordRow[]|null;
};
type JournalRow={
  id:string;event_id:string|null;title:string;journal_date:string;
  journal_kind:string;started_at:string|null;ended_at:string|null;
  material:string|null;summary:string|null;result:string|null;
  achievement:string|null;improvement_plan:string|null;decisions:string|null;
  notes:string|null;obstacles:string|null;follow_up:string|null;
  assessment:unknown;
};
const audienceNames:Record<string,string>={
  KELOMPOK:'Kelompok',CABERAWIT:'Caberawit',MUDA_MUDI:'Muda-Mudi',
  IBU_IBU:'Ibu-Ibu',PENGURUS:'Pengurus',
};
const validId=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const cell=(v:unknown)=>spreadsheetCell(String(v??'').trim());
function genderCode(value:unknown):'L'|'P'|''{
  const v=String(value??'').toUpperCase().trim().replace(/[\s_-]/g,'');
  if(['L','LK','M','MALE','PRIA','LAKILAKI'].includes(v))return 'L';
  if(['P','PR','F','FEMALE','WANITA','PEREMPUAN'].includes(v))return 'P';
  return '';
}
function textLines(value:unknown):string[]{
  if(value===null||value===undefined)return [];
  const result:string[]=[];
  for(const part of String(value).split(/\r\n|\r|\n|\t/g)){
    let remaining=part.trim();
    // Keep text fully visible in Excel instead of making one excessively tall row.
    while(remaining.length>220){
      const nearWord=remaining.lastIndexOf(' ',220);
      const split=nearWord>=120?nearWord:220;
      result.push(remaining.slice(0,split).trim());
      remaining=remaining.slice(split).trimStart();
    }
    if(remaining)result.push(remaining);
  }
  return result;
}
function marked(records:RecordRow[]|null){return (records||[]).some(r=>['H','I','A'].includes(r.status||''));}
function counter(records:RecordRow[]){return {
  h:records.filter(r=>r.status==='H').length,
  i:records.filter(r=>r.status==='I').length,
  a:records.filter(r=>r.status==='A').length,
  empty:records.filter(r=>!['H','I','A'].includes(r.status||'')).length,
};}
function makeSheet(rows:(string|number)[][],widths:number[],merges:XLSX.Range[]=[]){
  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws['!cols']=widths.map(w=>({wch:w}));
  ws['!merges']=merges;
  ws['!rows']=rows.map((r,i)=>({hpt:i===0?28:r.some(v=>String(v).length>90)?35:22}));
  ws['!pageSetup']={orientation:'landscape',fitToWidth:1,fitToHeight:0};
  return ws;
}
function appendField(out:(string|number)[][],event:EventRow,journal:JournalRow,label:string,value:unknown){
  textLines(value).forEach((line,i)=>out.push([
    event.event_date,cell(event.title),cell(journal.title),label,i+1,cell(line)
  ]));
}
function addJournal(out:(string|number)[][],event:EventRow,j:JournalRow){
  const assessment=j.assessment&&typeof j.assessment==='object'&&!Array.isArray(j.assessment)
    ?j.assessment as Record<string,unknown>:{};
  const fields:[string,unknown][]=[
    ['Jenis Jurnal',j.journal_kind],['Jam Mulai',j.started_at?.slice(0,5)],
    ['Jam Selesai',j.ended_at?.slice(0,5)],['Pemateri',assessment.presenter],
    ['Pemateri Tambahan',Array.isArray(assessment.presenters)?assessment.presenters.join('\n'):null],
    ['Materi',j.material],['Isi / Catatan Kegiatan',j.summary],
    ['Hasil',j.result],['Capaian',j.achievement],
    ['Rencana Perbaikan',j.improvement_plan],['Kendala',j.obstacles],
    ['Tindak Lanjut',j.follow_up],['Usulan',assessment.proposal],
    ['Keputusan',j.decisions],['Catatan',j.notes],
    ['Pelaksanaan',assessment.implementation],['Evaluasi',assessment.evaluation],
  ];
  fields.forEach(([label,value])=>appendField(out,event,j,label,value));
  if(Array.isArray(assessment.materials)){
    assessment.materials.forEach((value,index)=>{
      const m=value&&typeof value==='object'?value as Record<string,unknown>:{};
      appendField(out,event,j,'Rincian Materi '+(index+1),
        [m.topic,m.page?'Halaman '+m.page:null,m.status,m.note].filter(Boolean).join(' — '));
    });
  }
}
function addAttendanceRows(out:(string|number)[][],merges:XLSX.Range[],event:EventRow,gender:Map<string,string>){
  const records=[...(event.attendance_records||[])].sort((a,b)=>
    String(a.member_name_snapshot||'').localeCompare(String(b.member_name_snapshot||''),'id'));
  const male:RecordRow[]=[],female:RecordRow[]=[],unknown:RecordRow[]=[];
  records.forEach(r=>{
    const sex=genderCode(gender.get(r.member_id||r.participant_key||''));
    (sex==='L'?male:sex==='P'?female:unknown).push(r);
  });
  const base=out.length;
  out.push(['SIMPUL — LAPORAN PRESENSI','','','','','','']);
  merges.push({s:{r:base,c:0},e:{r:base,c:6}});
  for(const r of [base+1,base+2]){
    merges.push({s:{r,c:1},e:{r,c:2}});
    merges.push({s:{r,c:4},e:{r,c:6}});
  }
  merges.push({s:{r:base+3,c:1},e:{r:base+3,c:6}});
  out.push(['Kegiatan',cell(event.title),'','Kategori',cell(audienceNames[event.audience]||event.audience),'','']);
  out.push(['Tanggal',event.event_date,'','Kelas',cell(event.classes?.name||'-'),'','']);
  out.push(['Pengajar',cell(event.teacher_name||'-'),'','','','','']);
  out.push(['LAKI-LAKI','','','','PEREMPUAN','','']);
  merges.push({s:{r:base+4,c:0},e:{r:base+4,c:2}});
  merges.push({s:{r:base+4,c:4},e:{r:base+4,c:6}});
  out.push(['NO','NAMA','H/I/A','','NO','NAMA','H/I/A']);
  for(let i=0;i<Math.max(male.length,female.length);i++){
    const l=male[i],p=female[i];
    out.push([l?i+1:'',l?cell(l.member_name_snapshot||l.participant_key):'',
      l?cell(l.status||'-'):'','',
      p?i+1:'',p?cell(p.member_name_snapshot||p.participant_key):'',
      p?cell(p.status||'-'):'']);
  }
  if(unknown.length){
    out.push(['GENDER BELUM TERCATAT','','','','','','']);
    merges.push({s:{r:out.length-1,c:0},e:{r:out.length-1,c:6}});
    out.push(['NO','NAMA','H/I/A','KETERANGAN','','','']);
    unknown.forEach((r,i)=>out.push([i+1,cell(r.member_name_snapshot||r.participant_key),
      cell(r.status||'-'),cell(r.class_name_snapshot||'-'),'','','']));
  }
  const c=counter(records);
  out.push(['TOTAL',records.length,'HADIR',c.h,'IZIN',c.i,'ALFA',c.a]);
  out.push(['Belum diisi',c.empty,'','','','','']);
  out.push(['Keterangan','H = Hadir; I = Izin; A = Alfa; - = Belum diisi','','','','','']);
  merges.push({s:{r:out.length-1,c:1},e:{r:out.length-1,c:6}});
  out.push(['','','','','','','']);
}
export async function GET(req:NextRequest){
  try{
    const params=req.nextUrl.searchParams;
    const eventId=params.get('event_id')||'';
    const month=params.get('month')||'';
    const audience=params.get('audience')||'';
    const classId=params.get('class_id')||'';
    if(eventId?!validId(eventId):!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      return NextResponse.json({error:'Pilih pertemuan atau bulan yang valid.'},{status:400});
    if(audience&&!Object.keys(audienceNames).includes(audience))
      return NextResponse.json({error:'Kategori tidak valid.'},{status:400});
    if(classId&&!validId(classId))
      return NextResponse.json({error:'Kelas tidak valid.'},{status:400});
    const s=await db();
    const {data:role,error:roleError}=await s.rpc('current_app_role');
    if(roleError||!['ADMIN','DEWAN_GURU','KELOMPOK'].includes(role||''))
      return NextResponse.json({error:'Akses ekspor hanya untuk petugas yang berwenang.'},{status:403});

    const events:EventRow[]=[];
    for(let offset=0;offset<2000;offset+=200){
      let q=s.from('attendance_events')
        .select('id,event_date,title,audience,class_id,teacher_name,classes(name),attendance_records(member_id,participant_key,member_name_snapshot,class_name_snapshot,status,notes)')
        .neq('state','CANCELLED').order('event_date',{ascending:true}).order('id',{ascending:true});
      if(eventId)q=q.eq('id',eventId);
      else{
        const finalDay=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
        q=q.gte('event_date',month+'-01').lte('event_date',month+'-'+String(finalDay).padStart(2,'0'));
        if(audience)q=q.eq('audience',audience);
        if(classId)q=q.eq('class_id',classId);
      }
      const {data,error}=await q.range(offset,offset+199);
      if(error)throw Error(error.message);
      const page=(data||[]) as unknown as EventRow[];
      events.push(...page.filter(e=>marked(e.attendance_records)));
      if(page.length<200)break;
      if(offset===1800)throw Error('Terlalu banyak pertemuan. Persempit periode ekspor.');
    }
    if(!events.length)return NextResponse.json({error:'Tidak ada presensi yang sudah diisi untuk pilihan ini.'},{status:404});

    const gender=new Map<string,string>();
    const ids=[...new Set(events.flatMap(e=>(e.attendance_records||[]).map(r=>r.member_id||r.participant_key).filter((id):id is string=>!!id&&validId(id))))];
    for(let i=0;i<ids.length;i+=100){
      const {data,error}=await s.from('members').select('id,gender').in('id',ids.slice(i,i+100));
      if(error)throw Error('Data jenis kelamin anggota tidak dapat dibaca: '+error.message);
      (data||[]).forEach(m=>gender.set(m.id,String(m.gender||'')));
    }

    const journals:JournalRow[]=[];
    const eventIds=events.map(e=>e.id);
    for(let i=0;i<eventIds.length;i+=60){
      for(let offset=0;offset<2000;offset+=200){
        const {data,error}=await s.from('journals')
          .select('id,event_id,title,journal_date,journal_kind,started_at,ended_at,material,summary,result,achievement,improvement_plan,decisions,notes,obstacles,follow_up,assessment')
          .in('event_id',eventIds.slice(i,i+60)).neq('state','ARCHIVED')
          .order('journal_date',{ascending:true}).order('id',{ascending:true})
          .range(offset,offset+199);
        if(error)throw Error('Jurnal pertemuan belum dapat dibaca: '+error.message);
        journals.push(...(data||[]) as unknown as JournalRow[]);
        if((data||[]).length<200)break;
        if(offset===1800)throw Error('Jurnal terlalu banyak. Persempit periode ekspor.');
      }
    }

    const wb=XLSX.utils.book_new();
    const totals=counter(events.flatMap(e=>e.attendance_records||[]));
    const summary:(string|number)[][]=[
      ['SIMPUL — RINGKASAN LAPORAN PRESENSI',''],
      ['Periode',eventId?events[0].event_date:month],
      ['Kategori',audienceNames[audience]||'Semua kategori'],
      ['Jumlah Pertemuan',events.length],['Jumlah Jurnal Terkait',journals.length],
      ['Hadir',totals.h],['Izin',totals.i],['Alfa',totals.a],
      ['Belum diisi',totals.empty],['Total Catatan',totals.h+totals.i+totals.a+totals.empty],
      ['Catatan','Belum diisi tidak dihitung sebagai Alfa.'],
      [],['TANGGAL','KEGIATAN','KATEGORI','HADIR','IZIN','ALFA','BELUM DIISI'],
      ...events.map(e=>{const c=counter(e.attendance_records||[]);return [
        e.event_date,cell(e.title),cell(audienceNames[e.audience]||e.audience),c.h,c.i,c.a,c.empty
      ];}),
    ];
    const wsSummary=makeSheet(summary,[22,42,20,15,15,15,18],[{s:{r:0,c:0},e:{r:0,c:6}}]);
    wsSummary['!autofilter']={ref:'A13:G'+summary.length};
    XLSX.utils.book_append_sheet(wb,wsSummary,'Ringkasan');
    const attendance:(string|number)[][]=[],merges:XLSX.Range[]=[];
    events.forEach(e=>addAttendanceRows(attendance,merges,e,gender));
    XLSX.utils.book_append_sheet(wb,makeSheet(attendance,[10,39,15,19,10,39,15],merges),'Presensi');
    const journalLines:(string|number)[][]=[
      ['TANGGAL','PERTEMUAN','JUDUL JURNAL','BAGIAN','NO','ISI / KETERANGAN']
    ];
    const eventMap=new Map(events.map(e=>[e.id,e]));
    journals.forEach(j=>{const event=j.event_id?eventMap.get(j.event_id):undefined;if(event)addJournal(journalLines,event,j)});
    if(journalLines.length===1)journalLines.push(['','','','Belum ada jurnal terkait','','']);
    const wsJournal=makeSheet(journalLines,[17,36,40,26,9,85]);
    wsJournal['!autofilter']={ref:'A1:F'+journalLines.length};
    XLSX.utils.book_append_sheet(wb,wsJournal,'Jurnal');
    const fileName='simpul-presensi-'+(eventId?events[0].event_date+'-'+eventId.slice(0,8):month)+'.xlsx';
    const bytes=await styledReportXlsx(wb,[
      {kind:'Ringkasan',rows:summary,minWidths:[18,27,18,11,10,10,16],maxWidths:[23,48,24,15,14,14,20],
        merges:[{s:{r:0,c:0},e:{r:0,c:6}}],freezeRows:13},
      {kind:'Presensi',rows:attendance,minWidths:[7,30,9,12,7,30,9],maxWidths:[9,46,11,15,9,46,11],
        merges,freezeRows:events.length===1?6:0},
      {kind:'Jurnal',rows:journalLines,minWidths:[15,25,24,18,7,40],maxWidths:[17,36,40,28,8,65],freezeRows:1}
    ]);
    return new Response(bytes as BodyInit,{headers:{
      'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':'attachment; filename="'+fileName+'"',
      'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
    }});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Gagal membuat laporan Excel.'},{status:500});
  }
}
