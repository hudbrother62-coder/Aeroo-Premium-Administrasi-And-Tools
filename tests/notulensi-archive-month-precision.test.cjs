const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('five-element historical records use nullable dates, independent of journals',()=>{
 const sql=fs.readFileSync('supabase/migrations/20261023001000_create_month_precise_meeting_minutes_archives.sql','utf8');
 assert.match(sql,/meeting_date date NULL/);
 assert.match(sql,/date_status='EXACT' AND meeting_date IS NOT NULL/);
 assert.match(sql,/UNIQUE\(source_document_id,source_section_key\)/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/has_app_permission\('journal.read'/);
});
test('archive UI avoids inventing a date and renders source sections',()=>{
 const ui=fs.readFileSync('components/MinutesArchiveEntry.tsx','utf8');
 const page=fs.readFileSync('app/notulensi/page.tsx','utf8');
 assert.match(ui,/Tanggal pertemuan belum tercantum/);
 assert.match(ui,/Perlu verifikasi bulan \/ tanggal/);
 assert.match(ui,/item.sections.map/);
 assert.match(page,/\/api\/notulensi\/arsip/);
 assert.match(page,/count===1|collapsed=!opened/);
});
