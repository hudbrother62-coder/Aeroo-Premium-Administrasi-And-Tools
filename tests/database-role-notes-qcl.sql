begin;

do $$
declare f text;
begin
  if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='user_class_scopes') then
    raise exception 'FAIL: user_class_scopes missing';
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.user_class_scopes'::regclass and contype='p') then
    raise exception 'FAIL: class scope one-per-user key missing';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='personal_notes' and column_name='context_type') then
    raise exception 'FAIL: note context missing';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='personal_notes' and column_name='visibility') then
    raise exception 'FAIL: note visibility missing';
  end if;

  select pg_get_functiondef(p.oid) into f
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='save_context_note';

  if f is null
     or position('Akses menulis catatan ditolak' in f)=0
     or position('Konteks catatan di luar akses tulis' in f)=0
  then raise exception 'FAIL: scoped note write guard missing'; end if;

  select pg_get_functiondef(p.oid) into f
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='can_read_audience_global';
  if f is null or position('when ''DEWAN_GURU''::public.app_role then false' in f)=0 then
    raise exception 'FAIL: Dewan Guru still has implicit global audience';
  end if;

  select pg_get_functiondef(p.oid) into f
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='admin_save_user_access_v2';
  if f is null or position('Scope kelas Caberawit hanya untuk Dewan Guru' in f)=0 then
    raise exception 'FAIL: class scope admin guard missing';
  end if;
end $$;

select 'PASS: role separation, one-class Dewan Guru access, and context notes' result;
rollback;
