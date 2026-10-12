const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const mod={exports:{}};
const source=fs.readFileSync('app/jurnal/cepat/logic.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(compiled,{module:mod,exports:mod.exports});
const {getAttendanceId,eligibleForTarget,recordedAssessments}=mod.exports;
const target={id:'target-1',level_id:'level-1',class_id:'class-1'};
const present={participant_key:'member-1',status:'H',level_id_snapshot:'level-1',class_id_snapshot:'class-1'};
test('only present members of target class and level may be assessed',()=>{
  assert.equal(eligibleForTarget(present,target),true);
  assert.equal(eligibleForTarget({...present,status:'I'},target),false);
  assert.equal(eligibleForTarget({...present,level_id_snapshot:'other'},target),false);
  assert.equal(eligibleForTarget({...present,class_id_snapshot:'other'},target),false);
  assert.equal(eligibleForTarget({...present,participant_key:'',member_id:''},target),false);
});
test('empty score is never stored as zero or auto-assessed',()=>{
 const selected=[present,{...present,participant_key:'member-2'}];
 const rows=recordedAssessments(selected,{'member-1':{value:'',note:''},'member-2':{value:'75',note:'Latihan lanjutan'}},'target-1');
 assert.equal(rows.length,1);
 assert.equal(rows[0].member_id,'member-2');
 assert.equal(rows[0].progress_value,75);
 assert.equal(rows[0].progress_note,'Latihan lanjutan');
});
test('explicit zero is valid, invalid and out-of-range values rejected',()=>{
  const rows=recordedAssessments([present],{'member-1':{value:'0',note:'Belum bisa'}},'target-1');
  assert.equal(rows.length,1);assert.equal(rows[0].progress_value,0);
  assert.equal(recordedAssessments([present],{'member-1':{value:'101',note:''}},'target-1').length,0);
  assert.equal(recordedAssessments([present],{'member-1':{value:'invalid',note:''}},'target-1').length,0);
  assert.equal(getAttendanceId(present),'member-1');
});
test('quick journal always uses attendance and journal endpoints, not direct progress writes',()=>{
  const page=fs.readFileSync('app/jurnal/cepat/page.tsx','utf8');
  assert.match(page,/fetch\('\/api\/journals',\{method:'POST'/);
  assert.match(page,/fetch\('\/api\/attendance\/'/);
  assert.doesNotMatch(page,/fetch\('\/api\/progress',\{method:'POST'/);
  assert.match(page,/progress=mode==='INDIVIDUAL'\?savedRows:\[\]/);
});