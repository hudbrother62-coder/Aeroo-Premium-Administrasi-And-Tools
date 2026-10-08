const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const Module=require('node:module');
const XLSX=require('xlsx');
const p=require('node:path').resolve('lib/learning-report-export.ts');
const m=new Module(p);m.filename=p;m.paths=module.paths;
const old=m.require.bind(m);
m.require=name=>{
  if(name==='server-only')return {};
  if(name==='./spreadsheet')return {spreadsheetCell:v=>/^[=+\-@\t\r]/.test(String(v))?"'"+v:String(v)};
  return old(name);
};
m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,
}}).outputText,p);
const {learningReportExport}=m.exports;
const report={
  title:'Laporan Kelas Caberawit',values:{PERIODE:'2026-10-01 s.d. 2026-10-08',HADIR:'1'},
  individuals:[{Nama:'Siti',Hadir:1,Izin:0}],
  details:[{Nama:'Siti',Target:'Hafalan',Nilai:80,Catatan:'Baik'}],
  filename:'laporan-caberawit-uji',
};
test('learning Excel export is a readable workbook with complete summary and detail sheets',async()=>{
  const response=learningReportExport(report,'xlsx');
  assert.equal(response.status,200);
  const bytes=Buffer.from(await response.arrayBuffer());
  const wb=XLSX.read(bytes,{type:'buffer'});
  assert.deepEqual(wb.SheetNames,['Ringkasan','Individu','Detail Target']);
  assert.equal(XLSX.utils.sheet_to_json(wb.Sheets['Detail Target'])[0].Target,'Hafalan');
  assert.equal(XLSX.utils.sheet_to_json(wb.Sheets['Ringkasan']).length,2);
});
test('learning PDF export has correct content type and valid PDF signature',async()=>{
  const response=learningReportExport(report,'pdf');
  assert.equal(response.status,200);
  assert.equal(response.headers.get('content-type'),'application/pdf');
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
});
