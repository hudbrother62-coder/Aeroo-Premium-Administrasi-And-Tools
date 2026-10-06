
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
      where up.user_id=public.current_app_user_id() and up.permission=p_permission
    ) then coalesce((
      select up.allowed from public.user_permissions up
      where up.user_id=public.current_app_user_id() and up.permission=p_permission
    ),false)
    else case p_permission
      when 'person.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'person.write' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'agenda.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'agenda.write' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'attendance.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'attendance.write' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'journal.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'journal.write' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'target.read' then public.current_app_role()='DEWAN_GURU'
      when 'target.write' then public.current_app_role()='DEWAN_GURU'
      when 'position.read' then public.current_app_role()='KELOMPOK'
      when 'position.write' then public.current_app_role()='KELOMPOK'
      when 'decision.write' then public.current_app_role()='KELOMPOK'
      when 'report.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'report.publish' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'import.manage' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'archive.manage' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
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
    when public.current_app_role()='VIEWER'::public.app_role then false
    when exists(select 1 from public.user_audience_scopes s where s.user_id=public.current_app_user_id())
      then coalesce((select s.can_read from public.user_audience_scopes s where s.user_id=public.current_app_user_id() and s.audience=p_audience),false)
    else case public.current_app_role()
      when 'DEWAN_GURU'::public.app_role then p_audience in ('CABERAWIT','MUDA_MUDI')
      when 'KELOMPOK'::public.app_role then p_audience in ('KELOMPOK','MUDA_MUDI','IBU_IBU','PENGURUS','CUSTOM')
      else false
    end
  end
$$;

drop policy if exists members_read on public.members;
create policy members_read on public.members for select to anon,authenticated
using (
  public.has_app_permission('person.read') and
  (
    public.current_app_role()='ADMIN'::public.app_role
    or (public.current_app_role()='DEWAN_GURU'::public.app_role and public.member_is_dewan_scope(id))
    or (public.current_app_role()='KELOMPOK'::public.app_role and public.member_is_kelompok_read_scope(id))
  )
);

