
drop policy if exists user_permissions_owner_read on public.user_permissions;
create policy user_permissions_owner_read on public.user_permissions
for select to anon, authenticated
using (user_id=(select public.current_app_user_id()));

drop policy if exists user_audience_scopes_owner_read on public.user_audience_scopes;
create policy user_audience_scopes_owner_read on public.user_audience_scopes
for select to anon, authenticated
using (user_id=(select public.current_app_user_id()));

revoke execute on function public.audit_resource_change() from public, anon, authenticated;

