const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const mod={exports:{}};
const source=fs.readFileSync('app/jurnal/cepat/logic.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(compiled,{module:mod,exports:mod.exports});
const {getAttendanceId,eligibleForTarget,recordedAssessments}=mod.exports;
const target={id:'target-1',level_id:'level-1',class_id:'class-1'};
const present={participant_key:'member-1',status:'H',level_id_snapshot:'level-1',class_id_snapshot:'class-1'};
test('previous assessment helper still protects historical data',()=>{
  assert.equal(eligibleForTarget(present,target),true);
  assert.equal(eligibleForTarget({...present,status:'I'},target),false);
  const selected=[present,{...present,participant_key:'member-2'}];
  const rows=recordedAssessments(selected,{'member-1':{value:'',note:''},'member-2':{value:'75',note:'Latihan'}},'target-1');
  assert.equal(rows.length,1);assert.equal(rows[0].member_id,'member-2');
  assert.equal(getAttendanceId(present),'member-1');
});
test('new standard journaling is free-form and does not create numeric assessment',()=>{
  const page=fs.readFileSync('app/jurnal/tulis/page.tsx','utf8');
  assert.match(page,/textarea rows=\{7\} value=\{summary\}/);
  assert.match(page,/progress:\[\],revision:0,state:'COMPLETED'/);
  assert.match(page,/fetch\('\/api\/journals',\{method:'POST'/);
  assert.match(page,/\/analyze/);
  assert.doesNotMatch(page,/setSelectedTarget/);
});
test('legacy quick wizard redirects to journal writing',()=>{
  const page=fs.readFileSync('app/jurnal/cepat/page.tsx','utf8');
  assert.match(page,/redirect\('\/jurnal\/tulis'\)/);
});
