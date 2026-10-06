begin;

do $$
declare f text;
begin
  select pg_get_functiondef(p.oid) into f
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='admin_list_audit_logs';
  if f is null or position('current_app_role' in f)=0 or position('ADMIN' in f)=0 then
    raise exception 'FAIL: audit RPC missing admin guard';
  end if;

  select pg_get_functiondef(p.oid) into f
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='deactivate_organizational_position';
  if f is null or position('Akses dapukan ditolak' in f)=0 then
    raise exception 'FAIL: dapukan deactivation guard missing';
  end if;

  select pg_get_functiondef(p.oid) into f
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='save_organizational_position';
  if f is null or position('Dapukan dan tanggal mulai wajib diisi' in f)=0 or position('new_valid_to' in f)=0 then
    raise exception 'FAIL: dapukan save semantics not updated';
  end if;
end $$;

do $$
begin
  begin
    perform public.admin_list_audit_logs(null,null,1);
    raise exception 'FAIL: anonymous audit call unexpectedly allowed';
  exception
    when others then
      if sqlerrm='FAIL: anonymous audit call unexpectedly allowed' then raise; end if;
      if position('Akses audit ditolak' in sqlerrm)=0 then raise; end if;
  end;
end $$;

select 'PASS: Simpul audit and dapukan guards' as result;
rollback;
