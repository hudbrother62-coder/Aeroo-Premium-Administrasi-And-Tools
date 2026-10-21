const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');
const shell=read('components/AppShell.tsx');
const middle=read('middleware.ts');
const dashboard=read('app/page.tsx');
const database=read('app/database/page.tsx');
const journal=read('app/jurnal/page.tsx');
const recap=read('app/rekap/page.tsx');

test('anonymous and viewer accounts get the same read-only sidebar',()=>{
  const match=shell.match(/const viewerRoutes=new Set\(\[([^\]]+)\]\)/);
  assert.ok(match,'Viewer allowlist must exist');
  const routes=Array.from(match[1].matchAll(/'([^']+)'/g),m=>m[1]);
  assert.deepEqual(routes,['/','/agenda','/database','/jurnal','/target','/rekap']);
  assert.ok(shell.includes("(!user||user.role==='VIEWER')?nav.filter(x=>viewerRoutes.has(x.href))"));
  for(const restricted of ['/presensi','/laporan','/catatan','/tim-akses','/pengaturan'])assert.ok(!routes.includes(restricted));
});
test('viewer public links resolve to read-only URLs',()=>{
  assert.ok(middle.includes("'/agenda/kalender'"));
  assert.ok(middle.includes("'/api/targets/catalog'"));
  assert.ok(shell.includes('Daftar Kegiatan'));
  assert.ok(dashboard.includes('loggedIn?"/presensi/rekap":"/rekap?tab=presensi"'));
  assert.ok(dashboard.includes('loggedIn?"/laporan":"/rekap"'));
});
test('viewer cannot navigate from read-only screens into restricted forms',()=>{
  assert.ok(database.includes("role==='VIEWER'?<span className=\"mobileMemberName\""));
  assert.ok(database.includes("role!=='VIEWER'&&<Link className=\"mobileMemberDetail\""));
  assert.ok(journal.includes("role!=='VIEWER'&&<nav className=\"journalSubnav\""));
  assert.ok(recap.includes("role!=='VIEWER'&&<div className=\"taskLinks\""));
});
