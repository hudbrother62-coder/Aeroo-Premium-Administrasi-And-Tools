-- Public viewer sees aggregates only. Individual data remains behind the app session.
create table if not exists public.viewer_visits (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  device text not null default 'Unknown',
  visited_at timestamptz not null default now()
);
alter table public.viewer_visits enable row level security;
revoke all on public.viewer_visits from anon, authenticated;

create or replace function public.viewer_overview()
returns jsonb language sql stable security definer
set search_path = '' set row_security = 'off' as $$
  select jsonb_build_object(
    'members', (select count(*) from public.members where status = 'ACTIVE'),
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'count',
      (select count(*) from public.member_categories mc join public.members m on m.id = mc.member_id
       where mc.category_id = c.id and m.status = 'ACTIVE')) order by c.name), '[]'::jsonb) from public.categories c),
    'attendance', (select jsonb_build_object('meetings', count(distinct e.id), 'present', count(r.id) filter (where r.status = 'H'),
      'excused', count(r.id) filter (where r.status = 'I'), 'absent', count(r.id) filter (where r.status = 'A'))
      from public.attendance_events e left join public.attendance_records r on r.event_id = e.id
      where e.event_date >= date_trunc('month', now())::date and e.event_date < (date_trunc('month', now()) + interval '1 month')::date),
    'journals', (select count(*) from public.journals where journal_date >= date_trunc('month', now())::date
      and journal_date < (date_trunc('month', now()) + interval '1 month')::date)
  );
$$;
revoke all on function public.viewer_overview() from public;
grant execute on function public.viewer_overview() to anon, authenticated;

create or replace function public.record_viewer_visit(p_name text, p_device text)
returns void language plpgsql security definer
set search_path = '' set row_security = 'off' as $$
begin
  insert into public.viewer_visits(display_name, device)
  values (nullif(left(trim(p_name), 80), ''), left(coalesce(nullif(trim(p_device), ''), 'Unknown'), 220));
end;
$$;
revoke all on function public.record_viewer_visit(text,text) from public;
grant execute on function public.record_viewer_visit(text,text) to anon, authenticated;

alter table public.agenda add column if not exists presenter text;
alter table public.members add column if not exists section text;
alter table public.attendance_records add column if not exists member_name_snapshot text;
alter table public.journal_progress add column if not exists member_name_snapshot text;
update public.attendance_records r set member_name_snapshot = m.name from public.members m where r.member_id = m.id and r.member_name_snapshot is null;
update public.journal_progress p set member_name_snapshot = m.name from public.members m where p.member_id = m.id and p.member_name_snapshot is null;
alter table public.journal_progress alter column member_id drop not null;
alter table public.attendance_records drop constraint if exists attendance_records_member_id_fkey;
alter table public.attendance_records add constraint attendance_records_member_id_fkey foreign key (member_id) references public.members(id) on delete set null;
alter table public.journal_progress drop constraint if exists journal_progress_member_id_fkey;
alter table public.journal_progress add constraint journal_progress_member_id_fkey foreign key (member_id) references public.members(id) on delete set null;

create or replace function public.permanently_delete_member(p_member_id uuid)
returns void language plpgsql security definer
set search_path = '' set row_security = 'off' as $$
declare v_member public.members%rowtype;
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then
    raise exception 'Hanya owner yang dapat menghapus permanen';
  end if;
  select * into v_member from public.members where id = p_member_id for update;
  if not found then raise exception 'Anggota tidak ditemukan'; end if;
  if v_member.status <> 'INACTIVE' then raise exception 'Arsipkan anggota terlebih dahulu'; end if;
  update public.attendance_records set member_name_snapshot = v_member.name where member_id = p_member_id;
  update public.journal_progress set member_name_snapshot = v_member.name where member_id = p_member_id;
  delete from public.members where id = p_member_id;
end;
$$;
revoke all on function public.permanently_delete_member(uuid) from public;
grant execute on function public.permanently_delete_member(uuid) to authenticated, anon;
