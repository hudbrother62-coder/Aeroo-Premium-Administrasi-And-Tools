alter table public.member_memberships add column ended_on date;
update public.member_memberships set ended_on=valid_to+1 where not active and valid_to is not null;
create or replace function public.save_member(p_id uuid,p_revision integer,p_person jsonb,p_memberships jsonb) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare v_id uuid:=coalesce(p_id,gen_random_uuid());v_role public.app_role:=public.current_app_role();v_old public.members%rowtype;x jsonb;v_cat public.categories%rowtype;k public.classes%rowtype;v_category uuid;v_keep uuid[]:='{}';v_mm public.member_memberships%rowtype;v_mid uuid;v_effective date;v_end_dates jsonb:='{}';begin
 if p_revision is null or p_revision<0 then raise exception 'Versi data wajib valid';end if;
 if v_role is null or v_role='VIEWER' then raise exception 'Akses input ditolak';end if;
 if p_memberships is null or jsonb_typeof(p_memberships)<>'array' or jsonb_array_length(p_memberships)=0 then raise exception 'Pilih kategori keikutsertaan';end if;
 if exists(select 1 from jsonb_array_elements(p_memberships) el join public.categories c on c.id=(el->>'category_id')::uuid where c.slug<>'pengurus' group by c.id having count(*)>1) then raise exception 'Kategori yang sama digandakan';end if;
 if length(trim(coalesce(p_person->>'name','')))=0 then raise exception 'Nama wajib diisi';end if;
 if p_id is not null then select * into v_old from public.members where id=p_id for update;
 if not found or not(v_role='ADMIN' or v_role='DEWAN_GURU' and public.member_is_dewan_scope(p_id) or v_role='KELOMPOK' and public.member_is_kelompok_read_scope(p_id)) then raise exception 'Anggota di luar akses';end if;
 if v_old.revision is distinct from p_revision then raise exception 'CONFLICT: Data telah diubah petugas lain';end if;end if;
 for x in select value from jsonb_array_elements(p_memberships) loop
 select * into v_cat from public.categories where id=(x->>'category_id')::uuid;
 if not found or not public.can_write_audience(case v_cat.slug when 'kelompok' then 'KELOMPOK'::public.audience_type when 'caberawit' then 'CABERAWIT'::public.audience_type when 'muda-mudi' then 'MUDA_MUDI'::public.audience_type when 'ibu-ibu' then 'IBU_IBU'::public.audience_type when 'pengurus' then 'PENGURUS'::public.audience_type else 'CUSTOM'::public.audience_type end) then raise exception 'Kategori di luar akses';end if;
 if nullif(x->>'class_id','') is not null then select * into k from public.classes where id=(x->>'class_id')::uuid and active;
 if not found or k.audience::text<>(case v_cat.slug when 'caberawit' then 'CABERAWIT' when 'muda-mudi' then 'MUDA_MUDI' else 'INVALID' end) then raise exception 'Kelas tidak sesuai kategori';end if;
 if k.level_id is not null and k.level_id is distinct from nullif(x->>'level_id','')::uuid then raise exception 'Jenjang tidak sesuai kelas';end if;end if;
 if v_cat.slug not in ('caberawit','muda-mudi') and (nullif(x->>'class_id','') is not null or nullif(x->>'level_id','') is not null) then raise exception 'Kategori ini tidak memakai jenjang belajar';end if;
 if nullif(x->>'level_id','') is not null and not exists(select 1 from public.levels where id=(x->>'level_id')::uuid and active) then raise exception 'Jenjang tidak aktif';end if;
 if v_cat.slug<>'pengurus' and (nullif(x->>'office','') is not null or nullif(x->>'duties','') is not null) then raise exception 'Jabatan hanya untuk Pengurus';end if;
 end loop;
 insert into public.members(id,name,gender,birth_place,birth_date,phone,address,notes,guardian_name,guardian_phone) values(v_id,trim(p_person->>'name'),nullif(p_person->>'gender',''),nullif(p_person->>'birth_place',''),nullif(p_person->>'birth_date','')::date,nullif(p_person->>'phone',''),nullif(p_person->>'address',''),nullif(p_person->>'notes',''),nullif(p_person->>'guardian_name',''),nullif(p_person->>'guardian_phone',''))
 on conflict(id) do update set name=excluded.name,gender=excluded.gender,birth_place=excluded.birth_place,birth_date=excluded.birth_date,phone=excluded.phone,address=excluded.address,notes=excluded.notes,guardian_name=excluded.guardian_name,guardian_phone=excluded.guardian_phone,updated_at=now(),revision=public.members.revision+1;
 delete from public.member_categories mc where member_id=v_id and exists(select 1 from public.categories c where c.id=mc.category_id and (v_role='ADMIN' or v_role='DEWAN_GURU' and c.slug in ('caberawit','muda-mudi') or v_role='KELOMPOK' and c.slug in ('kelompok','ibu-ibu','pengurus')));
 for x in select value from jsonb_array_elements(p_memberships) loop
 v_category:=(x->>'category_id')::uuid;
 select * into v_mm from public.member_memberships where id=nullif(x->>'id','')::uuid and member_id=v_id and category_id=v_category and active;
 if found and v_mm.class_id is not distinct from nullif(x->>'class_id','')::uuid and v_mm.level_id is not distinct from nullif(x->>'level_id','')::uuid and coalesce(v_mm.office,'')=coalesce(x->>'office','') and coalesce(v_mm.section,'')=coalesce(x->>'section','') and coalesce(v_mm.duties,'')=coalesce(x->>'duties','') and v_mm.valid_to is not distinct from nullif(x->>'valid_to','')::date and v_mm.valid_from=coalesce(nullif(x->>'valid_from','')::date,v_mm.valid_from) and v_mm.active=coalesce((x->>'active')::boolean,true) then
 v_mid:=v_mm.id;
 else
 v_effective:=case when v_mm.id is not null and coalesce(nullif(x->>'valid_from','')::date,v_mm.valid_from)=v_mm.valid_from then current_date else coalesce(nullif(x->>'valid_from','')::date,current_date) end;
 if v_mm.id is not null then v_end_dates:=v_end_dates||jsonb_build_object(v_mm.id::text,v_effective);end if;
 insert into public.member_memberships(member_id,category_id,level_id,class_id,office,section,duties,valid_from,valid_to,active) values(v_id,v_category,nullif(x->>'level_id','')::uuid,nullif(x->>'class_id','')::uuid,nullif(x->>'office',''),nullif(x->>'section',''),nullif(x->>'duties',''),v_effective,nullif(x->>'valid_to','')::date,coalesce((x->>'active')::boolean,true)) returning id into v_mid;
 end if;
 v_keep:=array_append(v_keep,v_mid);
 if coalesce((x->>'active')::boolean,true) then insert into public.member_categories(member_id,category_id) values(v_id,v_category) on conflict do nothing;end if;
 end loop;
 update public.member_memberships mm set active=false,ended_on=coalesce((v_end_dates->>mm.id::text)::date,current_date),valid_to=greatest(valid_from,coalesce((v_end_dates->>mm.id::text)::date,current_date)-1) where member_id=v_id and active and not(id=any(v_keep)) and exists(select 1 from public.categories c where c.id=mm.category_id and (v_role='ADMIN' or v_role='DEWAN_GURU' and c.slug in ('caberawit','muda-mudi') or v_role='KELOMPOK' and c.slug in ('kelompok','ibu-ibu','pengurus')));
 delete from public.member_categories mc where member_id=v_id and exists(select 1 from public.categories c where c.id=mc.category_id and (v_role='ADMIN' or v_role='DEWAN_GURU' and c.slug in ('caberawit','muda-mudi') or v_role='KELOMPOK' and c.slug in ('kelompok','ibu-ibu','pengurus')));
 insert into public.member_categories(member_id,category_id) select distinct v_id,mm.category_id from public.member_memberships mm join public.categories c on c.id=mm.category_id where mm.member_id=v_id and mm.valid_from<=current_date and (mm.valid_to is null or mm.valid_to>=current_date) and (mm.ended_on is null or mm.ended_on>current_date) and (mm.active or mm.ended_on is not null or mm.valid_to is not null) and (v_role='ADMIN' or v_role='DEWAN_GURU' and c.slug in ('caberawit','muda-mudi') or v_role='KELOMPOK' and c.slug in ('kelompok','ibu-ibu','pengurus')) on conflict do nothing;
 update public.members set class_id=(select class_id from public.member_memberships m join public.categories c on c.id=m.category_id where m.member_id=v_id and m.valid_from<=current_date and (m.valid_to is null or m.valid_to>=current_date) and (m.ended_on is null or m.ended_on>current_date) and c.slug in ('caberawit','muda-mudi') order by case c.slug when 'caberawit' then 0 else 1 end limit 1),level_id=(select level_id from public.member_memberships m join public.categories c on c.id=m.category_id where m.member_id=v_id and m.valid_from<=current_date and (m.valid_to is null or m.valid_to>=current_date) and (m.ended_on is null or m.ended_on>current_date) and c.slug in ('caberawit','muda-mudi') order by case c.slug when 'caberawit' then 0 else 1 end limit 1),section=(select section from public.member_memberships m join public.categories c on c.id=m.category_id where m.member_id=v_id and m.valid_from<=current_date and (m.valid_to is null or m.valid_to>=current_date) and (m.ended_on is null or m.ended_on>current_date) and c.slug='pengurus' limit 1) where id=v_id;
 return (select to_jsonb(m) from public.members m where id=v_id);
end $$;
create or replace function public.ensure_attendance(p_event jsonb) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare e public.attendance_events%rowtype;g public.agenda%rowtype;a public.audience_type;v_key text;v_slug text;v_date date;v_class uuid;v_level uuid;v_activity uuid;v_people uuid[]:='{}';begin
 if nullif(p_event->>'agenda_id','') is not null then select * into g from public.agenda where id=(p_event->>'agenda_id')::uuid;
 if not found or g.status='CANCELLED' or not g.attendance_enabled then raise exception 'Agenda tidak dapat diabsen';end if;
 v_class:=g.class_id;v_level:=g.level_id;v_activity:=g.activity_type_id;v_people:=g.participant_ids;
 a:=g.audience;v_date:=(g.starts_at at time zone 'Asia/Jakarta')::date;v_key:='agenda:'||g.id;
 else v_class:=nullif(p_event->>'class_id','')::uuid;v_level:=nullif(p_event->>'level_id','')::uuid;v_activity:=nullif(p_event->>'activity_type_id','')::uuid;
 if p_event->'member_ids' is not null and jsonb_typeof(p_event->'member_ids')<>'array' then raise exception 'Daftar peserta tidak valid';end if;
 select coalesce(array_agg(distinct value::uuid order by value::uuid),'{}') into v_people from jsonb_array_elements_text(coalesce(p_event->'member_ids','[]'));
 a:=(p_event->>'audience')::public.audience_type;v_date:=(p_event->>'event_date')::date;
 v_key:=a||':'||v_date||':'||coalesce(p_event->>'class_id','')||':'||coalesce(p_event->>'level_id','')||':'||coalesce(p_event->>'event_time','')||':'||lower(trim(p_event->>'title'))||':'||array_to_string(v_people,',');end if;
 if not coalesce(public.can_write_audience(a),false) then raise exception 'Kegiatan di luar akses';end if;
 if a is null or v_date is null then raise exception 'Kategori dan tanggal wajib diisi';end if;
 if v_class is not null and not exists(select 1 from public.classes where id=v_class and audience=a and active and (v_level is null or level_id=v_level)) then raise exception 'Kelas tidak sesuai kategori atau jenjang';end if;
 if v_level is not null and (a not in ('CABERAWIT','MUDA_MUDI') or not exists(select 1 from public.levels where id=v_level and active)) then raise exception 'Jenjang tidak sesuai kategori';end if;
 if v_activity is not null and not exists(select 1 from public.activity_types where id=v_activity and audience=a and active) then raise exception 'Jenis kegiatan tidak sesuai kategori';end if;
 if v_class is not null and v_level is null then select level_id into v_level from public.classes where id=v_class;end if;
 if g.id is null and length(trim(coalesce(p_event->>'title','')))=0 then raise exception 'Judul kegiatan wajib diisi';end if;
 if g.id is null then v_key:=a||':'||v_date||':'||coalesce(v_class::text,'')||':'||coalesce(v_level::text,'')||':'||coalesce(v_activity::text,'')||':'||coalesce(p_event->>'event_time','')||':'||lower(trim(p_event->>'title'))||':'||array_to_string(v_people,',');end if;
 perform pg_advisory_xact_lock(hashtextextended(v_key,0));
 select * into e from public.attendance_events where session_key=v_key;
 if not found then
 insert into public.attendance_events(title,event_date,event_time,audience,activity_type_id,class_id,level_id,agenda_id,session_key,notes)
 values(coalesce(g.title,p_event->>'title'),v_date,coalesce((g.starts_at at time zone 'Asia/Jakarta')::time,nullif(p_event->>'event_time','')::time),a,v_activity,v_class,v_level,g.id,v_key,p_event->>'notes') returning * into e;
 v_slug:=case a when 'KELOMPOK' then 'kelompok' when 'CABERAWIT' then 'caberawit' when 'MUDA_MUDI' then 'muda-mudi' when 'IBU_IBU' then 'ibu-ibu' when 'PENGURUS' then 'pengurus' end;
 insert into public.attendance_records(event_id,member_id,participant_key,status,member_name_snapshot,class_id_snapshot,level_id_snapshot,class_name_snapshot,level_name_snapshot)
 select distinct on(m.id) e.id,m.id,m.id,null,m.name,mm.class_id,mm.level_id,c.name,l.name
 from public.members m join public.member_memberships mm on mm.member_id=m.id join public.categories cat on cat.id=mm.category_id left join public.classes c on c.id=mm.class_id left join public.levels l on l.id=mm.level_id
 where (m.status='ACTIVE' or v_date<(m.updated_at at time zone 'Asia/Jakarta')::date) and (mm.active or mm.ended_on is not null or mm.valid_to is not null) and (mm.ended_on is null or v_date<mm.ended_on) and cat.slug=v_slug and mm.valid_from<=v_date and (mm.valid_to is null or mm.valid_to>=v_date)
 and (e.class_id is null or mm.class_id=e.class_id) and (e.level_id is null or mm.level_id=e.level_id)
 and (cardinality(v_people)=0 or m.id=any(v_people)) order by m.id,mm.created_at desc;
 if cardinality(v_people)>0 and (select count(*) from public.attendance_records where event_id=e.id)<>cardinality(v_people) then raise exception 'Sebagian peserta tidak sesuai kategori, penempatan, atau tanggal';end if;
 end if;
 return to_jsonb(e);
end $$;
create or replace function public.save_agenda(p_id uuid,p_revision integer,p_items jsonb,p_scope text default 'this') returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare old_g public.agenda%rowtype;g public.agenda%rowtype;x jsonb;v_series uuid;v_result jsonb:='[]';v_ids uuid[];begin
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>366 then raise exception 'Daftar agenda tidak valid';end if;
 if p_revision is null or p_revision<0 then raise exception 'Versi agenda wajib valid';end if;
 if p_id is not null and jsonb_array_length(p_items)<>1 then raise exception 'Perubahan satu agenda wajib satu objek';end if;
 if p_scope not in ('this','future') then raise exception 'Lingkup perubahan tidak valid';end if;
 if p_id is not null then select * into old_g from public.agenda where id=p_id for update;if not found or not coalesce(public.can_write_audience(old_g.audience),false) then raise exception 'Agenda di luar akses';end if;if old_g.revision is distinct from p_revision then raise exception 'CONFLICT: Agenda sudah diubah petugas lain';end if;end if;
 v_series:=coalesce(old_g.series_id,gen_random_uuid());
 for x in select value from jsonb_array_elements(p_items) loop
 g:=jsonb_populate_record(null::public.agenda,case when p_id is null then x else to_jsonb(old_g)||x end);
 if not coalesce(public.can_write_audience(g.audience),false) then raise exception 'Agenda di luar akses';end if;
 if length(trim(coalesce(g.title,'')))=0 or g.starts_at is null or g.ends_at<=g.starts_at then raise exception 'Judul atau waktu agenda tidak valid';end if;
 g.status:=coalesce(g.status,'SCHEDULED');g.attendance_enabled:=coalesce(g.attendance_enabled,true);g.participant_ids:=coalesce(g.participant_ids,'{}');g.recurrence:=coalesce(g.recurrence,'once');g.created_at:=coalesce(old_g.created_at,now());g.series_id:=v_series;
 if g.level_id is not null and (g.audience not in ('CABERAWIT','MUDA_MUDI') or not exists(select 1 from public.levels where id=g.level_id and active)) then raise exception 'Jenjang tidak sesuai kategori';end if;
 if g.activity_type_id is not null and not exists(select 1 from public.activity_types where id=g.activity_type_id and audience=g.audience and active) then raise exception 'Jenis kegiatan tidak sesuai kategori';end if;
 if g.class_id is not null and not exists(select 1 from public.classes where id=g.class_id and audience=g.audience and (g.level_id is null or level_id=g.level_id)) then raise exception 'Kelas tidak sesuai kategori atau jenjang';end if;
 if (p_id is null or g.participant_ids is distinct from old_g.participant_ids or g.class_id is distinct from old_g.class_id or g.level_id is distinct from old_g.level_id or g.audience<>old_g.audience) and exists(select 1 from unnest(g.participant_ids) person where not exists(select 1 from public.member_memberships mm join public.categories c on c.id=mm.category_id join public.members m on m.id=mm.member_id where mm.member_id=person and mm.active and m.status='ACTIVE' and c.slug=(case g.audience when 'KELOMPOK' then 'kelompok' when 'IBU_IBU' then 'ibu-ibu' when 'PENGURUS' then 'pengurus' when 'CABERAWIT' then 'caberawit' when 'MUDA_MUDI' then 'muda-mudi' end) and (g.class_id is null or mm.class_id=g.class_id) and (g.level_id is null or mm.level_id=g.level_id))) then raise exception 'Peserta tidak sesuai kategori atau kelas';end if;
 if p_id is null then g.id:=gen_random_uuid();g.revision:=0;insert into public.agenda select g.*;v_result:=v_result||jsonb_build_array(to_jsonb(g));
 else
 if exists(select 1 from public.attendance_events where agenda_id=old_g.id) and (g.starts_at is distinct from old_g.starts_at or g.ends_at is distinct from old_g.ends_at or g.audience<>old_g.audience or g.class_id is distinct from old_g.class_id or g.level_id is distinct from old_g.level_id or g.participant_ids is distinct from old_g.participant_ids) then raise exception 'Pertemuan sudah memiliki absensi; buat pertemuan baru untuk mengubah waktu atau daftar peserta';end if;
 select array_agg(id) into v_ids from public.agenda where id=p_id or (p_scope='future' and series_id=old_g.series_id and starts_at>=old_g.starts_at);
 if exists(select 1 from public.agenda where id=any(v_ids) and not coalesce(public.can_write_audience(audience),false)) then raise exception 'Sebagian rangkaian di luar akses';end if;
 if p_scope='future' and exists(select 1 from public.agenda a join public.attendance_events e on e.agenda_id=a.id where a.id=any(v_ids) and a.id<>p_id and (g.audience<>a.audience or g.class_id is distinct from a.class_id or g.level_id is distinct from a.level_id or g.participant_ids is distinct from a.participant_ids or g.starts_at is distinct from old_g.starts_at or g.ends_at is distinct from old_g.ends_at)) then raise exception 'Rangkaian memiliki absensi; daftar peserta tidak dapat diubah';end if;
 update public.agenda a set title=g.title,location=g.location,presenter=g.presenter,notes=g.notes,person_in_charge=g.person_in_charge,status=g.status,attendance_enabled=g.attendance_enabled,activity_type_id=g.activity_type_id,audience=g.audience,class_id=g.class_id,level_id=g.level_id,participant_ids=g.participant_ids,starts_at=case when a.id=p_id then g.starts_at else a.starts_at+(g.starts_at-old_g.starts_at) end,ends_at=case when a.id=p_id then g.ends_at else case when g.ends_at is null then null else a.starts_at+(g.starts_at-old_g.starts_at)+(g.ends_at-g.starts_at) end end,revision=a.revision+1 where a.id=any(v_ids);
 update public.attendance_events set state=g.status,title=g.title where agenda_id=any(v_ids);
 v_result:=v_result||(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.agenda a where id=any(v_ids));
 end if;
 end loop;return v_result;
end $$;
create or replace function public.save_journal(p_id uuid,p_revision integer,p_body jsonb,p_progress jsonb) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare j public.journals%rowtype;old_j public.journals%rowtype;e public.attendance_events%rowtype;g public.agenda%rowtype;a public.audience_type;x jsonb;v_member uuid;v_target uuid;v_name text;begin
 if p_revision is null or p_revision<0 then raise exception 'Versi jurnal wajib valid';end if;
 a:=public.journal_audience(p_body->>'journal_kind');
 if a is null or not coalesce(public.can_write_audience(a),false) then raise exception 'Jenis jurnal di luar akses';end if;
 if p_body->>'journal_kind' not in ('KELOMPOK','IBU_IBU','PENGURUS','CABERAWIT_CLASS','CABERAWIT_INDIVIDUAL','MUDA_MUDI_CLASS','MUDA_MUDI_INDIVIDUAL') then raise exception 'Jenis jurnal tidak valid';end if;
 if p_id is not null then select * into old_j from public.journals where id=p_id for update;if not found or not public.can_write_journal_id(p_id) then raise exception 'Jurnal di luar akses';end if;if old_j.revision is distinct from p_revision then raise exception 'CONFLICT: Jurnal sudah diubah petugas lain';end if;end if;
 j:=jsonb_populate_record(null::public.journals,case when p_id is null then p_body else to_jsonb(old_j)||p_body end);
 j.id:=coalesce(p_id,gen_random_uuid());j.journal_kind:=p_body->>'journal_kind';j.state:=coalesce(j.state,'DRAFT');j.revision:=coalesce(old_j.revision,-1)+1;j.created_at:=coalesce(old_j.created_at,now());j.updated_at:=now();
 if j.state not in ('DRAFT','COMPLETED','ARCHIVED') or j.journal_date is null or length(trim(coalesce(j.title,'')))=0 then raise exception 'Judul, tanggal, dan status jurnal wajib valid';end if;
 if j.ended_at is not null and j.started_at is not null and j.ended_at<=j.started_at then raise exception 'Jam selesai harus setelah mulai';end if;
 if j.agenda_id is not null then select * into g from public.agenda where id=j.agenda_id;if not found or g.audience<>a or not coalesce(public.can_write_audience(g.audience),false) or (g.status='CANCELLED' and j.state<>'ARCHIVED') or (g.starts_at at time zone 'Asia/Jakarta')::date<>j.journal_date then raise exception 'Agenda tidak sesuai jurnal';end if;end if;
 if j.event_id is not null then select * into e from public.attendance_events where id=j.event_id;if not found or e.audience<>a or not public.can_write_event(e.id) or (e.state='CANCELLED' and j.state<>'ARCHIVED') then raise exception 'Pertemuan tidak sesuai jurnal';end if;if j.agenda_id is not null and e.agenda_id is distinct from j.agenda_id then raise exception 'Pertemuan tidak sesuai agenda';end if;if e.event_date<>j.journal_date or (e.class_id is not null and e.class_id is distinct from j.class_id) then raise exception 'Tanggal atau kelas jurnal tidak sesuai pertemuan';end if;end if;
 if j.activity_type_id is not null and not exists(select 1 from public.activity_types where id=j.activity_type_id and audience=a and active) then raise exception 'Jenis kegiatan tidak sesuai jurnal';end if;
 if j.class_id is not null and not exists(select 1 from public.classes where id=j.class_id and audience=a) then raise exception 'Kelas tidak sesuai jurnal';end if;
 if j.journal_kind like '%_INDIVIDUAL' and j.event_id is null then raise exception 'Jurnal individu harus terhubung pertemuan';end if;
 if j.member_id is not null and not exists(select 1 from public.attendance_records where event_id=j.event_id and member_id=j.member_id) then raise exception 'Anggota bukan peserta pertemuan';end if;
 if jsonb_typeof(coalesce(p_progress,'[]'))<>'array' then raise exception 'Penilaian harus berupa daftar';end if;
 if j.journal_kind not like '%_INDIVIDUAL' and jsonb_array_length(coalesce(p_progress,'[]'))>0 then raise exception 'Penilaian individu harus memakai jurnal individu';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(p_progress,'[]')) el group by el->>'member_id',el->>'target_id' having count(*)>1) then raise exception 'Target peserta digandakan';end if;
 for x in select value from jsonb_array_elements(coalesce(p_progress,'[]')) loop
 v_member:=(x->>'member_id')::uuid;v_target:=nullif(x->>'target_id','')::uuid;
 if j.state<>'ARCHIVED' and not exists(select 1 from public.attendance_records where event_id=j.event_id and participant_key=v_member and status='H') then raise exception 'Hanya peserta hadir yang dapat dinilai';end if;
 if nullif(x->>'progress_value','') is not null and ((x->>'progress_value')::numeric<0 or (x->>'progress_value')::numeric>100) then raise exception 'Progres harus 0–100';end if;
 if v_target is not null and not exists(select 1 from public.learning_targets t join public.attendance_records r on r.event_id=j.event_id and r.participant_key=v_member where t.id=v_target and (t.level_id is null or t.level_id=r.level_id_snapshot) and (t.class_id is null or t.class_id=r.class_id_snapshot) and (t.target_month is null or date_trunc('month',t.target_month)=date_trunc('month',j.journal_date))) then raise exception 'Target tidak sesuai jenjang, kelas, atau bulan';end if;
 end loop;
 if p_id is not null then insert into public.journal_revisions(journal_id,actor_id,actor_name,snapshot) values(p_id,public.current_app_user_id(),(select coalesce(display_name,username) from public.app_users where id=public.current_app_user_id()),to_jsonb(old_j)||jsonb_build_object('progress',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.journal_progress p where journal_id=p_id)));
 update public.journals set agenda_id=j.agenda_id,journal_date=j.journal_date,journal_kind=j.journal_kind,event_id=j.event_id,activity_type_id=j.activity_type_id,title=j.title,material=j.material,person_in_charge=j.person_in_charge,summary=j.summary,result=j.result,obstacles=j.obstacles,follow_up=j.follow_up,notes=j.notes,class_id=j.class_id,member_id=j.member_id,started_at=j.started_at,ended_at=j.ended_at,achievement=j.achievement,improvement_plan=j.improvement_plan,decisions=j.decisions,assessment=coalesce(j.assessment,'{}'),state=j.state,revision=j.revision,updated_at=now() where id=j.id;
 delete from public.journal_progress where journal_id=j.id;
 else insert into public.journals select j.*;end if;
 for x in select value from jsonb_array_elements(coalesce(p_progress,'[]')) loop
 select member_name_snapshot into v_name from public.attendance_records where event_id=j.event_id and participant_key=(x->>'member_id')::uuid;
 insert into public.journal_progress(journal_id,member_id,participant_key,member_name_snapshot,target_id,progress_value,progress_note,assessment,follow_up) values(j.id,(select id from public.members where id=(x->>'member_id')::uuid),(x->>'member_id')::uuid,v_name,nullif(x->>'target_id','')::uuid,nullif(x->>'progress_value','')::numeric,coalesce(x->>'progress_note',''),coalesce(x->'assessment','{}'),nullif(x->>'follow_up',''));
 end loop;
 return to_jsonb(j);
end $$;

create or replace function public.set_journal_state(p_id uuid,p_revision integer,p_state text) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$ declare j public.journals%rowtype;begin
 if p_state not in ('DRAFT','ARCHIVED') then raise exception 'Pemulihan harus sebagai draf';end if;
 select * into j from public.journals where id=p_id for update;if not found or not coalesce(public.can_write_journal_id(p_id),false) then raise exception 'Akses ditolak';end if;if j.revision is distinct from p_revision then raise exception 'CONFLICT: Jurnal sudah diubah';end if;
 insert into public.journal_revisions(journal_id,actor_id,actor_name,snapshot) values(p_id,public.current_app_user_id(),(select coalesce(display_name,username) from public.app_users where id=public.current_app_user_id()),to_jsonb(j));
 update public.journals set state=p_state,revision=revision+1,updated_at=now() where id=p_id returning * into j;return to_jsonb(j);
end $$;
revoke all on function public.set_journal_state(uuid,integer,text) from public;grant execute on function public.set_journal_state(uuid,integer,text) to anon,authenticated;
