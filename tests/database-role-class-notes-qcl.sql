begin;

do $$
declare
  f text;
  p text;
begin
  if to_regclass('public.user_class_scopes') is null then raise exception 'FAIL: user_class_scopes missing'; end if;
  if to_regclass('public.context_notes') is null then raise exception 'FAIL: context_notes missing'; end if;

  if not exists(
    select 1 from pg_constraint
    where conrelid='public.user_class_scopes'::regclass and contype='p'
  ) then raise exception 'FAIL: user_class_scopes must enforce one row per user'; end if;

  if not exists(
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='context_notes' and c.relrowsecurity
  ) then raise exception 'FAIL: context_notes RLS disabled'; end if;

  select pg_get_functiondef(p.oid) into f
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='can_read_member';
  if position('can_read_caberawit_class' in coalesce(f,''))=0 then raise exception 'FAIL: member access is not class-aware'; end if;

  select pg_get_functiondef(p.oid) into f
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='save_agenda';
  if position('can_write_scoped_audience' in coalesce(f,''))=0 then raise exception 'FAIL: save_agenda is not class-aware'; end if;

  select pg_get_functiondef(p.oid) into f
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='ensure_attendance';
  if position('can_write_scoped_audience' in coalesce(f,''))=0 then raise exception 'FAIL: ensure_attendance is not class-aware'; end if;

  select pg_get_functiondef(p.oid) into f
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='save_journal';
  if position('Kelas Caberawit di luar akses' in coalesce(f,''))=0 then raise exception 'FAIL: save_journal class guard missing'; end if;

  select pg_get_functiondef(p.oid) into f
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='admin_save_user_access_v2';
  if position('Scope kelas Caberawit hanya untuk Dewan Guru' in coalesce(f,''))=0 then raise exception 'FAIL: class assignment role guard missing'; end if;

  select pg_get_functiondef(p.oid) into f
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='save_member';
  if position('Kelas Caberawit di luar akses' in coalesce(f,''))=0 then raise exception 'FAIL: member class write guard missing'; end if;

  select pg_get_functiondef(p.oid) into f
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='save_learning_target';
  if position('can_write_class' in coalesce(f,''))=0 then raise exception 'FAIL: target class write guard missing'; end if;

  select qual into p from pg_policies
  where schemaname='public' and tablename='caberawit' and policyname='caberawit_read';
  if position('can_read_audience_global' in coalesce(p,''))=0 then raise exception 'FAIL: legacy Caberawit still leaks to any Dewan Guru'; end if;

  select qual into p from pg_policies
  where schemaname='public' and tablename='classes' and policyname='classes_read';
  if position('can_read_caberawit_class' in coalesce(p,''))=0 then raise exception 'FAIL: Caberawit class catalog not scope-aware'; end if;

  if exists(
    select 1 from public.personal_notes pn
    where not exists(select 1 from public.context_notes cn where cn.id=pn.id and cn.visibility='PRIVATE')
  ) then raise exception 'FAIL: legacy personal notes not preserved'; end if;

  if exists(
    select 1 from public.app_users u
    where u.role='DEWAN_GURU' and u.active
      and not exists(select 1 from public.user_audience_scopes s where s.user_id=u.id and s.audience='CABERAWIT' and s.can_read)
      and not exists(select 1 from public.user_class_scopes cs where cs.user_id=u.id and cs.can_read)
  ) then raise exception 'FAIL: active Dewan Guru lost all Caberawit access during migration'; end if;
end $$;

select 'PASS: role separation, one-class Dewan Guru scope, scoped notes and legacy preservation' result;
rollback;
