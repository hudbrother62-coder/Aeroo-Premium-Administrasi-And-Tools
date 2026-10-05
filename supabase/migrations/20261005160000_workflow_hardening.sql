create or replace function public.save_member(p_id uuid,p_revision integer,p_person jsonb,p_memberships jsonb) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare v_id uuid:=coalesce(p_id,gen_random_uuid());v_role public.app_role:=public.current_app_role();v_old public.members%rowtype;x jsonb;v_cat public.categories%rowtype;k public.classes%rowtype;v_category uuid;v_keep uuid[]:='{}';v_mm public.member_memberships%rowtype;v_mid uuid;begin
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
 insert into public.member_memberships(member_id,category_id,level_id,class_id,office,section,duties,valid_from,valid_to,active) values(v_id,v_category,nullif(x->>'level_id','')::uuid,nullif(x->>'class_id','')::uuid,nullif(x->>'office',''),nullif(x->>'section',''),nullif(x->>'duties',''),case when v_mm.id is not null then current_date else coalesce(nullif(x->>'valid_from','')::date,current_date) end,nullif(x->>'valid_to','')::date,coalesce((x->>'active')::boolean,true)) returning id into v_mid;
 end if;
 v_keep:=array_append(v_keep,v_mid);
 if coalesce((x->>'active')::boolean,true) then insert into public.member_categories(member_id,category_id) values(v_id,v_category) on conflict do nothing;end if;
 end loop;
 update public.member_memberships mm set active=false,valid_to=greatest(valid_from,current_date-1) where member_id=v_id and active and not(id=any(v_keep)) and exists(select 1 from public.categories c where c.id=mm.category_id and (v_role='ADMIN' or v_role='DEWAN_GURU' and c.slug in ('caberawit','muda-mudi') or v_role='KELOMPOK' and c.slug in ('kelompok','ibu-ibu','pengurus')));
 update public.members set class_id=(select class_id from public.member_memberships m join public.categories c on c.id=m.category_id where m.member_id=v_id and m.active and c.slug in ('caberawit','muda-mudi') order by case c.slug when 'caberawit' then 0 else 1 end limit 1),level_id=(select level_id from public.member_memberships m join public.categories c on c.id=m.category_id where m.member_id=v_id and m.active and c.slug in ('caberawit','muda-mudi') order by case c.slug when 'caberawit' then 0 else 1 end limit 1),section=(select section from public.member_memberships m join public.categories c on c.id=m.category_id where m.member_id=v_id and m.active and c.slug='pengurus' limit 1) where id=v_id;
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
 perform pg_advisory_xact_lock(hashtextextended(v_key,0));
 select * into e from public.attendance_events where session_key=v_key;
 if not found then
 insert into public.attendance_events(title,event_date,event_time,audience,activity_type_id,class_id,level_id,agenda_id,session_key,notes)
 values(coalesce(g.title,p_event->>'title'),v_date,coalesce((g.starts_at at time zone 'Asia/Jakarta')::time,nullif(p_event->>'event_time','')::time),a,v_activity,v_class,v_level,g.id,v_key,p_event->>'notes') returning * into e;
 v_slug:=case a when 'KELOMPOK' then 'kelompok' when 'CABERAWIT' then 'caberawit' when 'MUDA_MUDI' then 'muda-mudi' when 'IBU_IBU' then 'ibu-ibu' when 'PENGURUS' then 'pengurus' end;
 insert into public.attendance_records(event_id,member_id,participant_key,status,member_name_snapshot,class_id_snapshot,level_id_snapshot,class_name_snapshot,level_name_snapshot)
 select distinct on(m.id) e.id,m.id,m.id,null,m.name,mm.class_id,mm.level_id,c.name,l.name
 from public.members m join public.member_memberships mm on mm.member_id=m.id join public.categories cat on cat.id=mm.category_id left join public.classes c on c.id=mm.class_id left join public.levels l on l.id=mm.level_id
 where (m.status='ACTIVE' or v_date<(m.updated_at at time zone 'Asia/Jakarta')::date) and (mm.active or mm.valid_to is not null) and cat.slug=v_slug and mm.valid_from<=v_date and (mm.valid_to is null or mm.valid_to>=v_date)
 and (e.class_id is null or mm.class_id=e.class_id) and (e.level_id is null or mm.level_id=e.level_id)
 and (cardinality(v_people)=0 or m.id=any(v_people)) order by m.id,mm.created_at desc;
 end if;
 return to_jsonb(e);
end $$;
create or replace function public.save_attendance_record(p_event_id uuid,p_participant_key uuid,p_revision integer,p_status text,p_notes text) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare r public.attendance_records%rowtype;v_old public.attendance_records%rowtype;begin
 if p_revision is null or p_revision<0 then raise exception 'Versi catatan wajib valid';end if;
 if not coalesce(public.can_write_event(p_event_id),false) then raise exception 'Akses ditolak';end if;
 if exists(select 1 from public.attendance_events where id=p_event_id and state='CANCELLED') then raise exception 'Pertemuan dibatalkan';end if;
 if p_status is not null and p_status not in ('H','I','A') then raise exception 'Status tidak valid';end if;
 if length(coalesce(p_notes,''))>2000 then raise exception 'Keterangan maksimal 2000 karakter';end if;
 select * into r from public.attendance_records where event_id=p_event_id and participant_key=p_participant_key for update;
 if not found then raise exception 'Peserta tidak ada dalam daftar pertemuan';end if;
 -- Idempotent retry: identical persisted values are already successful.
 if r.status::text is not distinct from p_status and coalesce(r.notes,'')=coalesce(p_notes,'') then return jsonb_build_object('record',to_jsonb(r));end if;
 if r.revision is distinct from p_revision then return jsonb_build_object('conflict',true,'record',to_jsonb(r));end if;
 v_old:=r;
 update public.attendance_records set status=p_status::public.attendance_status,notes=nullif(p_notes,''),revision=revision+1,updated_at=now() where id=r.id returning * into r;
 insert into public.attendance_changes(record_id,actor_id,old_status,new_status,old_notes,new_notes,revision) values(r.id,public.current_app_user_id(),v_old.status::text,r.status::text,v_old.notes,r.notes,r.revision);
 return jsonb_build_object('record',to_jsonb(r));
end $$;
revoke all on function public.save_member(uuid,integer,jsonb,jsonb),public.ensure_attendance(jsonb),public.save_attendance_record(uuid,uuid,integer,text,text) from public;
grant execute on function public.save_member(uuid,integer,jsonb,jsonb),public.ensure_attendance(jsonb),public.save_attendance_record(uuid,uuid,integer,text,text) to anon,authenticated;
-- Preserve prior lifecycle semantics for baseline history.
update public.member_memberships mm set valid_from=(m.created_at at time zone 'Asia/Jakarta')::date from public.members m where mm.member_id=m.id and mm.created_at>='2026-10-05' and mm.valid_from='2026-10-05' and m.created_at<mm.created_at;
update public.journals set state='COMPLETED' where created_at<'2026-10-05 14:30:00+00' and state='DRAFT';
revoke all on function public.viewer_overview(),public.viewer_recap(date,integer) from public,anon,authenticated;
