
drop policy if exists airo_evidence_qa_delete on storage.objects;
create policy airo_evidence_qa_delete
on storage.objects
for delete
to anon,authenticated
using (
  bucket_id='airo-evidence'
  and (storage.foldername(name))[1]='qa'
  and nullif(
    coalesce(current_setting('request.headers',true),'{}')::jsonb ->> 'x-airo-storage-qa',
    ''
  )='probe'
);

