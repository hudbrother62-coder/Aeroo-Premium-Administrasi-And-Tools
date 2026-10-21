const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
test('historical attendance is mapped to stable legacy identity instead of a per-event key',()=>{
 const source=fs.readFileSync('supabase/migrations/20261022003800_simpul_stable_legacy_individual_identity.sql','utf8');
 assert.match(source,/legacy:/);
 assert.match(source,/r\.member_id IS NULL/);
 assert.match(source,/GROUP BY CASE WHEN r\.member_id IS NULL/);
 assert.match(source,/COALESCE\(r\.member_id,r\.participant_key,r\.id\)::text/);
});
test('individual list uses a dedicated detail link rather than nested table charts',()=>{
 const src=fs.readFileSync('components/AttendanceRecap.tsx','utf8');
 assert.match(src,/Lihat Detail/);
 assert.match(src,/encodeURIComponent\(p\.id\)/);
 assert.doesNotMatch(src,/expandedPerson/);
});
test('personal detail shows each historical obligation and editable source link',()=>{
 const src=fs.readFileSync('components/IndividualAttendanceDetail.tsx','utf8');
 const compiled=ts.transpileModule(src,{fileName:'IndividualAttendanceDetail.tsx',reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}});
 assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
 assert.match(src,/Kewajiban hadir/);
 assert.match(src,/Keterangan/);
 assert.match(src,/presensi\/buat\?event_id/);
});
