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


create or replace function public.save_organizational_position(p_id uuid, p_revision integer, p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security='off'
as $$
declare r public.organizational_positions%rowtype; person uuid; new_valid_to date;
begin
  if public.current_app_role() is null or public.current_app_role() not in ('ADMIN','KELOMPOK') then
    raise exception 'Akses dapukan ditolak';
  end if;
  if p_revision is null or p_revision<0 then raise exception 'Revisi tidak valid'; end if;
  person:=(p_body->>'member_id')::uuid;
  if not exists(select 1 from public.members where id=person and status='ACTIVE') then
    raise exception 'Anggota aktif wajib dipilih';
  end if;
  if length(trim(coalesce(p_body->>'title','')))=0 or (p_body->>'valid_from') is null then
    raise exception 'Dapukan dan tanggal mulai wajib diisi';
  end if;
  if p_id is not null then
    select * into r from public.organizational_positions where id=p_id for update;
    if not found then raise exception 'Dapukan tidak ditemukan'; end if;
    if r.revision<>p_revision then raise exception 'CONFLICT: Dapukan sudah diubah'; end if;
    new_valid_to := case when p_body ? 'valid_to' then nullif(p_body->>'valid_to','')::date else r.valid_to end;
    update public.organizational_positions
    set member_id=person,title=trim(p_body->>'title'),section=coalesce(p_body->>'section',''),
        duties=coalesce(p_body->>'duties',''),valid_from=(p_body->>'valid_from')::date,
        valid_to=new_valid_to,active=coalesce((p_body->>'active')::boolean,r.active),
        revision=revision+1,updated_at=now()
    where id=p_id returning * into r;
  else
    insert into public.organizational_positions(member_id,title,section,duties,valid_from,valid_to)
    values(person,trim(p_body->>'title'),coalesce(p_body->>'section',''),coalesce(p_body->>'duties',''),(p_body->>'valid_from')::date,null)
    returning * into r;
  end if;
  return to_jsonb(r);
end
$$;
