const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const Module=require('node:module');
const p=require('node:path').resolve('lib/attendance-report.ts');
const m=new Module(p);
m.filename=p;
m.paths=module.paths;
const originalRequire=m.require.bind(m);
m.require=(name)=>{
  if(name==='server-only'||name==='next/server')return {};
  if(name==='./supabase-server')return {};
  if(name==='./domain')return {validDate:(d)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d};
  return originalRequire(name);
};
m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,p);
const {attendanceMetrics,reportTables,checkedReportParams}=m.exports;
test('only entered H/I/A determine presence rate, pending is independent',()=>{
  assert.deepEqual(attendanceMetrics([{status:'H'},{status:'I'},{status:'A'},{status:null}]),
    {H:1,I:1,A:1,pending:1,total:4,percentage:33.3});
  assert.equal(attendanceMetrics([{status:null}]).percentage,null);
});
test('event totals and person detail share same source and never turn blank into absence',()=>{
  const events=[{id:'a',title:'Pengajian',event_date:'2026-10-02',audience:'CABERAWIT',
    attendance_records:[
      {status:'H',member_name_snapshot:'Ayu',class_name_snapshot:'SD 1'},
      {status:null,member_name_snapshot:'Bagus',class_name_snapshot:'SD 1'},
    ]}];
  const report=reportTables(events);
  assert.equal(report.summary.meetings,1);
  assert.equal(report.summary.pending,1);
  assert.equal(report.summary.A,0);
  assert.equal(report.rows[0]['Total peserta'],2);
  assert.equal(report.details[1].Status,'Belum absen');
});
test('report filters reject invalid dates, swapped periods and unknown audiences',()=>{
  assert.throws(()=>checkedReportParams('2026-11-01','2026-10-01',null));
  assert.throws(()=>checkedReportParams('2026-02-30','2026-03-01',null));
  assert.throws(()=>checkedReportParams('2026-10-01','2026-10-05','PRIVATE'));
  assert.equal(checkedReportParams('2026-10-01','2026-10-05','CABERAWIT').audience,'CABERAWIT');
});
