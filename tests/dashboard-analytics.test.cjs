const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');

function load(path,localRequire){
  const module={exports:{}};
  const source=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{module,exports:module.exports,require:localRequire,Date,Intl,Map,Set},{filename:path});
  return module.exports;
}
const domain=load('lib/domain.ts',require);
const analytics=load('lib/dashboard-analytics.ts',name=>name==='./domain'?domain:require(name));
const levels=[{id:'paud',name:'PAUD'},{id:'sd1',name:'SD 1'}];
const classes=[{id:'cpaud',name:'Kelompok PAUD',level_id:'paud'},{id:'csd',name:'Kelas 1',level_id:'sd1'}];

test('legacy attendance without level snapshot uses participant membership valid on event date',()=>{
  const person={id:'member-1',level_id:'sd1',class_id:'csd',member_memberships:[
    {level_id:'paud',class_id:'cpaud',valid_from:'2026-01-01',valid_to:'2026-10-08',active:false,categories:{slug:'caberawit'}},
    {level_id:'sd1',class_id:'csd',valid_from:'2026-10-09',active:true,categories:{slug:'caberawit'}}
  ]};
  const events=[
    {id:'old',state:'COMPLETED',event_date:'2026-10-05',attendance_records:[{member_id:'member-1',status:'H'}]},
    {id:'new',state:'COMPLETED',event_date:'2026-10-10',attendance_records:[{member_id:'member-1',status:'A'}]}
  ];
  const base={people:[person],events,journals:[],levels,classes,month:'2026-10',span:1};
  const paud=analytics.buildDashboardAnalytics({...base,levelId:'paud'});
  const sd=analytics.buildDashboardAnalytics({...base,levelId:'sd1'});
  assert.equal(paud.attendance.meetings,1);assert.equal(paud.attendance.present,1);
  assert.equal(paud.attendance.absent,0);assert.equal(paud.attendance.percentage,100);
  assert.equal(sd.attendance.meetings,1);assert.equal(sd.attendance.absent,1);
  assert.equal(sd.attendance.percentage,0);
});

test('class snapshot takes precedence over current membership and does not mutate source records',()=>{
  const person={id:'m',level_id:'sd1',member_memberships:[{level_id:'sd1',class_id:'csd',active:true,categories:{slug:'caberawit'}}]};
  const event={id:'a',state:'COMPLETED',event_date:'2026-10-09',attendance_records:[{member_id:'m',class_id_snapshot:'cpaud',status:'H'}]};
  const lookup=analytics.createDashboardLookup([person],classes);
  assert.equal(analytics.recordPlacement(event,event.attendance_records[0],lookup).levelId,'paud');
  assert.equal(event.attendance_records[0].level_id_snapshot,undefined);
  const result=analytics.buildDashboardAnalytics({people:[person],events:[event],journals:[],levels,classes,month:'2026-10',span:1,levelId:'paud'});
  assert.equal(result.attendance.present,1);assert.equal(result.levelMapping.inferred,1);
});

test('unmapped events retain total counts but no fabricated level percentages',()=>{
  const e={id:'unknown',state:'COMPLETED',event_date:'2026-10-11',attendance_records:[{member_id:'archived',status:'I'}]};
  const all=analytics.buildDashboardAnalytics({people:[],events:[e],journals:[],levels,classes,month:'2026-10',span:1});
  assert.equal(all.attendance.excused,1);
  assert.equal(all.levelMapping.unmapped,1);
  assert.equal(all.levels[0].percentage,null);
  const paud=analytics.buildDashboardAnalytics({people:[],events:[e],journals:[],levels,classes,month:'2026-10',span:1,levelId:'paud'});
  assert.equal(paud.attendance.meetings,0);
  assert.equal(paud.attendance.percentage,null);
});
