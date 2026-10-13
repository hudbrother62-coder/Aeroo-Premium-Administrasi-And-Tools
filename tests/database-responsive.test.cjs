const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const page=fs.readFileSync('app/database/page.tsx','utf8');
const layout=fs.readFileSync('app/layout.tsx','utf8');
const css=fs.readFileSync('app/database-responsive.css','utf8');

test('Database responsive stylesheet loads after global polish',()=>{
 assert.ok(layout.indexOf("import './database-responsive.css'")>layout.indexOf("import './design-polish.css'"));
 assert.match(page,/className="databasePage"/);
});
test('Mobile database filters and action buttons do not shrink into overlapping labels',()=>{
 assert.match(css,/\.databasePage \.databaseTools\{\s*display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.databasePage \.databaseActions\{\s*display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.databasePage \.databaseActions>\.btn\{[\s\S]*?white-space:normal;overflow-wrap:anywhere;/);
 assert.match(css,/body:has\(\.databasePage\) \.mobileQuickFab\{display:none!important\}/);
});
test('Desktop database tools wrap without clipping or compressing controls',()=>{
 assert.match(css,/display:flex;flex-wrap:wrap;align-items:stretch/);
 assert.match(css,/min-width:max-content;white-space:nowrap;/);
});
