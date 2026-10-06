const test=require('node:test'),assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs'),Module=require('node:module');
const m=new Module(require('node:path').resolve('lib/evidence.ts'));
m._compile(ts.transpileModule(fs.readFileSync(m.id,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,m.id);
const {safeEvidenceName,validateEvidenceMeta,evidenceContentDisposition,EVIDENCE_MAX_BYTES}=m.exports;

test('evidence file validation accepts supported private document types',()=>{
  assert.deepEqual(validateEvidenceMeta({name:'Bukti rapat.pdf',type:'application/pdf',size:1024}),{name:'Bukti rapat.pdf',type:'application/pdf',size:1024});
  assert.equal(validateEvidenceMeta({name:'foto.webp',type:'image/webp',size:EVIDENCE_MAX_BYTES}).type,'image/webp');
});

test('evidence validation rejects empty, oversized and unsafe types',()=>{
  assert.throws(()=>validateEvidenceMeta({name:'a.pdf',type:'application/pdf',size:0}));
  assert.throws(()=>validateEvidenceMeta({name:'a.pdf',type:'application/pdf',size:EVIDENCE_MAX_BYTES+1}));
  assert.throws(()=>validateEvidenceMeta({name:'script.svg',type:'image/svg+xml',size:100}));
});

test('evidence filenames are sanitized and download disposition is safe',()=>{
  assert.equal(safeEvidenceName('../bukti/rapat?.pdf'),'..-bukti-rapat-.pdf');
  const header=evidenceContentDisposition('Bukti Rapat.pdf');
  assert.match(header,/attachment; filename\*=UTF-8''/);
  assert.match(header,/Bukti%20Rapat.pdf/);
});
