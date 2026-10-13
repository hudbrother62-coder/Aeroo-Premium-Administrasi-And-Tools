-- Simpul: regular programs have a date/activity session; agenda is reserved for exceptional events.
-- Existing routine agendas and historical attendance are kept, not deleted.
update public.simpul_agenda_routines set active=false where active;

do $patch$
declare f text; oldkey text; newkey text;
begin
  f:=pg_get_functiondef('public.ensure_attendance(jsonb)'::regprocedure);
  oldkey:='v_key:=''routine:CABERAWIT:''||v_date::text||'':''||v_class::text;';
  newkey:='v_key:=''routine:CABERAWIT:''||v_date::text||'':''||v_class::text||'':''||coalesce(v_activity::text,'''');';
  if position(oldkey in f)=0 then raise exception 'Routine Caberawit key fragment not found';end if;
  f:=replace(f,oldkey,newkey);
  oldkey:='v_key:=a||'':''||v_date||'':''||coalesce(v_class::text,'''')||'':''||coalesce(v_level::text,'''')||'':''||coalesce(v_activity::text,'''')||'':''||coalesce(p_event->>''event_time'','''')||'':''||lower(trim(p_event->>''title''))||'':''||coalesce(lower(v_teacher),'''')||'':''||array_to_string(v_people,'','');';
  newkey:='v_key:=''routine:''||a::text||'':''||v_date::text||'':''||coalesce(v_class::text,'''')||'':''||coalesce(v_activity::text,'''');';
  if position(oldkey in f)=0 then raise exception 'Routine activity key fragment not found';end if;
  f:=replace(f,oldkey,newkey);
  oldkey:='select * into e from public.attendance_events where session_key=v_key;';
  newkey:='select * into e from public.attendance_events where session_key=v_key;
  -- Reopen old Caberawit sessions when their activity matches; never duplicate history.
  if not found and g.id is null and a=''CABERAWIT'' then
    select * into e from public.attendance_events
    where session_key=''routine:CABERAWIT:''||v_date::text||'':''||v_class::text
      and activity_type_id is not distinct from v_activity
    limit 1;
  end if;';
  if position(oldkey in f)=0 then raise exception 'Attendance lookup fragment not found';end if;
  f:=replace(f,oldkey,newkey);
  execute f;
end
$patch$;

create index if not exists idx_simpul_attendance_activity_day
  on public.attendance_events(event_date,audience,activity_type_id,class_id)
  where agenda_id is null;

-- When a journal is written after attendance, connect to the one unambiguous session.
create or replace function public.simpul_attach_event_to_new_journal()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
  if new.event_id is not null or new.state='ARCHIVED' then return new;end if;
  select case when count(*)=1 then min(e.id) else null end into v_id
  from public.attendance_events e
  where e.event_date=new.journal_date
    and e.audience=public.journal_audience(new.journal_kind)
    and e.state<>'CANCELLED'
    and e.class_id is not distinct from new.class_id
    and (
      (new.agenda_id is not null and e.agenda_id=new.agenda_id)
      or (new.agenda_id is null and e.agenda_id is null
          and e.activity_type_id is not distinct from new.activity_type_id)
    );
  new.event_id:=v_id;
  return new;
end $$;
revoke all on function public.simpul_attach_event_to_new_journal() from public,anon,authenticated;
drop trigger if exists trg_simpul_journal_auto_session on public.journals;
create trigger trg_simpul_journal_auto_session
before insert on public.journals for each row
execute function public.simpul_attach_event_to_new_journal();

-- When attendance is opened after a journal, connect previously saved journal(s).
create or replace function public.simpul_attach_journals_to_new_event()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.state='CANCELLED' then return new;end if;
  update public.journals j
  set event_id=new.id,revision=j.revision+1,updated_at=now()
  where j.event_id is null and j.state<>'ARCHIVED'
    and j.journal_date=new.event_date
    and public.journal_audience(j.journal_kind)=new.audience
    and j.class_id is not distinct from new.class_id
    and (
      (new.agenda_id is not null and j.agenda_id=new.agenda_id)
      or (new.agenda_id is null and j.agenda_id is null
          and j.activity_type_id is not distinct from new.activity_type_id)
    )
    and not exists(
      select 1 from public.attendance_events competing
      where competing.id<>new.id and competing.event_date=new.event_date
        and competing.audience=new.audience and competing.state<>'CANCELLED'
        and competing.class_id is not distinct from new.class_id
        and (
          (new.agenda_id is not null and competing.agenda_id=new.agenda_id)
          or (new.agenda_id is null and competing.agenda_id is null
              and competing.activity_type_id is not distinct from new.activity_type_id)
        )
    );
  return new;
end $$;
revoke all on function public.simpul_attach_journals_to_new_event() from public,anon,authenticated;
drop trigger if exists trg_simpul_attendance_auto_journals on public.attendance_events;
create trigger trg_simpul_attendance_auto_journals
after insert on public.attendance_events for each row
execute function public.simpul_attach_journals_to_new_event();

-- Backfill only unambiguous orphan journals without changing completed attendance.
with pairs as (
  select j.id as journal_id,min(e.id) as event_id
  from public.journals j join public.attendance_events e
    on e.event_date=j.journal_date
   and e.audience=public.journal_audience(j.journal_kind)
   and e.state<>'CANCELLED'
   and e.class_id is not distinct from j.class_id
   and ((j.agenda_id is not null and e.agenda_id=j.agenda_id)
     or (j.agenda_id is null and e.agenda_id is null
          and e.activity_type_id is not distinct from j.activity_type_id))
  where j.event_id is null and j.state<>'ARCHIVED'
  group by j.id having count(*)=1
)
update public.journals j set event_id=p.event_id,revision=j.revision+1,updated_at=now()
from pairs p where j.id=p.journal_id;
