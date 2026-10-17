const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');

const read=path=>fs.readFileSync(path,'utf8');
const simple=read('app/jurnal/tulis/page.tsx');
const detailed=read('app/jurnal/buat/page.tsx');
const result=read('app/jurnal/hasil/[id]/page.tsx');
const history=read('app/jurnal/riwayat/page.tsx');

test('journal screens remain valid TSX',()=>{
  for(const [path,source] of [
    ['tulis',simple],['buat',detailed],['hasil',result],['riwayat',history]
  ]){
    const result=ts.transpileModule(source,{
      fileName:path+'.tsx',
      reportDiagnostics:true,
      compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}
    });
    assert.deepEqual((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[],path+' must compile');
  }
});

test('teacher journal records real time and preserves attendance linkage',()=>{
  assert.match(simple,/started_at:startedAt\|\|null,ended_at:endedAt\|\|null/);
  assert.match(simple,/event_id:e\?\.id\|\|null/);
  assert.match(simple,/progress:\[\],revision:0,state:'COMPLETED'/);
  assert.match(detailed,/started_at:form\.started_at\|\|null,ended_at:form\.ended_at\|\|null/);
});

test('musyawarah captures proposal decision and notes separately',()=>{
  for(const [path,source] of [['simple',simple],['detailed',detailed]]){
    for(const heading of ['Usulan','Keputusan','Catatan'])assert.match(source,new RegExp('>'+heading+'<'),path+' missing '+heading);
    assert.match(source,/meeting_minutes:/);
  }
  assert.match(simple,/summary:isMeeting\?proposal\.trim\(\)\|\|null/);
  assert.match(simple,/decisions:isMeeting\?decisions\.trim\(\)\|\|null/);
  assert.match(simple,/notes:isMeeting\?meetingNotes\.trim\(\)\|\|null/);
  assert.match(detailed,/summary:isMeetingJournal\?governance\.proposal\|\|null/);
});

test('meeting journal is readable from history without learning-target AI',()=>{
  assert.match(simple,/if\(!isMeeting\)await analyze\(result\.id\)/);
  assert.match(result,/\{!isMeeting&&<div className="fj-ai">/);
  assert.match(result,/journal\.decisions/);
  assert.match(result,/journal\.notes/);
  assert.match(history,/j\.assessment\?\.meeting_minutes\|\|j\.journal_kind==='PENGURUS'/);
});
