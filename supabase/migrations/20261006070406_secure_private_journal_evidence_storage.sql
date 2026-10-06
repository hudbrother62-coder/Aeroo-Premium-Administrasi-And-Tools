
drop policy if exists airo_evidence_qa_insert on storage.objects;
drop policy if exists airo_evidence_qa_delete on storage.objects;

create or replace function public.safe_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path=''
as $$
begin
  return p_value::uuid;
exception when invalid_text_representation then
  return null;
end
$$;

drop policy if exists airo_evidence_read on storage.objects;
create policy airo_evidence_read
on storage.objects
for select
to anon,authenticated
using (
  bucket_id='airo-evidence'
  and (storage.foldername(name))[1]='journals'
  and public.safe_uuid((storage.foldername(name))[2]) is not null
  and public.can_read_journal_id(public.safe_uuid((storage.foldername(name))[2]))
);

drop policy if exists airo_evidence_insert on storage.objects;
create policy airo_evidence_insert
on storage.objects
for insert
to anon,authenticated
with check (
  bucket_id='airo-evidence'
  and (storage.foldername(name))[1]='journals'
  and public.safe_uuid((storage.foldername(name))[2]) is not null
  and public.can_write_journal_id(public.safe_uuid((storage.foldername(name))[2]))
);

drop policy if exists airo_evidence_update on storage.objects;
create policy airo_evidence_update
on storage.objects
for update
to anon,authenticated
using (
  bucket_id='airo-evidence'
  and (storage.foldername(name))[1]='journals'
  and public.safe_uuid((storage.foldername(name))[2]) is not null
  and public.can_write_journal_id(public.safe_uuid((storage.foldername(name))[2]))
)
with check (
  bucket_id='airo-evidence'
  and (storage.foldername(name))[1]='journals'
  and public.safe_uuid((storage.foldername(name))[2]) is not null
  and public.can_write_journal_id(public.safe_uuid((storage.foldername(name))[2]))
);

drop policy if exists airo_evidence_delete on storage.objects;
create policy airo_evidence_delete
on storage.objects
for delete
to anon,authenticated
using (
  bucket_id='airo-evidence'
  and (storage.foldername(name))[1]='journals'
  and public.safe_uuid((storage.foldername(name))[2]) is not null
  and public.can_write_journal_id(public.safe_uuid((storage.foldername(name))[2]))
);

drop policy if exists journal_attachments_write on public.journal_attachments;
create policy journal_attachments_insert on public.journal_attachments
for insert to anon,authenticated
with check (public.can_write_journal_id(journal_id));
create policy journal_attachments_update on public.journal_attachments
for update to anon,authenticated
using (public.can_write_journal_id(journal_id))
with check (public.can_write_journal_id(journal_id));
create policy journal_attachments_delete on public.journal_attachments
for delete to anon,authenticated
using (public.can_write_journal_id(journal_id));

