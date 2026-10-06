
create table if not exists public.user_permissions (
  user_id uuid not null references public.app_users(id) on delete cascade,
  permission text not null,
  allowed boolean not null default true,
  primary key(user_id,permission)
);
alter table public.user_permissions enable row level security;
drop policy if exists user_permissions_admin on public.user_permissions;
create policy user_permissions_admin on public.user_permissions
for all to anon, authenticated
using ((select public.current_app_role())='ADMIN'::public.app_role)
with check ((select public.current_app_role())='ADMIN'::public.app_role);

create table if not exists public.user_audience_scopes (
  user_id uuid not null references public.app_users(id) on delete cascade,
  audience public.audience_type not null,
  can_read boolean not null default true,
  can_write boolean not null default false,
  primary key(user_id,audience)
);
alter table public.user_audience_scopes enable row level security;
drop policy if exists user_audience_scopes_admin on public.user_audience_scopes;
create policy user_audience_scopes_admin on public.user_audience_scopes
for all to anon, authenticated
using ((select public.current_app_role())='ADMIN'::public.app_role)
with check ((select public.current_app_role())='ADMIN'::public.app_role);

create or replace function public.has_app_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path=''
set row_security='off'
as $$
  select case
    when public.current_app_role()='ADMIN'::public.app_role then true
    when public.current_app_user_id() is null then false
    when exists (
      select 1 from public.user_permissions up
      where up.user_id=public.current_app_user_id()
        and up.permission=p_permission
    ) then coalesce((
      select up.allowed from public.user_permissions up
      where up.user_id=public.current_app_user_id()
        and up.permission=p_permission
    ),false)
    else case p_permission
      when 'person.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK','VIEWER')
      when 'person.write' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'attendance.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK','VIEWER')
      when 'attendance.write' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'journal.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK','VIEWER')
      when 'journal.write' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'target.read' then public.current_app_role() in ('DEWAN_GURU','VIEWER')
      when 'target.write' then public.current_app_role()='DEWAN_GURU'
      when 'report.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK','VIEWER')
      when 'note.write' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK','VIEWER')
      else false
    end
  end
$$;

create or replace function public.can_read_audience(p_audience public.audience_type)
returns boolean
language sql
stable
security definer
set search_path=''
set row_security='off'
as $$
  select case
    when public.current_app_role()='ADMIN'::public.app_role then true
    when public.current_app_user_id() is null then false
    when exists(select 1 from public.user_audience_scopes s where s.user_id=public.current_app_user_id())
      then coalesce((select s.can_read from public.user_audience_scopes s where s.user_id=public.current_app_user_id() and s.audience=p_audience),false)
    else case public.current_app_role()
      when 'DEWAN_GURU'::public.app_role then p_audience in ('CABERAWIT','MUDA_MUDI')
      when 'KELOMPOK'::public.app_role then p_audience in ('KELOMPOK','MUDA_MUDI','IBU_IBU','PENGURUS','CUSTOM')
      when 'VIEWER'::public.app_role then p_audience in ('KELOMPOK','CABERAWIT','MUDA_MUDI','IBU_IBU','CUSTOM')
      else false
    end
  end
$$;

create or replace function public.can_write_audience(p_audience public.audience_type)
returns boolean
language sql
stable
security definer
set search_path=''
set row_security='off'
as $$
  select case
    when public.current_app_role()='ADMIN'::public.app_role then true
    when public.current_app_user_id() is null then false
    when exists(select 1 from public.user_audience_scopes s where s.user_id=public.current_app_user_id())
      then coalesce((select s.can_write from public.user_audience_scopes s where s.user_id=public.current_app_user_id() and s.audience=p_audience),false)
    else case public.current_app_role()
      when 'DEWAN_GURU'::public.app_role then p_audience in ('CABERAWIT','MUDA_MUDI')
      when 'KELOMPOK'::public.app_role then p_audience in ('KELOMPOK','IBU_IBU','PENGURUS')
      else false
    end
  end
$$;

revoke execute on function public.has_app_permission(text) from public;
grant execute on function public.has_app_permission(text) to anon, authenticated;

