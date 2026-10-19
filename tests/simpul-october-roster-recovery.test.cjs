const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');

const read=path=>fs.readFileSync(path,'utf8');
const migration=read('supabase/migrations/20261019113000_restore_empty_historical_caberawit_rosters.sql');
const recapMigration=read('supabase/migrations/20261019114500_recap_only_recorded_sessions.sql');
const detail=read('app/api/attendance/[id]/route.ts');
const creation=read('app/api/attendance/route.ts');
const form=read('components/AttendanceCreate.tsx');
const history=read('components/AttendanceHistory.tsx');
const journal=read('app/jurnal/tulis/page.tsx');

test('October 1 empty class roster is restorable without overwriting recorded history',()=>{
  assert.match(migration,/p_event_id uuid/);
  assert.match(migration,/v_event\.event_date < date '2026-10-01'/);
  assert.match(migration,/v_event\.state <> 'ONGOING'/);
  assert.match(migration,/exists \(select 1 from public\.attendance_records r where r\.event_id = p_event_id\)/);
  assert.match(migration,/public\.has_app_permission\('attendance\.write'\)/);
  assert.match(migration,/public\.can_write_scoped_audience/);
  assert.match(migration,/mm\.valid_from between date '2026-10-06' and date '2026-10-07'/);
  assert.match(migration,/not exists \(\s*select 1 from public\.member_memberships earlier/);
  assert.match(migration,/on conflict \(event_id,member_id\) do nothing/);
  assert.doesNotMatch(migration,/delete\s+from\s+public\.attendance_records/i);
  assert.doesNotMatch(migration,/update\s+public\.attendance_records/i);
});

test('old marked records are reopened instead of creating duplicate sessions',()=>{
  assert.match(creation,/existingRecordedCaberawit/);
  assert.match(creation,/existingId\)return NextResponse\.json\(\{id:existingId,existing:true\}/);
  assert.match(creation,/\.eq\('activity_type_id',event\.activity_type_id\)/);
  assert.match(creation,/\.eq\('event_date',event\.event_date\)/);
  assert.match(detail,/redirect_event_id:existing\.id/);
  assert.match(form,/if\(event\.redirect_event_id&&event\.redirect_event_id!==id\)/);
  assert.match(form,/window\.history\.replaceState/);
});

test('historical empty-only restore leaves current class roster synchronization intact',()=>{
  assert.match(detail,/data\.event_date>=today/);
  assert.match(detail,/sync_caberawit_attendance_roster/);
  assert.match(detail,/data\.event_date>='2026-10-01'/);
  assert.match(detail,/simpul_restore_empty_caberawit_roster/);
  assert.match(detail,/if\(Number\(restored\)>0\)/);
  assert.match(form,/Muat ulang peserta/);
  assert.match(form,/href="\/presensi\/riwayat"/);
});

test('history and official recap require at least one recorded H I A',()=>{
  assert.match(history,/some\(r=>\['H','I','A'\]\.includes\(r\.status\|\|''\)\)/);
  assert.match(recapMigration,/marked\.status IN \(''H'',''I'',''A''\)/);
  assert.match(recapMigration,/eligible|event_date>=v_start/);
});

test('journal writing remains independent of a newly created attendance record',()=>{
  assert.match(journal,/event_id:e\?\.id\|\|null/);
  assert.match(journal,/journal_date:date/);
  assert.match(journal,/session_key\?\.startsWith\('routine:'\)/);
  assert.match(journal,/session_key\?\.startsWith\('archive:'\)/);
  assert.match(journal,/progress:\[\],revision:0,state:'COMPLETED'/);
  assert.match(journal,/fetch\('\/api\/journals',\{method:'POST'/);
  assert.match(journal,/if\(!isMeeting\)await analyze\(result\.id\)/);
});

test('changed entry and attendance routes remain syntactically valid TypeScript',()=>{
  for(const path of ['components/AttendanceCreate.tsx','app/api/attendance/route.ts','app/api/attendance/[id]/route.ts']){
    const result=ts.transpileModule(read(path),{
      fileName:path,reportDiagnostics:true,
      compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
    });
    assert.deepEqual((result.diagnostics||[])
      .filter(d=>d.category===ts.DiagnosticCategory.Error)
      .map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[],path);
  }
});
