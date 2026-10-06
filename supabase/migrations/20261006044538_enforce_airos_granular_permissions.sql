
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
      when 'agenda.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK','VIEWER')
      when 'agenda.write' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'attendance.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK','VIEWER')
      when 'attendance.write' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'journal.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK','VIEWER')
      when 'journal.write' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'target.read' then public.current_app_role() in ('DEWAN_GURU','VIEWER')
      when 'target.write' then public.current_app_role()='DEWAN_GURU'
      when 'position.read' then public.current_app_role()='KELOMPOK'
      when 'position.write' then public.current_app_role()='KELOMPOK'
      when 'decision.write' then public.current_app_role()='KELOMPOK'
      when 'report.read' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK','VIEWER')
      when 'report.publish' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'import.manage' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'archive.manage' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK')
      when 'note.write' then public.current_app_role() in ('DEWAN_GURU','KELOMPOK','VIEWER')
      else false
    end
  end
$$;

-- Members
drop policy if exists members_read on public.members;
create policy members_read on public.members for select to anon,authenticated
using (
  public.has_app_permission('person.read') and
  (
    public.current_app_role()='ADMIN'::public.app_role
    or (public.current_app_role()='DEWAN_GURU'::public.app_role and public.member_is_dewan_scope(id))
    or (public.current_app_role()='KELOMPOK'::public.app_role and public.member_is_kelompok_read_scope(id))
    or public.current_app_role()='VIEWER'::public.app_role
  )
);
drop policy if exists members_insert on public.members;
create policy members_insert on public.members for insert to anon,authenticated
with check (public.has_app_permission('person.write'));
drop policy if exists members_update on public.members;
create policy members_update on public.members for update to anon,authenticated
using (public.has_app_permission('person.write'))
with check (public.has_app_permission('person.write'));

-- Agenda
drop policy if exists agenda_read on public.agenda;
create policy agenda_read on public.agenda for select to anon,authenticated
using (public.has_app_permission('agenda.read') and public.can_read_audience(audience));
drop policy if exists agenda_write on public.agenda;
create policy agenda_write on public.agenda for all to anon,authenticated
using (public.has_app_permission('agenda.write') and public.can_write_audience(audience))
with check (public.has_app_permission('agenda.write') and public.can_write_audience(audience));

-- Attendance
drop policy if exists attendance_events_read on public.attendance_events;
create policy attendance_events_read on public.attendance_events for select to anon,authenticated
using (public.has_app_permission('attendance.read') and public.can_read_audience(audience));
drop policy if exists attendance_events_insert on public.attendance_events;
create policy attendance_events_insert on public.attendance_events for insert to anon,authenticated
with check (public.has_app_permission('attendance.write') and public.can_write_audience(audience));
drop policy if exists attendance_events_update on public.attendance_events;
create policy attendance_events_update on public.attendance_events for update to anon,authenticated
using (public.has_app_permission('attendance.write') and public.can_write_audience(audience))
with check (public.has_app_permission('attendance.write') and public.can_write_audience(audience));
drop policy if exists attendance_events_delete on public.attendance_events;
create policy attendance_events_delete on public.attendance_events for delete to anon,authenticated
using (public.has_app_permission('attendance.write') and public.can_write_audience(audience));
drop policy if exists attendance_records_read on public.attendance_records;
create policy attendance_records_read on public.attendance_records for select to anon,authenticated
using (public.has_app_permission('attendance.read') and public.can_read_event(event_id));
drop policy if exists attendance_records_write on public.attendance_records;
create policy attendance_records_write on public.attendance_records for all to anon,authenticated
using (public.has_app_permission('attendance.write') and public.can_write_event(event_id))
with check (public.has_app_permission('attendance.write') and public.can_write_event(event_id));

-- Journals
drop policy if exists journals_read on public.journals;
create policy journals_read on public.journals for select to anon,authenticated
using (public.has_app_permission('journal.read') and public.can_read_audience(public.journal_audience(journal_kind)));
drop policy if exists journals_write on public.journals;
create policy journals_write on public.journals for all to anon,authenticated
using (public.has_app_permission('journal.write') and public.can_write_journal(event_id,activity_type_id))
with check (public.has_app_permission('journal.write') and public.can_write_journal(event_id,activity_type_id));

-- Target
drop policy if exists learning_targets_read on public.learning_targets;
create policy learning_targets_read on public.learning_targets for select to anon,authenticated
using (public.has_app_permission('target.read'));
drop policy if exists learning_targets_write on public.learning_targets;
create policy learning_targets_write on public.learning_targets for all to anon,authenticated
using (public.has_app_permission('target.write'))
with check (public.has_app_permission('target.write'));

-- Positions
drop policy if exists positions_internal_read on public.organizational_positions;
create policy positions_internal_read on public.organizational_positions for select to anon,authenticated
using (public.has_app_permission('position.read'));

