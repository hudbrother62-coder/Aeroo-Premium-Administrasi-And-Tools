-- Simpul dashboard: a session-scoped, date-bounded read model.
-- No historical source rows are rewritten. SECURITY DEFINER bypasses per-record
-- RLS recursion, while explicit permission guards reproduce read policies.
create index if not exists idx_simpul_dashboard_event_period
  on public.attendance_events (event_date, state);
create index if not exists idx_simpul_dashboard_journal_period
  on public.journals (journal_date, state);
create index if not exists idx_simpul_dashboard_progress_latest
  on public.journal_progress (target_id, created_at desc);

create or replace function public.dashboard_scope_snapshot_v1(p_month text, p_span integer default 1)
returns jsonb
language plpgsql stable security definer
set search_path to ''
set row_security to 'off'
as $fn$
declare
  v_role public.app_role;
  v_from date;
  v_next date;
  v_people jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
  v_journals jsonb := '[]'::jsonb;
  v_targets jsonb := '[]'::jsonb;
  v_progress jsonb := '[]'::jsonb;
  v_levels jsonb := '[]'::jsonb;
  v_classes jsonb := '[]'::jsonb;
begin
  v_role := public.current_app_role();
  if v_role is null or v_role = 'VIEWER'::public.app_role then
    raise exception 'Login diperlukan untuk ringkasan internal.' using errcode = '42501';
  end if;
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    or p_span not in (1,3,6) then
    raise exception 'Periode dashboard tidak valid.' using errcode = '22023';
  end if;
  v_next := (to_date(p_month || '-01','YYYY-MM-DD') + interval '1 month')::date;
  v_from := (v_next - make_interval(months => p_span))::date;

  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'active',l.active)
    order by l.sort_order,l.name),'[]'::jsonb)
    into v_levels from public.levels l where l.active;

  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'level_id',c.level_id)),'[]'::jsonb)
    into v_classes
    from public.classes c
    where c.active and (c.audience <> 'PENGURUS'::public.audience_type or public.can_read_audience('PENGURUS'::public.audience_type));

  if public.has_app_permission('person.read') then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',m.id,'level_id',m.level_id,'class_id',m.class_id,
      'member_memberships',coalesce((
        select jsonb_agg(jsonb_build_object(
          'level_id',mm.level_id,'class_id',mm.class_id,'valid_from',mm.valid_from,
          'valid_to',mm.valid_to,'ended_on',mm.ended_on,'active',mm.active,
          'categories',jsonb_build_object('slug',cat.slug),
          'classes',jsonb_build_object('name',cl.name)
        ) order by mm.valid_from desc,mm.id)
        from public.member_memberships mm
        join public.categories cat on cat.id=mm.category_id
        left join public.classes cl on cl.id=mm.class_id
        where mm.member_id=m.id
          and (v_role='ADMIN'::public.app_role
            or (public.can_read_member(m.id) and
              case cat.slug
                when 'caberawit' then public.can_read_caberawit_class(mm.class_id)
                when 'muda-mudi' then public.can_read_audience('MUDA_MUDI'::public.audience_type)
                when 'ibu-ibu' then public.can_read_audience('IBU_IBU'::public.audience_type)
                when 'pengurus' then public.can_read_audience('PENGURUS'::public.audience_type)
                else public.can_read_audience('KELOMPOK'::public.audience_type)
              end))
      ),'[]'::jsonb))),'[]'::jsonb)
      into v_people
      from public.members m
      where m.status='ACTIVE' and (v_role='ADMIN'::public.app_role or public.can_read_member(m.id));
  end if;

  if public.has_app_permission('attendance.read') then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'event_date',e.event_date,'state',e.state,
      'class_id',e.class_id,'level_id',e.level_id,'audience',e.audience,
      'attendance_records',coalesce((
        select jsonb_agg(jsonb_build_object(
          'member_id',r.member_id,'participant_key',r.participant_key,
          'status',r.status,'class_id_snapshot',r.class_id_snapshot,
          'level_id_snapshot',r.level_id_snapshot
        )) from public.attendance_records r where r.event_id=e.id
      ),'[]'::jsonb)
    ) order by e.event_date),'[]'::jsonb) into v_events
    from public.attendance_events e
    where e.event_date>=v_from and e.event_date<v_next
      and e.state<>'CANCELLED'
      and (v_role='ADMIN'::public.app_role or public.can_read_scoped_audience(e.audience,e.class_id));
  end if;

  if public.has_app_permission('journal.read') then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',j.id,'event_id',j.event_id,'journal_date',j.journal_date,
      'class_id',j.class_id,'member_id',j.member_id,'state',j.state
    )),'[]'::jsonb) into v_journals
    from public.journals j
    where j.state='COMPLETED' and j.journal_date>=v_from and j.journal_date<v_next
      and (j.event_id is null or exists (
        select 1 from public.attendance_events e where e.id=j.event_id and e.state<>'CANCELLED'))
      and (v_role='ADMIN'::public.app_role or public.can_read_journal_id(j.id));
  end if;

  if public.has_app_permission('target.read') then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',t.id,'level_id',t.level_id,'class_id',t.class_id,
      'target_month',t.target_month,'active',t.active)),'[]'::jsonb)
      into v_targets
    from public.learning_targets t
    where t.active and (t.target_month is null or t.target_month<v_next)
      and (v_role='ADMIN'::public.app_role or t.class_id is null or public.can_read_class(t.class_id));

    select coalesce(jsonb_agg(jsonb_build_object(
      'member_id',coalesce(p.member_id,p.participant_key),
      'participant_key',p.participant_key,'target_id',p.target_id,
      'progress_value',p.progress_value,'created_at',p.created_at
    )),'[]'::jsonb) into v_progress
    from public.journal_progress p
    join public.learning_targets t on t.id=p.target_id
    join public.journals j on j.id=p.journal_id
    where t.active and (t.target_month is null or t.target_month<v_next)
      and j.state='COMPLETED' and j.journal_date<v_next
      and j.journal_kind in ('CABERAWIT_INDIVIDUAL','MUDA_MUDI_INDIVIDUAL')
      and (v_role='ADMIN'::public.app_role or
        (public.can_read_journal_id(j.id) and (t.class_id is null or public.can_read_class(t.class_id))))
      and (j.event_id is null or exists (
        select 1 from public.attendance_events e
        join public.attendance_records r on r.event_id=e.id
        where e.id=j.event_id and e.state<>'CANCELLED'
        and r.participant_key=p.participant_key and r.status='H'
      ));
  end if;

  return jsonb_build_object('role',v_role,'people',v_people,'events',v_events,
    'journals',v_journals,'targets',v_targets,'progress',v_progress,
    'levels',v_levels,'classes',v_classes);
end $fn$;

revoke all on function public.dashboard_scope_snapshot_v1(text,integer) from public;
grant execute on function public.dashboard_scope_snapshot_v1(text,integer) to anon, authenticated, service_role;
comment on function public.dashboard_scope_snapshot_v1(text,integer) is 'Date-bounded authorization-checked Simpul dashboard source. Never exposes PII.';
