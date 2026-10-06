
create or replace function public.ensure_attendance(p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
set row_security to 'off'
as $function$
declare
  e public.attendance_events%rowtype;
  g public.agenda%rowtype;
  a public.audience_type;
  v_key text;
  v_slug text;
  v_date date;
  v_class uuid;
  v_level uuid;
  v_activity uuid;
  v_people uuid[] := '{}';
begin
  if nullif(p_event->>'agenda_id','') is not null then
    select * into g from public.agenda where id=(p_event->>'agenda_id')::uuid;
    if not found or g.status='CANCELLED' or not g.attendance_enabled then raise exception 'Agenda tidak dapat diabsen'; end if;
    v_class:=g.class_id; v_level:=g.level_id; v_activity:=g.activity_type_id; v_people:=g.participant_ids;
    a:=g.audience; v_date:=(g.starts_at at time zone 'Asia/Jakarta')::date; v_key:='agenda:'||g.id;
  else
    v_class:=nullif(p_event->>'class_id','')::uuid;
    v_level:=nullif(p_event->>'level_id','')::uuid;
    v_activity:=nullif(p_event->>'activity_type_id','')::uuid;
    if p_event->'member_ids' is not null and jsonb_typeof(p_event->'member_ids')<>'array' then raise exception 'Daftar peserta tidak valid'; end if;
    select coalesce(array_agg(distinct value::uuid order by value::uuid),'{}') into v_people
    from jsonb_array_elements_text(coalesce(p_event->'member_ids','[]'));
    a:=(p_event->>'audience')::public.audience_type;
    v_date:=(p_event->>'event_date')::date;
    v_key:=a||':'||v_date||':'||coalesce(p_event->>'class_id','')||':'||coalesce(p_event->>'level_id','')||':'||coalesce(p_event->>'event_time','')||':'||lower(trim(p_event->>'title'))||':'||array_to_string(v_people,',');
  end if;

  if not coalesce(public.can_write_audience(a),false) then raise exception 'Kegiatan di luar akses'; end if;
  if a is null or v_date is null then raise exception 'Lingkup dan tanggal wajib diisi'; end if;
  if v_class is not null and not exists(select 1 from public.classes where id=v_class and audience=a and active and (v_level is null or level_id=v_level)) then raise exception 'Kelas tidak sesuai program atau jenjang'; end if;
  if v_level is not null and (a not in ('CABERAWIT','MUDA_MUDI') or not exists(select 1 from public.levels where id=v_level and active)) then raise exception 'Jenjang tidak sesuai program'; end if;
  if v_activity is not null and not exists(select 1 from public.activity_types where id=v_activity and audience=a and active) then raise exception 'Jenis kegiatan tidak sesuai lingkup'; end if;
  if v_class is not null and v_level is null then select level_id into v_level from public.classes where id=v_class; end if;
  if g.id is null and length(trim(coalesce(p_event->>'title','')))=0 then raise exception 'Judul kegiatan wajib diisi'; end if;
  if g.id is null then v_key:=a||':'||v_date||':'||coalesce(v_class::text,'')||':'||coalesce(v_level::text,'')||':'||coalesce(v_activity::text,'')||':'||coalesce(p_event->>'event_time','')||':'||lower(trim(p_event->>'title'))||':'||array_to_string(v_people,','); end if;

  perform pg_advisory_xact_lock(hashtextextended(v_key,0));
  select * into e from public.attendance_events where session_key=v_key;

  if not found then
    insert into public.attendance_events(title,event_date,event_time,audience,activity_type_id,class_id,level_id,agenda_id,session_key,notes)
    values(coalesce(g.title,p_event->>'title'),v_date,coalesce((g.starts_at at time zone 'Asia/Jakarta')::time,nullif(p_event->>'event_time','')::time),a,v_activity,v_class,v_level,g.id,v_key,p_event->>'notes')
    returning * into e;

    if a='KELOMPOK' then
      insert into public.attendance_records(event_id,member_id,participant_key,status,member_name_snapshot,class_id_snapshot,level_id_snapshot,class_name_snapshot,level_name_snapshot)
      select e.id,m.id,m.id,null,m.name,null,null,null,null
      from public.members m
      where m.status='ACTIVE'
        and (cardinality(v_people)=0 or m.id=any(v_people))
      order by m.name;

    elsif a='PENGURUS' then
      insert into public.attendance_records(event_id,member_id,participant_key,status,member_name_snapshot,class_id_snapshot,level_id_snapshot,class_name_snapshot,level_name_snapshot)
      select distinct on(m.id) e.id,m.id,m.id,null,m.name,null,null,null,null
      from public.members m
      join public.organizational_positions op on op.member_id=m.id
      where m.status='ACTIVE'
        and op.active
        and op.valid_from<=v_date
        and (op.valid_to is null or op.valid_to>=v_date)
        and (cardinality(v_people)=0 or m.id=any(v_people))
      order by m.id,op.valid_from desc;

    else
      v_slug:=case a when 'CABERAWIT' then 'caberawit' when 'MUDA_MUDI' then 'muda-mudi' when 'IBU_IBU' then 'ibu-ibu' else null end;
      insert into public.attendance_records(event_id,member_id,participant_key,status,member_name_snapshot,class_id_snapshot,level_id_snapshot,class_name_snapshot,level_name_snapshot)
      select distinct on(m.id) e.id,m.id,m.id,null,m.name,mm.class_id,mm.level_id,c.name,l.name
      from public.members m
      join public.member_memberships mm on mm.member_id=m.id
      join public.categories cat on cat.id=mm.category_id
      left join public.classes c on c.id=mm.class_id
      left join public.levels l on l.id=mm.level_id
      where (m.status='ACTIVE' or v_date<(m.updated_at at time zone 'Asia/Jakarta')::date)
        and (mm.active or mm.ended_on is not null or mm.valid_to is not null)
        and (mm.ended_on is null or v_date<mm.ended_on)
        and cat.slug=v_slug
        and mm.valid_from<=v_date
        and (mm.valid_to is null or mm.valid_to>=v_date)
        and (e.class_id is null or mm.class_id=e.class_id)
        and (e.level_id is null or mm.level_id=e.level_id)
        and (cardinality(v_people)=0 or m.id=any(v_people))
      order by m.id,mm.created_at desc;
    end if;

    if cardinality(v_people)>0 and (select count(*) from public.attendance_records where event_id=e.id)<>cardinality(v_people) then
      raise exception 'Sebagian peserta tidak sesuai lingkup, penempatan, jabatan, atau tanggal';
    end if;
  end if;

  return to_jsonb(e);
end
$function$;

