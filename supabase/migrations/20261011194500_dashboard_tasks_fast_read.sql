-- Small independent task feed: a task failure must not block analytics.
create or replace function public.dashboard_task_snapshot_v1(p_level uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path to ''
set row_security to 'off'
as $fn$
declare
  v_role public.app_role;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_today_events jsonb := '[]'::jsonb;
  v_attendance jsonb := '[]'::jsonb;
  v_journals jsonb := '[]'::jsonb;
  v_decisions jsonb := '[]'::jsonb;
begin
  v_role := public.current_app_role();
  if v_role is null or v_role='VIEWER'::public.app_role then
    raise exception 'Login diperlukan untuk tindak lanjut internal.' using errcode='42501';
  end if;

  if public.has_app_permission('attendance.read') then
    select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'title',x.title)),'[]'::jsonb)
      into v_today_events
      from (
        select e.id,e.title
        from public.attendance_events e
        left join public.classes c on c.id=e.class_id
        where e.event_date=v_today and e.state<>'CANCELLED'
          and (v_role='ADMIN'::public.app_role or public.can_read_scoped_audience(e.audience,e.class_id))
          and (p_level is null or e.level_id=p_level or c.level_id=p_level or exists (
            select 1 from public.attendance_records r
            left join public.member_memberships mm on mm.member_id=coalesce(r.member_id,r.participant_key)
              and mm.level_id=p_level and mm.valid_from<=e.event_date
              and (mm.valid_to is null or mm.valid_to>=e.event_date)
              and (mm.ended_on is null or mm.ended_on>e.event_date)
            where r.event_id=e.id and (r.level_id_snapshot=p_level or mm.id is not null)))
        order by e.event_time nulls last,e.title limit 8
      ) x;

    select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'title',x.title)),'[]'::jsonb)
      into v_attendance
      from (
        select e.id,e.title
        from public.attendance_events e
        left join public.classes c on c.id=e.class_id
        where e.event_date<=v_today and e.event_date>=v_today-interval '6 months'
          and e.state<>'CANCELLED'
          and (v_role='ADMIN'::public.app_role or public.can_read_scoped_audience(e.audience,e.class_id))
          and exists (
            select 1 from public.attendance_records r
            left join public.member_memberships mm on mm.member_id=coalesce(r.member_id,r.participant_key)
              and mm.level_id=p_level and mm.valid_from<=e.event_date
              and (mm.valid_to is null or mm.valid_to>=e.event_date)
              and (mm.ended_on is null or mm.ended_on>e.event_date)
            where r.event_id=e.id and r.status is null
              and (p_level is null or r.level_id_snapshot=p_level or e.level_id=p_level
                or c.level_id=p_level or mm.id is not null))
        order by e.event_date desc,e.id limit 8
      ) x;
  end if;

  if public.has_app_permission('journal.read') then
    select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'title',x.title)),'[]'::jsonb)
      into v_journals from (
        select j.id,j.title from public.journals j
        left join public.classes c on c.id=j.class_id
        where j.state='DRAFT'
          and (v_role='ADMIN'::public.app_role or public.can_read_journal_id(j.id))
          and (p_level is null or c.level_id=p_level or exists (
            select 1 from public.attendance_events e
            where e.id=j.event_id and (e.level_id=p_level or exists (
              select 1 from public.classes ec where ec.id=e.class_id and ec.level_id=p_level))))
        order by j.journal_date desc,j.id limit 8
      ) x;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',x.id,'title',x.decision,'journal_id',x.journal_id,'deadline',x.deadline)),'[]'::jsonb)
      into v_decisions from (
        select d.id,d.decision,d.journal_id,d.deadline
        from public.meeting_decisions d
        join public.journals j on j.id=d.journal_id
        left join public.classes c on c.id=j.class_id
        where d.deadline<v_today and d.status not in ('COMPLETED','CANCELLED')
          and (v_role='ADMIN'::public.app_role or public.can_read_journal_id(j.id))
          and (p_level is null or c.level_id=p_level or exists (
            select 1 from public.attendance_events e
            where e.id=j.event_id and e.level_id=p_level))
        order by d.deadline,d.id limit 8
      ) x;
  end if;

  return jsonb_build_object('todayEvents',v_today_events,'unfinishedAttendance',v_attendance,
    'draftJournals',v_journals,'overdueDecisions',v_decisions);
end $fn$;

revoke all on function public.dashboard_task_snapshot_v1(uuid) from public;
grant execute on function public.dashboard_task_snapshot_v1(uuid) to anon, authenticated, service_role;
