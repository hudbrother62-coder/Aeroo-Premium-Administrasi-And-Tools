const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/member-payload.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports});
const {normalizeMemberships}=m.exports;
test('legacy positions do not block a Caberawit class transfer',()=>{
 const old={id:'old',category_id:'caberawit',class_id:'kelas-b',level_id:'sd5',section:'Caberawit',office:'Pengurus',duties:'legacy',valid_from:'2026-10-06',active:true};
 const [p]=normalizeMemberships([{...old,class_id:'kelas-c',level_id:null}]);
 assert.equal(p.class_id,'kelas-c');assert.equal(p.level_id,null);assert.equal(p.id,'old');
 assert.equal(p.valid_from,'2026-10-06');
 for(const forbidden of ['section','office','duties'])assert.equal(Object.hasOwn(p,forbidden),false);
 assert.equal(old.class_id,'kelas-b');
});
test('new Caberawit membership does not require jenjang',()=>{
 const [p]=normalizeMemberships([{category_id:'caberawit',class_id:'kelas-a',active:true}]);
 assert.equal(p.level_id,null);assert.equal(p.active,true);assert.equal(Object.hasOwn(p,'id'),false);
});
