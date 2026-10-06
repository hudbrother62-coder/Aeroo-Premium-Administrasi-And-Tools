
drop policy if exists airo_evidence_qa_insert on storage.objects;
create policy airo_evidence_qa_insert
on storage.objects
for insert
to anon,authenticated
with check (
  bucket_id='airo-evidence'
  and (storage.foldername(name))[1]='qa'
  and nullif(
    coalesce(current_setting('request.headers',true),'{}')::jsonb ->> 'x-airo-storage-qa',
    ''
  )='probe'
);

