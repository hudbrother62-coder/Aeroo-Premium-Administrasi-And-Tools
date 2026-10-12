const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const tsx=fs.readFileSync('app/target/TargetReview.tsx','utf8');
const css=fs.readFileSync('app/target/review.css','utf8');

test('target and parent detail portals render outside scrolling app shell',()=>{
  assert.match(tsx,/import\s*\{createPortal\}\s*from\s*'react-dom'/);
  assert.equal((tsx.match(/createPortal\(<div className="tr-shell tr-overlay-root">/g)||[]).length,2);
  assert.equal((tsx.match(/<\/div><\/div>,document\.body\)/g)||[]).length,2);
});

test('popup locking, backdrop, keyboard close, and focus return are present',()=>{
  assert.match(tsx,/document\.body\.style\.overflow='hidden'/);
  assert.match(tsx,/document\.body\.style\.overflow=previousBodyOverflow/);
  assert.match(tsx,/if\(e\.key==='Escape'\)/);
  assert.match(tsx,/previousFocus\?\.focus\(\{preventScroll:true\}\)/);
  assert.match(css,/\.tr-overlay-root\{position:fixed;inset:0;z-index:10000/);
  assert.match(css,/\.tr-overlay-root \.tr-modal-body\{min-height:0;overflow-y:auto/);
});
