-- Simpul admin audit feed and dapukan lifecycle controls.
create or replace function public.admin_list_audit_logs(
  p_resource text default null,
  p_action text default null,
  p_limit integer default 200
)
returns table(
  id bigint,
  actor_user_id uuid,
  actor_name text,
  actor_username text,
  action text,
  resource_type text,
  resource_id text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path=''
set row_security='off'
as $$
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then
    raise exception 'Akses audit ditolak';
  end if;
  return query
  select a.id,a.actor_user_id,u.display_name,u.username,a.action,a.resource_type,a.resource_id,a.created_at
  from public.audit_logs a
  left join public.app_users u on u.id=a.actor_user_id
  where (nullif(p_resource,'') is null or a.resource_type=p_resource)
    and (nullif(p_action,'') is null or a.action=p_action)
  order by a.created_at desc
  limit greatest(1,least(coalesce(p_limit,200),500));
end
$$;

revoke all on function public.admin_list_audit_logs(text,text,integer) from public;
grant execute on function public.admin_list_audit_logs(text,text,integer) to anon, authenticated;

create or replace function public.deactivate_organizational_position(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security='off'
as $$
declare r public.organizational_positions%rowtype;
begin
  if public.current_app_role() is null or public.current_app_role() not in ('ADMIN','KELOMPOK') then
    raise exception 'Akses dapukan ditolak';
  end if;
  update public.organizational_positions
  set active=false,
      valid_to=coalesce(valid_to,(now() at time zone 'Asia/Jakarta')::date),
      revision=revision+1,
      updated_at=now()
  where id=p_id
  returning * into r;
  if not found then raise exception 'Dapukan tidak ditemukan'; end if;
  return to_jsonb(r);
end
$$;

revoke all on function public.deactivate_organizational_position(uuid) from public;
grant execute on function public.deactivate_organizational_position(uuid) to anon, authenticated;
