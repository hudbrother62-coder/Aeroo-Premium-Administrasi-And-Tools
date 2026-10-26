const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');

test('recap routes and UI remain valid TSX/TypeScript',()=>{
 const files=['app/rekap/page.tsx','components/AttendanceRecap.tsx','lib/public-read.ts'];
 for(const filename of files){
  const source=fs.readFileSync(filename,'utf8');
  const result=ts.transpileModule(source,{fileName:filename,reportDiagnostics:true,
    compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
  assert.deepEqual((result.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error)
    .map(x=>ts.flattenDiagnosticMessageText(x.messageText,' ')),[],filename);
 }
});

test('rekap opens attendance by default while generic summary stays reachable',()=>{
 const source=fs.readFileSync('app/rekap/page.tsx','utf8');
 assert.match(source,/useState<'ringkasan'\|'presensi'>\('presensi'\)/);
 assert.match(source,/next==='ringkasan'/);
 assert.match(source,/<AttendanceRecap\/>/);
});

test('recap recovers from individual period failures without hiding other months',()=>{
 const source=fs.readFileSync('components/AttendanceRecap.tsx','utf8');
 assert.match(source,/Promise\.allSettled\(activeMonths\.map/);
 assert.match(source,/if\(successful\.length\)/);
 assert.match(source,/setData\(mergeRecapMonths\(successful\)\)/);
 assert.match(source,/Muat ulang rekap/);
 assert.match(source,/setReload\(v=>v\+1\)/);
 assert.match(source,/json\.summary/);
});

test('summary period and attendance counts are sourced from the same scoped recap',()=>{
 const source=fs.readFileSync('lib/public-read.ts','utf8');
 const section=source.split('export async function dataSummary(')[1].split('export async function publicDashboard(')[0];
 assert.match(section,/Date\.UTC\(Number\(month\.slice\(0,4\)\),Number\(month\.slice\(5,7\)\)-span\+i,1\)/);
 assert.match(section,/attendance_recap_scoped/);
 assert.doesNotMatch(section,/readRows\('attendance'\)/);
 assert.match(section,/totals\.H\+totals\.I\+totals\.A/);
});
