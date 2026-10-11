-- Atomic creation and editing: an account and its checked permissions must be saved together.
-- Uses the existing guarded admin RPCs; no broad service keys or public table writes.
create or replace function public.admin_create_app_user_with_access(
  p_username text,p_password text,p_display_name text,p_role public.app_role,
  p_scopes jsonb,p_permissions jsonb,p_class_scope jsonb default null
) returns uuid
language plpgsql security invoker set search_path=''
as $$
declare v_user_id uuid;
begin
  v_user_id:=public.admin_create_app_user(p_username,p_password,p_display_name,p_role);
  perform public.admin_save_user_access_v2(v_user_id,p_scopes,p_permissions,p_class_scope);
  return v_user_id;
end;
$$;

create or replace function public.admin_update_app_user_with_access(
  p_user_id uuid,p_display_name text,p_role public.app_role,p_active boolean,p_new_password text,
  p_scopes jsonb,p_permissions jsonb,p_class_scope jsonb default null
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
begin
  perform public.admin_update_app_user(p_user_id,p_display_name,p_role,p_active,p_new_password);
  return public.admin_save_user_access_v2(p_user_id,p_scopes,p_permissions,p_class_scope);
end;
$$;

revoke all on function public.admin_create_app_user_with_access(text,text,text,public.app_role,jsonb,jsonb,jsonb) from public;
revoke all on function public.admin_update_app_user_with_access(uuid,text,public.app_role,boolean,text,jsonb,jsonb,jsonb) from public;
grant execute on function public.admin_create_app_user_with_access(text,text,text,public.app_role,jsonb,jsonb,jsonb) to anon,authenticated;
grant execute on function public.admin_update_app_user_with_access(uuid,text,public.app_role,boolean,text,jsonb,jsonb,jsonb) to anon,authenticated;
