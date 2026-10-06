
create or replace function public.save_agenda(p_id uuid, p_revision integer, p_items jsonb, p_scope text default 'this')
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security='off'
as $$
declare
  old_g public.agenda%rowtype;
  g public.agenda%rowtype;
  x jsonb;
  v_series uuid;
  v_result jsonb:='[]';
  v_ids uuid[];
  v_date date;
begin
  if not public.has_app_permission('agenda.write') then raise exception 'Akses agenda ditolak'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>366 then raise exception 'Daftar agenda tidak valid';end if;
  if p_revision is null or p_revision<0 then raise exception 'Versi agenda wajib valid';end if;
  if p_id is not null and jsonb_array_length(p_items)<>1 then raise exception 'Perubahan satu agenda wajib satu objek';end if;
  if p_scope not in ('this','future','all') then raise exception 'Lingkup perubahan tidak valid';end if;

  if p_id is not null then
    select * into old_g from public.agenda where id=p_id for update;
    if not found or not coalesce(public.can_write_audience(old_g.audience),false) then raise exception 'Agenda di luar akses';end if;
    if old_g.revision is distinct from p_revision then raise exception 'CONFLICT: Agenda sudah diubah petugas lain';end if;
  end if;

  v_series:=coalesce(old_g.series_id,gen_random_uuid());

  for x in select value from jsonb_array_elements(p_items) loop
    g:=jsonb_populate_record(null::public.agenda,case when p_id is null then x else to_jsonb(old_g)||x end);
    if not coalesce(public.can_write_audience(g.audience),false) then raise exception 'Agenda di luar akses';end if;
    if length(trim(coalesce(g.title,'')))=0 or g.starts_at is null or (g.ends_at is not null and g.ends_at<=g.starts_at) then raise exception 'Judul atau waktu agenda tidak valid';end if;

    g.status:=coalesce(g.status,'SCHEDULED');
    g.attendance_enabled:=coalesce(g.attendance_enabled,true);
    g.participant_ids:=coalesce(g.participant_ids,'{}');
    g.recurrence:=coalesce(g.recurrence,'once');
    g.created_at:=coalesce(old_g.created_at,now());
    g.series_id:=v_series;
    v_date:=(g.starts_at at time zone 'Asia/Jakarta')::date;

    if g.level_id is not null and (g.audience not in ('CABERAWIT','MUDA_MUDI') or not exists(select 1 from public.levels where id=g.level_id and active)) then raise exception 'Jenjang tidak sesuai program';end if;
    if g.activity_type_id is not null and not exists(select 1 from public.activity_types where id=g.activity_type_id and audience=g.audience and active) then raise exception 'Jenis kegiatan tidak sesuai lingkup';end if;
    if g.class_id is not null and not exists(select 1 from public.classes where id=g.class_id and audience=g.audience and (g.level_id is null or level_id=g.level_id)) then raise exception 'Kelas tidak sesuai program atau jenjang';end if;

    if cardinality(g.participant_ids)>0 and exists(
      select 1 from unnest(g.participant_ids) person
      where not exists(
        select 1
        from public.members m
        where m.id=person and m.status='ACTIVE'
          and (
            g.audience='KELOMPOK'
            or (
              g.audience='PENGURUS'
              and exists(
                select 1 from public.organizational_positions op
                where op.member_id=m.id and op.active
                  and op.valid_from<=v_date
                  and (op.valid_to is null or op.valid_to>=v_date)
              )
            )
            or (
              g.audience in ('CABERAWIT','MUDA_MUDI','IBU_IBU')
              and exists(
                select 1 from public.member_memberships mm
                join public.categories c on c.id=mm.category_id
                where mm.member_id=m.id
                  and c.slug=case g.audience when 'CABERAWIT' then 'caberawit' when 'MUDA_MUDI' then 'muda-mudi' when 'IBU_IBU' then 'ibu-ibu' end
                  and mm.valid_from<=v_date
                  and (mm.valid_to is null or mm.valid_to>=v_date)
                  and (mm.ended_on is null or mm.ended_on>v_date)
                  and (g.class_id is null or mm.class_id=g.class_id)
                  and (g.level_id is null or mm.level_id=g.level_id)
              )
            )
          )
      )
    ) then raise exception 'Sebagian peserta tidak sesuai lingkup, penempatan, jabatan, atau tanggal';end if;

    if p_id is null then
      g.id:=gen_random_uuid();g.revision:=0;
      insert into public.agenda select g.*;
      v_result:=v_result||jsonb_build_array(to_jsonb(g));
    else
      if exists(select 1 from public.attendance_events where agenda_id=old_g.id)
        and (g.starts_at is distinct from old_g.starts_at or g.ends_at is distinct from old_g.ends_at or g.audience<>old_g.audience or g.class_id is distinct from old_g.class_id or g.level_id is distinct from old_g.level_id or g.participant_ids is distinct from old_g.participant_ids)
      then raise exception 'Pertemuan sudah memiliki presensi; buat pertemuan baru untuk mengubah waktu atau daftar peserta';end if;

      select array_agg(id) into v_ids
      from public.agenda
      where id=p_id
         or (
           old_g.series_id is not null and series_id=old_g.series_id and (
             (p_scope='future' and starts_at>=old_g.starts_at)
             or p_scope='all'
           )
         );

      if exists(select 1 from public.agenda where id=any(v_ids) and not coalesce(public.can_write_audience(audience),false)) then raise exception 'Sebagian rangkaian di luar akses';end if;

      if p_scope in ('future','all') and exists(
        select 1
        from public.agenda a
        join public.attendance_events e on e.agenda_id=a.id
        where a.id=any(v_ids) and a.id<>p_id
          and (
            g.audience<>a.audience
            or g.class_id is distinct from a.class_id
            or g.level_id is distinct from a.level_id
            or g.participant_ids is distinct from a.participant_ids
            or g.starts_at is distinct from old_g.starts_at
            or g.ends_at is distinct from old_g.ends_at
          )
      ) then raise exception 'Rangkaian memiliki presensi; waktu atau daftar peserta tidak dapat diubah massal';end if;

      update public.agenda a set
        title=g.title,location=g.location,presenter=g.presenter,notes=g.notes,
        person_in_charge=g.person_in_charge,status=g.status,attendance_enabled=g.attendance_enabled,
        activity_type_id=g.activity_type_id,audience=g.audience,class_id=g.class_id,level_id=g.level_id,
        participant_ids=g.participant_ids,
        starts_at=case when a.id=p_id then g.starts_at else a.starts_at+(g.starts_at-old_g.starts_at) end,
        ends_at=case when a.id=p_id then g.ends_at else case when g.ends_at is null then null else a.starts_at+(g.starts_at-old_g.starts_at)+(g.ends_at-g.starts_at) end end,
        revision=a.revision+1
      where a.id=any(v_ids);

      update public.attendance_events set state=g.status,title=g.title where agenda_id=any(v_ids);
      v_result:=v_result||(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.agenda a where id=any(v_ids));
    end if;
  end loop;
  return v_result;
end
$$;

