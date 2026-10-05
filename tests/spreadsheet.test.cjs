const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
function load(file){const m={exports:{}};vm.runInNewContext(ts.transpile(fs.readFileSync(file,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}),{module:m,exports:m.exports,require:n=>n==='./domain'?load('lib/domain.ts'):require(n),Date,Map,Set,Intl});return m.exports}
const d=load('lib/spreadsheet.ts');
test('Excel date serial and Indonesian date normalize safely',()=>{assert.equal(d.excelDate(45292),'2024-01-01');assert.equal(d.excelDate('31/01/2026'),'2026-01-31');assert.equal(d.excelDate(''),null);});
test('bad Excel date is rejected and CSV formulas escaped',()=>{assert.throws(()=>d.excelDate('31/02/2026'));assert.equal(d.spreadsheetCell('=HYPERLINK("bad")'),"'=HYPERLINK(\"bad\")");assert.equal(d.spreadsheetCell('Nama Biasa'),'Nama Biasa')});
