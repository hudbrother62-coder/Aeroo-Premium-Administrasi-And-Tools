create or replace function public.admin_save_user_access(
  p_user_id uuid,
  p_scopes jsonb,
  p_permissions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security='off'
as $$
declare
  scope_row jsonb;
  permission_row jsonb;
  v_audience public.audience_type;
  v_permission text;
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then
    raise exception 'Akses ditolak';
  end if;

  if not exists(select 1 from public.app_users where id=p_user_id) then
    raise exception 'Akun tidak ditemukan';
  end if;

  if p_scopes is null or jsonb_typeof(p_scopes)<>'array' then
    raise exception 'Daftar scope tidak valid';
  end if;
  if p_permissions is null or jsonb_typeof(p_permissions)<>'array' then
    raise exception 'Daftar permission tidak valid';
  end if;

  delete from public.user_audience_scopes where user_id=p_user_id;
  for scope_row in select value from jsonb_array_elements(p_scopes) loop
    begin
      v_audience:=(scope_row->>'audience')::public.audience_type;
    exception when others then
      raise exception 'Audience tidak valid';
    end;

    if v_audience not in ('KELOMPOK','CABERAWIT','MUDA_MUDI','IBU_IBU','PENGURUS') then
      raise exception 'Audience tidak diizinkan';
    end if;

    insert into public.user_audience_scopes(user_id,audience,can_read,can_write)
    values(
      p_user_id,
      v_audience,
      coalesce((scope_row->>'can_read')::boolean,false) or coalesce((scope_row->>'can_write')::boolean,false),
      coalesce((scope_row->>'can_write')::boolean,false)
    );
  end loop;

  delete from public.user_permissions where user_id=p_user_id;
  for permission_row in select value from jsonb_array_elements(p_permissions) loop
    v_permission:=permission_row->>'permission';
    if v_permission not in (
      'person.read','person.write','agenda.read','agenda.write',
      'attendance.read','attendance.write','journal.read','journal.write',
      'target.read','target.write','position.read','position.write',
      'decision.write','report.read','report.publish','import.manage',
      'archive.manage','user.manage','settings.manage'
    ) then
      raise exception 'Permission tidak diizinkan';
    end if;

    insert into public.user_permissions(user_id,permission,allowed)
    values(p_user_id,v_permission,coalesce((permission_row->>'allowed')::boolean,false));
  end loop;

  return jsonb_build_object(
    'scopes',(select count(*) from public.user_audience_scopes where user_id=p_user_id),
    'permissions',(select count(*) from public.user_permissions where user_id=p_user_id)
  );
end
$$;

revoke all on function public.admin_save_user_access(uuid,jsonb,jsonb) from public;
grant execute on function public.admin_save_user_access(uuid,jsonb,jsonb) to anon,authenticated;
