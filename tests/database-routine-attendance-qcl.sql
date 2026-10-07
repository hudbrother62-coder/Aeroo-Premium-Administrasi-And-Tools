begin;

do $$
declare f text;
begin
  if not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='attendance_events' and column_name='teacher_name'
  ) then raise exception 'FAIL: attendance_events.teacher_name missing'; end if;

  if (select count(*) from public.classes
      where audience='CABERAWIT' and active
        and name in ('PAUD Kecil','PAUD Besar','Kelas A','Kelas B','Kelas C')) <> 5
  then raise exception 'FAIL: five Caberawit classes not available'; end if;

  select pg_get_functiondef(p.oid) into f
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='ensure_attendance';

  if f is null or position('Kelas Caberawit wajib dipilih' in f)=0
     or position('Dewan Guru yang mengajar wajib diisi' in f)=0
  then raise exception 'FAIL: Caberawit attendance guards missing'; end if;
end $$;

select 'PASS: routine attendance schema and guards' result;
rollback;
