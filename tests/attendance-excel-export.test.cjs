const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const route=fs.readFileSync('app/api/attendance/export/route.ts','utf8');
const history=fs.readFileSync('app/presensi/riwayat/page.tsx','utf8');

test('attendance Excel route is valid TypeScript and calendar buttons are valid TSX',()=>{
  for(const [file,source,jsx] of [
    ['route.ts',route,ts.JsxEmit.ReactJSX],
    ['page.tsx',history,ts.JsxEmit.ReactJSX],
  ]){
    const compiled=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,
      compilerOptions:{jsx,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}});
    assert.deepEqual((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[]);
  }
});

test('monthly and meeting exports use recorded status and linked journals',()=>{
  assert.match(history,/Excel Bulanan/);
  assert.match(history,/Cetak Excel/);
  assert.match(route,/marked\(e\.attendance_records\)/);
  assert.match(route,/const c=counter\(records\)/);
  assert.match(route,/\.in\('event_id',eventIds\.slice/);
  assert.match(route,/XLSX\.utils\.book_append_sheet\(wb,wsJournal,'Jurnal'\)/);
  assert.match(route,/XLSX\.utils\.book_append_sheet\(wb,makeSheet\(attendance/);
  assert.match(route,/j\.assessment/);
  assert.match(route,/\.split\(\/\\r\\n\|\\r\|\\n\|\\t\/g\)/);
  assert.match(route,/X-Content-Type-Options/);
  assert.match(route,/!.*validId\(eventId\)/);
});

test('wajib hadir and percent show in exported rekap',()=>{
 assert.match(route,/const totalWajib=totals\.h\+totals\.i\+totals\.a/);
 assert.match(route,/Total wajib hadir \(H\+I\+A\)/);
 assert.match(route,/Persentase kehadiran \(%\)/);
 assert.match(route,/WAJIB HADIR','KEHADIRAN \(%\)/);
});
