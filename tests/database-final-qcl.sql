begin;

do $$
declare
  blocked boolean:=false;
  policy_count integer;
begin
  if to_regprocedure('public.admin_save_user_access(uuid,jsonb,jsonb)') is null then
    raise exception 'Atomic admin access RPC missing';
  end if;

  if position(
    'current_app_role() is distinct from ''ADMIN'''
    in pg_get_functiondef('public.admin_save_user_access(uuid,jsonb,jsonb)'::regprocedure)
  )=0 then
    raise exception 'Admin access RPC lacks role guard';
  end if;

  begin
    perform public.admin_save_user_access(
      '00000000-0000-0000-0000-000000000000'::uuid,
      '[]'::jsonb,
      '[]'::jsonb
    );
  exception when others then
    blocked:=true;
  end;
  if not blocked then raise exception 'Anonymous access mutation allowed'; end if;

  if not exists(
    select 1 from storage.buckets
    where id='airo-evidence' and public=false and file_size_limit=10485760
  ) then
    raise exception 'Private evidence bucket configuration missing';
  end if;

  select count(*) into policy_count
  from pg_policies
  where schemaname='storage'
    and tablename='objects'
    and policyname in (
      'airo_evidence_read','airo_evidence_insert',
      'airo_evidence_update','airo_evidence_delete'
    );
  if policy_count<>4 then
    raise exception 'Evidence storage policies incomplete';
  end if;

  if coalesce((select value->>'name' from public.app_settings where key='group_info'),'')<>'Kelompok Pengorgan' then
    raise exception 'Workspace branding setting is stale';
  end if;

  if coalesce((select value->>'title' from public.app_settings where key='usage_manual'),'')<>'Panduan Penggunaan AIRO' then
    raise exception 'Manual title setting is stale';
  end if;
end $$;

select 'PASS: atomic admin access, anonymous denial, private evidence storage and final settings' as result;
rollback;
