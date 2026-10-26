const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const JSZip=require('jszip');
const XLSX=require('xlsx');
const ExcelJS=require('exceljs');

const filename=path.resolve('lib/report-xlsx-style.ts');
const source=fs.readFileSync(filename,'utf8');
const transpiled=ts.transpileModule(source,{
  fileName:filename,reportDiagnostics:true,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}
});
const mod=new Module(filename,module);
mod.filename=filename;
mod.paths=Module._nodeModulePaths(path.dirname(filename));
mod._compile(transpiled.outputText,filename);
const {styledReportXlsx}=mod.exports;

test('report styling uses validated ExcelJS writer, not worksheet XML replacements',()=>{
  assert.deepEqual((transpiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error)
    .map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[]);
  assert.match(source,/new ExcelJS\.Workbook\(\)/);
  assert.match(source,/\.xlsx\.writeBuffer\(\)/);
  assert.doesNotMatch(source,/zip\.file\('xl\/worksheets|zip\.file\('xl\/styles/);
});

test('output remains readable in independent Excel readers with complete values and styles',async()=>{
  const sheetDefs=[
    {kind:'Ringkasan',rows:[
      ['SIMPUL — RINGKASAN LAPORAN PRESENSI'],['Periode','2026-10'],['Kategori','Kelompok'],
      ['Jumlah Pertemuan',1],['Jumlah Jurnal Terkait',1],['Hadir',1],['Izin',1],['Alfa',1],
      ['Belum diisi',0],['Total Catatan',3],['Catatan','Belum diisi tidak dihitung sebagai Alfa.'],
      [],['TANGGAL','KEGIATAN','KATEGORI','HADIR','IZIN','ALFA','BELUM DIISI'],
      ['2026-10-19','Pengajian Kelompok','Kelompok',1,1,1,0]
    ],minWidths:[18,27,18,11,10,10,16],maxWidths:[23,48,24,15,14,14,20],
    merges:[{s:{r:0,c:0},e:{r:0,c:6}}],freezeRows:13},
    {kind:'Presensi',rows:[
      ['SIMPUL — LAPORAN PRESENSI'],['Kegiatan','Pengajian Kelompok','','Kategori','Kelompok'],
      ['Tanggal','2026-10-19','','Kelas','-'],['Pengajar','-'],
      ['LAKI-LAKI','','','','PEREMPUAN'],['NO','NAMA','H/I/A','','NO','NAMA','H/I/A'],
      [1,'Ahmad','H','',1,'Ani','I'],[2,'Budi','A','',2,'Bunga','-'],
      ['TOTAL',4,'HADIR',1,'IZIN',1,'ALFA',1]
    ],minWidths:[7,30,9,12,7,30,9],maxWidths:[9,46,11,15,9,46,11],
    merges:[{s:{r:0,c:0},e:{r:0,c:6}},{s:{r:4,c:0},e:{r:4,c:2}},{s:{r:4,c:4},e:{r:4,c:6}}],
    freezeRows:6},
    {kind:'Jurnal',rows:[
      ['TANGGAL','PERTEMUAN','JUDUL JURNAL','BAGIAN','NO','ISI / KETERANGAN'],
      ['2026-10-19','Pengajian Kelompok','Jurnal Pengajian','Materi',1,
       'Ini adalah isi materi yang panjang dan perlu terbaca tanpa menghilangkan satu pun kata dari jurnal.']
    ],minWidths:[15,25,24,18,7,40],maxWidths:[17,36,40,28,8,65],freezeRows:1}
  ];
  const sheetjs=XLSX.utils.book_new();
  sheetDefs.forEach(s=>XLSX.utils.book_append_sheet(sheetjs,XLSX.utils.aoa_to_sheet(s.rows),s.kind));
  const bytes=await styledReportXlsx(sheetjs,sheetDefs);
  const zip=await JSZip.loadAsync(bytes);
  assert.ok(zip.file('xl/workbook.xml'));
  assert.ok(zip.file('xl/styles.xml'));
  for(let i=1;i<=3;i++)assert.ok(zip.file('xl/worksheets/sheet'+i+'.xml'));
  const reader=new ExcelJS.Workbook();
  await reader.xlsx.load(Buffer.from(bytes));
  assert.equal(reader.worksheets.length,3);
  const recap=reader.getWorksheet('Ringkasan'),presence=reader.getWorksheet('Presensi'),journal=reader.getWorksheet('Jurnal');
  assert.equal(recap.getCell('A1').value,'SIMPUL — RINGKASAN LAPORAN PRESENSI');
  assert.equal(recap.getCell('D14').value,1);
  assert.equal(presence.getCell('B7').value,'Ahmad');
  assert.equal(presence.getCell('C7').value,'H');
  assert.equal(presence.getCell('G7').value,'I');
  assert.equal(presence.getCell('C8').value,'A');
  assert.equal(presence.getCell('G8').value,'-');
  assert.equal(journal.getCell('F2').value,sheetDefs[2].rows[1][5]);
  assert.equal(presence.getCell('A1').font.bold,true);
  assert.equal(presence.getCell('A1').fill.fgColor.argb,'FF123F52');
  assert.equal(presence.getCell('C7').fill.fgColor.argb,'FFDCFCE7');
  assert.equal(presence.getCell('C7').border.bottom.style,'thin');
  assert.equal(journal.getCell('F2').alignment.wrapText,true);
  assert.equal(presence.getColumn(2).width<=46,true);
  assert.equal(presence.getRow(1).height,34);
  assert.equal(presence.getCell('A5').isMerged,true);
  assert.equal(recap.pageSetup.orientation,'landscape');

  // Separate parser verifies that the file is a real workbook, not a ZIP
  // that only the generator's own parser understands.
  const independent=XLSX.read(bytes,{type:'array',WTF:true});
  assert.deepEqual(independent.SheetNames,['Ringkasan','Presensi','Jurnal']);
  assert.equal(independent.Sheets.Presensi.B7.v,'Ahmad');
  assert.equal(independent.Sheets.Jurnal.F2.v,sheetDefs[2].rows[1][5]);
});
