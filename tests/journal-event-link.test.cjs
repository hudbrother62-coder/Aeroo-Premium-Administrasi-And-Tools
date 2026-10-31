const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const ts=require('typescript'),Module=require('node:module'),path=require('node:path');
const filename=path.resolve('lib/journal-event-link.ts');
const m=new Module(filename);m.filename=filename;m.paths=module.paths;
m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename);
const {journalAudience,matchingJournalEvents,uniqueJournalEvent}=m.exports;
const row=(id,overrides={})=>({id,event_date:'2026-10-27',audience:'IBU_IBU',class_id:null,activity_type_id:'kegiatan-ibu',agenda_id:null,state:'ONGOING',...overrides});
const form={journal_kind:'IBU_IBU',journal_date:'2026-10-27',class_id:null,activity_type_id:'kegiatan-ibu',agenda_id:null};
test('Ibu-Ibu and all other supported scopes map correctly',()=>{
 assert.equal(journalAudience('IBU_IBU'),'IBU_IBU');
 assert.equal(journalAudience('PENGKAJIAN'),'KELOMPOK');
 assert.equal(journalAudience('KELOMPOK'),'KELOMPOK');
 assert.equal(journalAudience('CABERAWIT_CLASS'),'CABERAWIT');
 assert.equal(journalAudience('MUDA_MUDI_CLASS'),'MUDA_MUDI');
 assert.equal(journalAudience('PENGURUS'),'PENGURUS');
});
test('27 October ibu-ibu: link only the sole same-day activity with matching class',()=>{
 assert.equal(uniqueJournalEvent(form,[row('correct')]),'correct');
 assert.equal(uniqueJournalEvent(form,[row('wrong-date',{event_date:'2026-10-28'})]),null);
 assert.equal(uniqueJournalEvent(form,[row('wrong-audience',{audience:'KELOMPOK'})]),null);
 assert.equal(uniqueJournalEvent(form,[row('wrong-activity',{activity_type_id:'other'})]),null);
 assert.equal(uniqueJournalEvent(form,[row('wrong-class',{class_id:'class-a'})]),null);
 assert.equal(uniqueJournalEvent(form,[row('cancelled',{state:'CANCELLED'})]),null);
});
test('multiple matching sessions or missing activity must stay unlinked',()=>{
 assert.equal(uniqueJournalEvent(form,[row('a'),row('b')]),null);
 assert.equal(uniqueJournalEvent({...form,activity_type_id:null},[row('a',{activity_type_id:null})]),null);
 assert.equal(matchingJournalEvents(form,[row('a'),row('b')]).length,2);
});
test('Caberawit classes and explicit agenda meetings never cross-associate',()=>{
 const classForm={journal_kind:'CABERAWIT_CLASS',journal_date:'2026-10-27',class_id:'kelas-1',activity_type_id:'caberawit',agenda_id:null};
 assert.equal(uniqueJournalEvent(classForm,[row('a',{audience:'CABERAWIT',class_id:'kelas-1',activity_type_id:'caberawit'} )]),'a');
 assert.equal(uniqueJournalEvent(classForm,[row('a',{audience:'CABERAWIT',class_id:'kelas-2',activity_type_id:'caberawit'})]),null);
 assert.equal(uniqueJournalEvent({...form,agenda_id:'agenda-1'},[row('m',{agenda_id:'agenda-1',activity_type_id:null})]),'m');
 assert.equal(uniqueJournalEvent({...form,agenda_id:'agenda-1'},[row('m',{agenda_id:null})]),null);
});
test('journal create and edit endpoints resolve session before saving',()=>{
 for(const filename of ['app/api/journals/route.ts','app/api/journals/[id]/route.ts']){
  const code=fs.readFileSync(filename,'utf8');
  assert.match(code,/linkJournalToUniqueAttendance\(s,body\)/);
  assert.match(code,/p_body:linkedBody/);
 }
 const page=fs.readFileSync('app/jurnal/buat/page.tsx','utf8');
 assert.match(page,/suggestedEventId/);
 assert.match(page,/from:form\.journal_date,to:form\.journal_date/);
 assert.doesNotMatch(page,/fetch\('\/api\/attendance'\)/);
});
