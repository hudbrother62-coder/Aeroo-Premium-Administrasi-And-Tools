const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/domain.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require,Date,Intl,Map,Set});const d=m.exports;
test('expired legacy placement never overrides a scheduled membership transition',()=>{
 const person={class_id:'stale',classes:{name:'Stale'},member_categories:[{category_id:'legacy'}],member_memberships:[{id:'old',category_id:'c',active:false,valid_from:'2026-01-01',valid_to:'2026-10-11',ended_on:'2026-10-12',class_id:'old',level_id:'l1',classes:{name:'Old'},levels:{name:'L1'},categories:{slug:'caberawit',name:'Caberawit'}},{id:'new',category_id:'c',active:true,valid_from:'2026-10-12',class_id:'new',level_id:'l2',classes:{name:'New'},levels:{name:'L2'},categories:{slug:'caberawit',name:'Caberawit'}}]};
 assert.equal(typeof d.projectMember,'function');assert.equal(d.projectMember(person,'2026-10-05').class_id,'old');assert.equal(d.projectMember(person,'2026-10-12').class_id,'new');assert.equal(d.projectMember(person,'2026-10-05').member_categories.length,1);assert.equal(person.class_id,'stale');
});
test('general members have no synthetic program and positions do not become learning categories',()=>{
 assert.equal(typeof d.projectMember,'function');const p=d.projectMember({member_memberships:[{category_id:'p',active:true,categories:{slug:'pengurus',name:'Pengurus'}}]},'2026-10-05');assert.equal(p.member_categories.length,0);assert.equal(p.class_id,null);
});
test('a dated closed membership remains eligible inside its historical interval',()=>{assert.equal(d.effectiveMembership({active:false,valid_from:'2026-01-01',valid_to:'2026-10-11'},'2026-10-05'),true);assert.equal(d.effectiveMembership({active:false,valid_from:'2026-01-01'},'2026-10-05'),false)});
