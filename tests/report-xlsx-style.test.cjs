const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const JSZip=require('jszip');
const XLSX=require('xlsx');

const filename=path.resolve('lib/report-xlsx-style.ts');
const source=fs.readFileSync(filename,'utf8');
const transpiled=ts.transpileModule(source,{fileName:filename,reportDiagnostics:true,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}});
const mod=new Module(filename,module);
mod.filename=filename;
mod.paths=Module._nodeModulePaths(path.dirname(filename));
mod._compile(transpiled.outputText,filename);
const {styledReportXlsx}=mod.exports;

test('report Excel styling compiles without TS syntax errors',()=>{
  assert.deepEqual((transpiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[]);
});

test('Excel output includes colored headers, cell borders, wrap, merges, bounded widths and print fit',async()=>{
  const wb=XLSX.utils.book_new();
  const sheets=[
    {kind:'Ringkasan',rows:[['SIMPUL — RINGKASAN LAPORAN PRESENSI'],['Periode','2026-10'],['Kategori','Kelompok'],['Jumlah Pertemuan',1],['Jumlah Jurnal Terkait',1],['Hadir',1],['Izin',1],['Alfa',1],['Belum diisi',0],['Total Catatan',3],['Catatan','Belum diisi tidak dihitung sebagai Alfa.'],[],['TANGGAL','KEGIATAN','KATEGORI','HADIR','IZIN','ALFA','BELUM DIISI'],['2026-10-19','Pengajian Kelompok','Kelompok',1,1,1,0]],
      minWidths:[18,27,18,11,10,10,16],maxWidths:[23,48,24,15,14,14,20],merges:[{s:{r:0,c:0},e:{r:0,c:6}}],freezeRows:13},
    {kind:'Presensi',rows:[['SIMPUL — LAPORAN PRESENSI'],['Kegiatan','Pengajian Kelompok','','Kategori','Kelompok'],['Tanggal','2026-10-19','','Kelas','-'],['Pengajar','-'],['LAKI-LAKI','','','','PEREMPUAN'],['NO','NAMA','H/I/A','','NO','NAMA','H/I/A'],[1,'Ahmad','H','',1,'Ani','I'],[2,'Budi','A','',2,'Bunga','-'],['TOTAL',4,'HADIR',1,'IZIN',1,'ALFA',1]],
      minWidths:[7,30,9,12,7,30,9],maxWidths:[9,46,11,15,9,46,11],merges:[{s:{r:0,c:0},e:{r:0,c:6}},{s:{r:4,c:0},e:{r:4,c:2}},{s:{r:4,c:4},e:{r:4,c:6}}],freezeRows:6},
    {kind:'Jurnal',rows:[['TANGGAL','PERTEMUAN','JUDUL JURNAL','BAGIAN','NO','ISI / KETERANGAN'],['2026-10-19','Pengajian Kelompok','Jurnal Pengajian','Materi',1,'Ini adalah isi materi yang relatif panjang dan harus ditampilkan dengan wrap text agar tidak melebar berlebihan pada laptop.']],
      minWidths:[15,25,24,18,7,40],maxWidths:[17,36,40,28,8,65],freezeRows:1}
  ];
  sheets.forEach(s=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(s.rows),s.kind));
  const output=await styledReportXlsx(wb,sheets);
  const zip=await JSZip.loadAsync(output);
  const styles=await zip.file('xl/styles.xml').async('string');
  const sheet2=await zip.file('xl/worksheets/sheet2.xml').async('string');
  const sheet3=await zip.file('xl/worksheets/sheet3.xml').async('string');
  assert.match(styles,/<fills count="14">/);
  assert.match(styles,/<borders count="3">/);
  assert.match(styles,/wrapText="1"/);
  assert.match(styles,/<fgColor rgb="FF123F52"/);
  assert.match(sheet2,/<c r="A1" s="1"/);
  assert.match(sheet2,/<c r="C7" s="6"/);
  assert.match(sheet2,/<c r="G7" s="7"/);
  assert.match(sheet2,/<c r="C8" s="8"/);
  assert.match(sheet2,/<c r="G8" s="9"/);
  assert.match(sheet2,/<mergeCell ref="A5:C5"/);
  assert.match(sheet2,/fitToWidth="1"/);
  assert.match(sheet3,/showGridLines="0"/);
  assert.match(sheet3,/horizontalCentered="1"/);
  assert.match(sheet3,/<col min="6" max="6" width="65"/);
  const parsed=XLSX.read(output,{type:'array'});
  assert.equal(parsed.Sheets.Presensi.C7.v,'H');
  assert.equal(parsed.Sheets.Presensi.F7.v,'Ani');
  assert.equal(parsed.Sheets.Jurnal.F2.v,sheets[2].rows[1][5]);
});
