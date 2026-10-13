const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const attendance=fs.readFileSync('components/AttendanceCreate.tsx','utf8');
const api=fs.readFileSync('app/api/attendance/route.ts','utf8');
const agenda=fs.readFileSync('app/api/agenda/route.ts','utf8');
const journal=fs.readFileSync('app/jurnal/tulis/page.tsx','utf8');
const migration=fs.readFileSync('supabase/migrations/20261013143000_simpul_activity_sessions_journal_link.sql','utf8');
test('regular activities do not require agenda, one-off uses agenda',()=>{
 assert.match(attendance,/Lainnya — dari agenda khusus/);
 assert.match(attendance,/const requiredAgenda=useAgenda/);
 assert.match(attendance,/selectedActivity\?\.name/);
 assert.match(api,/IBU_IBU','MUDA_MUDI','PENGURUS/);
 assert.doesNotMatch(api,/Kategori ini memerlukan agenda/);
});
test('calendar does not regenerate routine agenda rows',()=>{
 assert.doesNotMatch(agenda,/ensure_simpul_routine_agenda/);
 assert.match(agenda,/\.is\('routine_id',null\)/);
 assert.match(migration,/simpul_agenda_routines set active=false/);
});
test('journals find the matching activity session in either creation order',()=>{
 assert.match(journal,/e\.activity_type_id===activityId/);
 assert.match(journal,/setFromAgenda/);
 assert.match(journal,/Jurnal tetap dapat ditulis/);
 assert.match(migration,/before insert on public.journals/);
 assert.match(migration,/after insert on public.attendance_events/);
 assert.match(migration,/competing/);
 assert.match(migration,/Reopen old Caberawit sessions/);
});
