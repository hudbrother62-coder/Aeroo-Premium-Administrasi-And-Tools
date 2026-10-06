
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'airo-evidence',
  'airo-evidence',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']::text[]
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists airo_evidence_qa_insert on storage.objects;
create policy airo_evidence_qa_insert
on storage.objects
for insert
to anon,authenticated
with check (
  bucket_id='airo-evidence'
  and public.current_app_user_id() is not null
  and (storage.foldername(name))[1]='qa'
);

