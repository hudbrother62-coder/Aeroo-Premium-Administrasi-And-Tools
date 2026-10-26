const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const XLSX=require('xlsx');
const ExcelJS=require('exceljs');

function loadTs(file){
 const filename=path.resolve(file);
 const source=fs.readFileSync(filename,'utf8');
 const result=ts.transpileModule(source,{fileName:filename,reportDiagnostics:true,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}});
 assert.deepEqual((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error)
  .map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[]);
 const mod=new Module(filename,module);
 mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
 mod._compile(result.outputText,filename);
 return mod.exports;
}
const {kelompokGenderRecap,reportGender}=loadTs('lib/attendance-gender-recap.ts');
const {styledReportXlsx}=loadTs('lib/report-xlsx-style.ts');
const event=(id,audience,date,records)=>({id,audience,event_date:date,title:'Pengajian Kelompok',attendance_records:records});
const rec=(id,status)=>({member_id:id,participant_key:id,status});

test('gender report groups H/I/A/pending exactly and never guesses missing gender',()=>{
 const map=new Map([['m1','L'],['m2','L'],['m3','L'],['f1','P'],['f2','P']]);
 const result=kelompokGenderRecap([
  event('e1','KELOMPOK','2026-10-26',[rec('m1','H'),rec('m2','I'),rec('m3','A'),rec('f1','H'),rec('f2','I'),rec('unknown','H')]),
  event('e2','KELOMPOK','2026-10-23',[rec('m1','H'),rec('m2',null),rec('f1','A')]),
  event('other','CABERAWIT','2026-10-26',[rec('f2','H')])
 ],map);
 assert.equal(result.meetings.length,2);
 assert.deepEqual(result.overall.map(g=>({gender:g.gender,H:g.counts.H,I:g.counts.I,A:g.counts.A,pending:g.counts.pending,total:g.counts.total})),[
  {gender:'L',H:2,I:1,A:1,pending:1,total:5},
  {gender:'P',H:1,I:1,A:1,pending:0,total:3},
  {gender:'UNKNOWN',H:1,I:0,A:0,pending:0,total:1},
 ]);
 assert.deepEqual(result.total,{H:4,I:2,A:2,pending:1,total:9,percentage:50});
 assert.equal(result.meetings[0].groups[0].counts.total,3);
 assert.equal(result.meetings[1].groups[0].counts.pending,1);
 assert.equal(reportGender('perempuan'),'P');
 assert.equal(reportGender(null),'UNKNOWN');
 assert.equal(kelompokGenderRecap([event('c','CABERAWIT','2026-10-26',[rec('f1','H')])],map),null);
});

test('realistic Pengajian Kelompok October 26 totals reconcile to 63 attendance records',()=>{
 const records=[
  ...Array.from({length:17},(_,i)=>rec('mh'+i,'H')),
  ...Array.from({length:8},(_,i)=>rec('mi'+i,'I')),
  rec('ma1','A'),
  ...Array.from({length:28},(_,i)=>rec('fh'+i,'H')),
  ...Array.from({length:8},(_,i)=>rec('fi'+i,'I')),
  rec('u1','H')
 ];
 const map=new Map(records.filter(r=>r.member_id!=='u1').map(r=>
  [r.member_id,r.member_id[0]==='m'?'L':'P']));
 const recap=kelompokGenderRecap([event('e1','KELOMPOK','2026-10-26',records)],map);
 assert.deepEqual(recap.overall.map(g=>g.counts.total),[26,36,1]);
 assert.equal(recap.total.total,63);
 assert.equal(recap.total.H,46);
 assert.equal(recap.total.I,16);
 assert.equal(recap.total.A,1);
 assert.equal(recap.overall[0].counts.percentage,65.4);
 assert.equal(recap.overall[1].counts.percentage,77.8);
});

test('Excel gender summary retains colored headings, percentage values and correctly scoped filter',async()=>{
 const summary=[
  ['SIMPUL — RINGKASAN LAPORAN PRESENSI'],
  ['Periode','2026-10-26'],['Kategori','Kelompok'],['Jumlah Pertemuan',1],
  ['Jumlah Jurnal Terkait',1],['Hadir',46],['Izin',16],['Alfa',1],
  ['Belum diisi',0],['Total Catatan',63],['Catatan','Belum diisi tidak dihitung sebagai Alfa.'],
  [],['REKAP PER JENIS KELAMIN — PENGAJIAN KELOMPOK'],
  ['JENIS KELAMIN','HADIR','IZIN','ALFA','BELUM DIISI','TOTAL CATATAN','KEHADIRAN (%)'],
  ['Laki-laki',17,8,1,0,26,65.4],['Perempuan',28,8,0,0,36,77.8],
  ['Belum tercatat',1,0,0,0,1,100],
  ['TOTAL KELOMPOK',46,16,1,0,63,73],
  ['Keterangan','Total catatan dihitung per peserta di setiap pertemuan.'],
  [],['TANGGAL','KEGIATAN','KATEGORI','HADIR','IZIN','ALFA','BELUM DIISI'],
  ['2026-10-26','Pengajian Kelompok','Kelompok',46,16,1,0]
 ];
 const tableHeaderRow=21;
 const defs=[
  {kind:'Ringkasan',rows:summary,minWidths:[18,27,18,11,10,10,16],maxWidths:[23,48,24,15,14,14,20],
   merges:[{s:{r:0,c:0},e:{r:0,c:6}},{s:{r:12,c:0},e:{r:12,c:6}},
    {s:{r:18,c:1},e:{r:18,c:6}}],
   mainTableHeaderRow:tableHeaderRow,mainTableEndRow:22,freezeRows:1},
  {kind:'Presensi',rows:[['SIMPUL — LAPORAN PRESENSI']],minWidths:[7,30,9,12,7,30,9],maxWidths:[9,46,11,15,9,46,11]},
  {kind:'Jurnal',rows:[['TANGGAL','PERTEMUAN','JUDUL JURNAL','BAGIAN','NO','ISI / KETERANGAN']],
   minWidths:[15,25,24,18,7,40],maxWidths:[17,36,40,28,8,65]}
 ];
 const wb=XLSX.utils.book_new();
 defs.forEach(d=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(d.rows),d.kind));
 const buffer=await styledReportXlsx(wb,defs);
 const read=new ExcelJS.Workbook();
 await read.xlsx.load(Buffer.from(buffer));
 const sheet=read.getWorksheet('Ringkasan');
 assert.equal(sheet.getCell('A13').value,'REKAP PER JENIS KELAMIN — PENGAJIAN KELOMPOK');
 assert.equal(sheet.getCell('A13').isMerged,true);
 assert.equal(sheet.getCell('A13').fill.fgColor.argb,'FF0E7C66');
 assert.equal(sheet.getCell('B15').value,17);
 assert.equal(sheet.getCell('C16').value,8);
 assert.equal(sheet.getCell('F18').value,63);
 assert.equal(sheet.getCell('G15').numFmt,'0.0"%"');
 const zip=await require('jszip').loadAsync(buffer);
 const worksheetXml=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.match(worksheetXml,/<autoFilter ref="A21:G22"\/>/);
 const parsed=XLSX.read(buffer,{type:'array',WTF:true});
 assert.equal(parsed.Sheets.Ringkasan.B15.v,17);
 assert.equal(parsed.Sheets.Ringkasan.F18.v,63);
});
