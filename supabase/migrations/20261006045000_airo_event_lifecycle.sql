alter table public.agenda drop constraint agenda_status_check;
alter table public.agenda add constraint agenda_status_check check(status in ('DRAFT','SCHEDULED','ACTIVE','ONGOING','COMPLETED','LOCKED','CANCELLED'));
alter table public.attendance_events drop constraint attendance_events_state_check;
alter table public.attendance_events add constraint attendance_events_state_check check(state in ('DRAFT','SCHEDULED','ACTIVE','ONGOING','COMPLETED','LOCKED','CANCELLED'));
create or replace function public.guard_locked_agenda() returns trigger language plpgsql set search_path='' as $$ begin
 if old.status='LOCKED' and (new.status='LOCKED' or public.current_app_role() is distinct from 'ADMIN') then raise exception 'Agenda terkunci. Admin harus membuka kunci terlebih dahulu.';end if;
 return new;
end $$;
create trigger guard_locked_agenda before update on public.agenda for each row when(old.status='LOCKED') execute function public.guard_locked_agenda();
create or replace function public.guard_event_data() returns trigger language plpgsql security definer set search_path='' as $$
declare event uuid;agenda uuid;locked boolean;begin
 if tg_table_name='attendance_records' then event:=new.event_id;
 else event:=new.event_id;agenda:=new.agenda_id;end if;
 select exists(select 1 from public.attendance_events e left join public.agenda a on a.id=e.agenda_id where e.id=event and (e.state in ('LOCKED','DRAFT') or a.status in ('LOCKED','DRAFT'))) or exists(select 1 from public.agenda a where a.id=agenda and a.status in ('LOCKED','DRAFT')) into locked;
 if locked then raise exception 'Kegiatan belum aktif atau terkunci.';end if;
 return new;
end $$;
revoke all on function public.guard_event_data() from public,anon,authenticated;
create trigger guard_attendance_event_data before insert or update on public.attendance_records for each row execute function public.guard_event_data();
create trigger guard_journal_event_data before insert or update on public.journals for each row execute function public.guard_event_data();
