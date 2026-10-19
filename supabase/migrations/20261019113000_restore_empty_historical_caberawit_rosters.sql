-- Simpul: restore ONLY empty Caberawit routine sessions for 1 October 2026 onward.
-- Never replace attendance statuses, names, revisions or historical class snapshots.
-- The first cohort was registered on 6-7 October; transfer records remain effective
-- only from their own valid_from, so newer transfers are not backdated.
create or replace function public.simpul_restore_empty_caberawit_roster(p_event_id uuid)
returns integer
language plpgsql security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_event public.attendance_events%rowtype;
  v_added integer := 0;
begin
  select * into v_event from public.attendance_events where id = p_event_id for update;
  if not found then raise exception 'Pertemuan tidak ditemukan'; end if;

  if not coalesce(public.has_app_permission('attendance.write'),false)
     or not coalesce(public.can_write_scoped_audience(v_event.audience,v_event.class_id),false)
  then raise exception 'Akses pengisian presensi ditolak'; end if;

  if v_event.audience <> 'CABERAWIT'::public.audience_type
     or v_event.class_id is null or v_event.agenda_id is not null
     or v_event.state <> 'ONGOING' or v_event.event_date < date '2026-10-01'
     or exists (select 1 from public.attendance_records r where r.event_id = p_event_id)
  then return 0; end if;

  with eligible as (
    select distinct on (m.id)
      m.id as member_id, m.name, mm.class_id, mm.level_id,
      c.name as class_name, l.name as level_name
    from public.members m
    join public.member_memberships mm on mm.member_id=m.id
    join public.categories cat on cat.id=mm.category_id and cat.slug='caberawit'
    left join public.classes c on c.id=mm.class_id
    left join public.levels l on l.id=mm.level_id
    where (m.status='ACTIVE' or v_event.event_date < (m.updated_at at time zone 'Asia/Jakarta')::date)
      and mm.class_id=v_event.class_id
      and (v_event.level_id is null or mm.level_id=v_event.level_id)
      and (mm.active or mm.ended_on is not null or mm.valid_to is not null)
      and (mm.valid_to is null or mm.valid_to>=v_event.event_date)
      and (mm.ended_on is null or mm.ended_on>v_event.event_date)
      and (
        mm.valid_from<=v_event.event_date
        or (
          v_event.event_date between date '2026-10-01' and date '2026-10-05'
          and mm.valid_from between date '2026-10-06' and date '2026-10-07'
          and not exists (
            select 1 from public.member_memberships earlier
            where earlier.member_id=m.id and earlier.category_id=mm.category_id
              and (earlier.valid_from,earlier.created_at) < (mm.valid_from,mm.created_at)
          )
        )
      )
    order by m.id,mm.valid_from desc,mm.created_at desc
  )
  insert into public.attendance_records(
    event_id,member_id,participant_key,status,member_name_snapshot,
    class_id_snapshot,level_id_snapshot,class_name_snapshot,level_name_snapshot
  )
  select p_event_id,member_id,member_id,null,name,
         class_id,level_id,class_name,level_name
  from eligible
  on conflict (event_id,member_id) do nothing;

  get diagnostics v_added = row_count;
  return v_added;
end
$function$;

revoke all on function public.simpul_restore_empty_caberawit_roster(uuid) from public;
grant execute on function public.simpul_restore_empty_caberawit_roster(uuid) to anon, authenticated;
