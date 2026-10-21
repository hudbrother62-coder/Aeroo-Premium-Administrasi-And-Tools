
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const source=fs.readFileSync('lib/attendance-trends.ts','utf8');
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:mod.exports,module:mod});
const {monthsEnding,attendanceShares,attendancePercentage,mergeRecapMonths}=mod.exports;
test('last 1/3/6 months are anchored and cross year boundaries',()=>{
 assert.deepEqual(Array.from(monthsEnding('2026-01',3)),['2025-11','2025-12','2026-01']);
 assert.equal(monthsEnding('2026-10',6).length,6);
 assert.equal(monthsEnding('2026-10',1)[0],'2026-10');
});
test('displayed H/I/A shares add to exactly 100 percent and exclude pending',()=>{
 for(const counts of [[124,19,11],[1,1,1],[0,0,1],[17,0,2]]){
  const shares=attendanceShares(...counts);
  assert.equal(Math.round(shares.reduce((a,b)=>a+b,0)*10),1000);
 }
 assert.equal(attendanceShares(0,0,0),null);
 assert.equal(attendancePercentage(0,0,0),null);
});
test('multi-month recap preserves per-person months with no data as gaps',()=>{
 const mk=(month,H,I,persons)=>({month,summary:{H,I,A:0,pending:0,meetings:1},individuals:persons,meetings:[]});
 const p=(id,H,I,date)=>({id,name:id,class_name:'A',H,I,A:0,pending:0,percentage:null,dates:{H:H?[date]:[],I:I?[date]:[],A:[]}});
 const result=mergeRecapMonths([mk('2026-02',1,0,[p('a',1,0,'2026-02-01')]),mk('2026-01',0,1,[p('b',0,1,'2026-01-01')])]);
 assert.equal(result.summary.meetings,2);
 assert.equal(result.individuals.find(x=>x.id==='a').monthly[0].percentage,null);
 assert.equal(result.individuals.find(x=>x.id==='a').monthly[1].percentage,100);
});
