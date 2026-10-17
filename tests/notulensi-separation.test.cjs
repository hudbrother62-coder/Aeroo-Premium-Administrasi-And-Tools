const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const source=fs.readFileSync('lib/journal-kind.ts','utf8');
const mod={exports:{}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports});
const {isNotulensi}=mod.exports;
test('musyawarah legacy and new meeting minutes are separated without changing data',()=>{
  const ordinary={journal_kind:'KELOMPOK',title:'Pengajian rutin',assessment:{meeting_minutes:false}};
  const minutes={journal_kind:'IBU_IBU',title:'Rapat',assessment:{meeting_minutes:true}};
  assert.equal(isNotulensi(ordinary),false);
  assert.equal(isNotulensi(minutes),true);
  assert.equal(isNotulensi({journal_kind:'PENGURUS',title:'Musyawarah rutin'}),true);
  assert.equal(isNotulensi({journal_kind:'PENGURUS',assessment:{meeting_minutes:false}}),false);
  assert.equal(isNotulensi({journal_kind:'KELOMPOK',title:'Rapat bulanan'}),true);
  assert.equal(isNotulensi({journal_kind:'KELOMPOK',title:'Kegiatan biasa'}),false);
});
test('minutes are available as distinct navigation with existing journal backend',()=>{
  const shell=fs.readFileSync('components/AppShell.tsx','utf8');
  const list=fs.readFileSync('app/notulensi/page.tsx','utf8');
  const journal=fs.readFileSync('app/jurnal/page.tsx','utf8');
  const history=fs.readFileSync('app/jurnal/riwayat/page.tsx','utf8');
  const writing=fs.readFileSync('app/jurnal/tulis/page.tsx','utf8');
  assert.match(shell,/href:'\/notulensi',label:'Notulensi'/);
  assert.match(list,/isNotulensi\(j\)/);
  assert.match(journal,/if\(isNotulensi\(j\)\)return false/);
  assert.match(history,/!isNotulensi\(j\)/);
  assert.match(writing,/params\.get\('mode'\)==='notulensi'/);
  assert.match(writing,/fetch\('\/api\/journals',\{method:'POST'/);
});
test('new Notulensi page is parseable TSX',()=>{
  const source=fs.readFileSync('app/notulensi/page.tsx','utf8');
  const result=ts.transpileModule(source,{fileName:'notulensi.tsx',reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}});
  assert.deepEqual((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[]);
});
