-- Username login is linked to the existing user ID; no password or session rotation.
-- Depends on the existing admin_update_app_user / admin_save_user_access_v2 RPCs.
create or replace function public.admin_change_app_username(p_user_id uuid,p_username text)
returns text language plpgsql security definer set search_path='' set row_security='off'
as $$
declare v_new text; v_old text;
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then raise exception 'forbidden'; end if;
  select username into v_old from public.app_users where id=p_user_id for update;
  if not found then raise exception 'user_not_found'; end if;
  if lower(v_old)='__aeroo_public_viewer_system__' then raise exception 'username_reserved'; end if;
  v_new:=lower(btrim(coalesce(p_username,'')));
  if v_new !~ '^[a-z0-9._-]{3,32}$' or v_new='__aeroo_public_viewer_system__' then
    raise exception 'invalid_username';
  end if;
  if v_old is distinct from v_new then
    update public.app_users set username=v_new,updated_at=now() where id=p_user_id;
  end if;
  return v_new;
exception when unique_violation then raise exception 'username_exists';
end;
$$;
revoke all on function public.admin_change_app_username(uuid,text) from public;
grant execute on function public.admin_change_app_username(uuid,text) to anon,authenticated;

create or replace function public.admin_update_app_user_profile(
  p_user_id uuid,p_display_name text,p_role public.app_role,p_active boolean,
  p_new_password text,p_username text default null,
  p_scopes jsonb default null,p_permissions jsonb default null,p_class_scope jsonb default null
) returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_username text; v_access jsonb;
begin
  if (p_scopes is null) <> (p_permissions is null) then raise exception 'Akses tidak lengkap'; end if;
  if p_username is not null then v_username:=public.admin_change_app_username(p_user_id,p_username); end if;
  perform public.admin_update_app_user(p_user_id,p_display_name,p_role,p_active,p_new_password);
  if p_scopes is not null then
    v_access:=public.admin_save_user_access_v2(p_user_id,p_scopes,p_permissions,p_class_scope);
  end if;
  return jsonb_build_object('ok',true,'username',v_username,'access',v_access);
end;
$$;
revoke all on function public.admin_update_app_user_profile(uuid,text,public.app_role,boolean,text,text,jsonb,jsonb,jsonb) from public;
grant execute on function public.admin_update_app_user_profile(uuid,text,public.app_role,boolean,text,text,jsonb,jsonb,jsonb) to anon,authenticated;
