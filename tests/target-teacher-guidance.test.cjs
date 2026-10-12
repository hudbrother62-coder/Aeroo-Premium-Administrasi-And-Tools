const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const mod={exports:{}};
const source=fs.readFileSync('app/target/targetGuidance.ts','utf8');
const transpiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
vm.runInNewContext(transpiled.outputText,{module:mod,exports:mod.exports});
const {teacherGuidance,tidySourceNumber}=mod.exports;

test('sequential structure labels can remove original nested source number',()=>{
  assert.equal(tidySourceNumber('7. Tata krama terhadap lingkungan dan alam sekitar'),'Tata krama terhadap lingkungan dan alam sekitar');
  assert.equal(tidySourceNumber('2) Menjaga kebersihan'),'Menjaga kebersihan');
  assert.equal(tidySourceNumber('a. Menjaga kebersihan dan kerapian kelas'),'a. Menjaga kebersihan dan kerapian kelas');
});
test('kebersihan returns a teaching example and observable indicator',()=>{
  const g=teacherGuidance({title:'Menjaga kebersihan dan kerapian kelas',subject:'TATA KRAMA',level:'SD 3'});
  assert.match(g.activity,/sampah|perlengkapan/i);
  assert.match(g.evidence,/rapi/i);
  assert.ok(g.focus.length>55);
});
test('respectful conduct differs from cleanliness suggestions',()=>{
  const g=teacherGuidance({title:'1. Tata krama ta’dhim dan berbuat baik kepada kedua orang tua',subject:'TATA KRAMA',level:'PAUD'});
  assert.match(g.activity,/meminta izin|terima kasih/i);
  assert.doesNotMatch(g.activity,/sampah/i);
});
test('generic title-only target gets meaningful teaching guidance',()=>{
  const g=teacherGuidance({title:'Kemampuan menerapkan pembelajaran',subject:'KEILMUAN',level:'Remaja'});
  assert.match(g.focus,/kemampuan menerapkan pembelajaran/i);
  assert.ok(g.activity.length>35&&g.evidence.length>35);
});
test('source metadata is not confused with teacher guidance',()=>{
  const g=teacherGuidance({title:'Rukun Iman',subject:'KEILMUAN',level:'PAUD'});
  assert.match(g.activity,/penjelasan|ilustrasi|contoh/i);
  assert.ok(!g.focus.includes('Sheet1'));
});