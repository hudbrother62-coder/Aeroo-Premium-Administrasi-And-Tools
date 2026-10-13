-- Simpul: synchronize editable Caberawit rosters after a class transfer.
-- Existing attendance values, notes and audit trails remain as historical records.
create or replace function public.sync_caberawit_attendance_roster(p_event_id uuid)
returns uuid[]
language plpgsql security definer set search_path='' set row_security=off
as $function$
declare
  v_event public.attendance_events%rowtype;
  v_roster uuid[];
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  select * into v_event from public.attendance_events where id=p_event_id for update;
  if not found then raise exception 'Pertemuan tidak ditemukan'; end if;
  if v_event.audience <> 'CABERAWIT'::public.audience_type
     or v_event.class_id is null
     or v_event.agenda_id is not null
     or v_event.event_date < v_today then
    return null;
  end if;
  if not coalesce(public.can_write_scoped_audience(v_event.audience,v_event.class_id),false) then
    raise exception 'Akses daftar presensi ditolak';
  end if;
  select coalesce(array_agg(distinct m.id),'{}'::uuid[])
  into v_roster
  from public.members m
  join public.member_memberships mm on mm.member_id=m.id
  join public.categories cat on cat.id=mm.category_id and cat.slug='caberawit'
  where m.status='ACTIVE' and mm.active and mm.class_id=v_event.class_id
    and mm.valid_from<=v_event.event_date
    and (mm.valid_to is null or mm.valid_to>=v_event.event_date)
    and (mm.ended_on is null or mm.ended_on>v_event.event_date)
    and (v_event.level_id is null or mm.level_id=v_event.level_id);

  insert into public.attendance_records(
    event_id,member_id,participant_key,status,member_name_snapshot,
    class_id_snapshot,level_id_snapshot,class_name_snapshot,level_name_snapshot
  )
  select distinct on (m.id)
    v_event.id,m.id,m.id,null,m.name,mm.class_id,mm.level_id,c.name,l.name
  from public.members m
  join public.member_memberships mm on mm.member_id=m.id
  join public.categories cat on cat.id=mm.category_id and cat.slug='caberawit'
  left join public.classes c on c.id=mm.class_id
  left join public.levels l on l.id=mm.level_id
  where m.id=any(v_roster) and mm.active and mm.class_id=v_event.class_id
    and mm.valid_from<=v_event.event_date
    and (mm.valid_to is null or mm.valid_to>=v_event.event_date)
    and (mm.ended_on is null or mm.ended_on>v_event.event_date)
    and (v_event.level_id is null or mm.level_id=v_event.level_id)
  order by m.id,mm.valid_from desc,mm.created_at desc
  on conflict (event_id,member_id) do nothing;
  return v_roster;
end
$function$;
revoke all on function public.sync_caberawit_attendance_roster(uuid) from public;
grant execute on function public.sync_caberawit_attendance_roster(uuid) to anon,authenticated;
