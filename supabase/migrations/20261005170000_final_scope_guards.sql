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
 where (m.status='ACTIVE' or v_date<(m.updated_at at time zone 'Asia/Jakarta')::date) and (mm.active or (mm.valid_to is not null and v_date<current_date)) and cat.slug=v_slug and mm.valid_from<=v_date and (mm.valid_to is null or mm.valid_to>=v_date)
 and (e.class_id is null or mm.class_id=e.class_id) and (e.level_id is null or mm.level_id=e.level_id)
 and (cardinality(v_people)=0 or m.id=any(v_people)) order by m.id,mm.created_at desc;
 if cardinality(v_people)>0 and (select count(*) from public.attendance_records where event_id=e.id)<>cardinality(v_people) then raise exception 'Sebagian peserta tidak sesuai kategori, penempatan, atau tanggal';end if;
 end if;
 return to_jsonb(e);
end $$;
create or replace function public.save_journal(p_id uuid,p_revision integer,p_body jsonb,p_progress jsonb) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare j public.journals%rowtype;old_j public.journals%rowtype;e public.attendance_events%rowtype;a public.audience_type;x jsonb;v_member uuid;v_target uuid;v_name text;begin
 if p_revision is null or p_revision<0 then raise exception 'Versi jurnal wajib valid';end if;
 a:=public.journal_audience(p_body->>'journal_kind');
 if a is null or not coalesce(public.can_write_audience(a),false) then raise exception 'Jenis jurnal di luar akses';end if;
 if p_body->>'journal_kind' not in ('KELOMPOK','IBU_IBU','PENGURUS','CABERAWIT_CLASS','CABERAWIT_INDIVIDUAL','MUDA_MUDI_CLASS','MUDA_MUDI_INDIVIDUAL') then raise exception 'Jenis jurnal tidak valid';end if;
 if p_id is not null then select * into old_j from public.journals where id=p_id for update;if not found or not public.can_write_journal_id(p_id) then raise exception 'Jurnal di luar akses';end if;if old_j.revision is distinct from p_revision then raise exception 'CONFLICT: Jurnal sudah diubah petugas lain';end if;end if;
 j:=jsonb_populate_record(null::public.journals,case when p_id is null then p_body else to_jsonb(old_j)||p_body end);
 j.id:=coalesce(p_id,gen_random_uuid());j.journal_kind:=p_body->>'journal_kind';j.state:=coalesce(j.state,'DRAFT');j.revision:=coalesce(old_j.revision,-1)+1;j.created_at:=coalesce(old_j.created_at,now());j.updated_at:=now();
 if j.state not in ('DRAFT','COMPLETED','ARCHIVED') or j.journal_date is null or length(trim(coalesce(j.title,'')))=0 then raise exception 'Judul, tanggal, dan status jurnal wajib valid';end if;
 if j.ended_at is not null and j.started_at is not null and j.ended_at<=j.started_at then raise exception 'Jam selesai harus setelah mulai';end if;
 if j.event_id is not null then select * into e from public.attendance_events where id=j.event_id;if not found or e.audience<>a or not public.can_write_event(e.id) or e.state='CANCELLED' then raise exception 'Pertemuan tidak sesuai jurnal';end if;if e.event_date<>j.journal_date or (e.class_id is not null and e.class_id is distinct from j.class_id) then raise exception 'Tanggal atau kelas jurnal tidak sesuai pertemuan';end if;end if;
 if j.activity_type_id is not null and not exists(select 1 from public.activity_types where id=j.activity_type_id and audience=a and active) then raise exception 'Jenis kegiatan tidak sesuai jurnal';end if;
 if j.class_id is not null and not exists(select 1 from public.classes where id=j.class_id and audience=a) then raise exception 'Kelas tidak sesuai jurnal';end if;
 if j.journal_kind like '%_INDIVIDUAL' and j.event_id is null then raise exception 'Jurnal individu harus terhubung pertemuan';end if;
 if j.member_id is not null and not exists(select 1 from public.attendance_records where event_id=j.event_id and member_id=j.member_id) then raise exception 'Anggota bukan peserta pertemuan';end if;
 if jsonb_typeof(coalesce(p_progress,'[]'))<>'array' then raise exception 'Penilaian harus berupa daftar';end if;
 if j.journal_kind not like '%_INDIVIDUAL' and jsonb_array_length(coalesce(p_progress,'[]'))>0 then raise exception 'Penilaian individu harus memakai jurnal individu';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(p_progress,'[]')) el group by el->>'member_id',el->>'target_id' having count(*)>1) then raise exception 'Target peserta digandakan';end if;
 for x in select value from jsonb_array_elements(coalesce(p_progress,'[]')) loop
 v_member:=(x->>'member_id')::uuid;v_target:=nullif(x->>'target_id','')::uuid;
 if not exists(select 1 from public.attendance_records where event_id=j.event_id and member_id=v_member and status='H') then raise exception 'Hanya peserta hadir yang dapat dinilai';end if;
 if nullif(x->>'progress_value','') is not null and ((x->>'progress_value')::numeric<0 or (x->>'progress_value')::numeric>100) then raise exception 'Progres harus 0–100';end if;
 if v_target is not null and not exists(select 1 from public.learning_targets t join public.attendance_records r on r.event_id=j.event_id and r.member_id=v_member where t.id=v_target and (t.level_id is null or t.level_id=r.level_id_snapshot) and (t.class_id is null or t.class_id=r.class_id_snapshot) and (t.target_month is null or date_trunc('month',t.target_month)=date_trunc('month',j.journal_date))) then raise exception 'Target tidak sesuai jenjang, kelas, atau bulan';end if;
 end loop;
 if p_id is not null then insert into public.journal_revisions(journal_id,actor_id,snapshot) values(p_id,public.current_app_user_id(),to_jsonb(old_j)||jsonb_build_object('progress',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.journal_progress p where journal_id=p_id)));
 update public.journals set journal_date=j.journal_date,journal_kind=j.journal_kind,event_id=j.event_id,activity_type_id=j.activity_type_id,title=j.title,material=j.material,person_in_charge=j.person_in_charge,summary=j.summary,result=j.result,obstacles=j.obstacles,follow_up=j.follow_up,notes=j.notes,class_id=j.class_id,member_id=j.member_id,started_at=j.started_at,ended_at=j.ended_at,achievement=j.achievement,improvement_plan=j.improvement_plan,decisions=j.decisions,assessment=coalesce(j.assessment,'{}'),state=j.state,revision=j.revision,updated_at=now() where id=j.id;
 delete from public.journal_progress where journal_id=j.id;
 else insert into public.journals select j.*;end if;
 for x in select value from jsonb_array_elements(coalesce(p_progress,'[]')) loop
 select member_name_snapshot into v_name from public.attendance_records where event_id=j.event_id and member_id=(x->>'member_id')::uuid;
 insert into public.journal_progress(journal_id,member_id,member_name_snapshot,target_id,progress_value,progress_note,assessment,follow_up) values(j.id,(x->>'member_id')::uuid,v_name,nullif(x->>'target_id','')::uuid,nullif(x->>'progress_value','')::numeric,coalesce(x->>'progress_note',''),coalesce(x->'assessment','{}'),nullif(x->>'follow_up',''));
 end loop;
 return to_jsonb(j);
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
 if exists(select 1 from unnest(g.participant_ids) person where not exists(select 1 from public.member_memberships mm join public.categories c on c.id=mm.category_id join public.members m on m.id=mm.member_id where mm.member_id=person and mm.active and m.status='ACTIVE' and c.slug=(case g.audience when 'KELOMPOK' then 'kelompok' when 'IBU_IBU' then 'ibu-ibu' when 'PENGURUS' then 'pengurus' when 'CABERAWIT' then 'caberawit' when 'MUDA_MUDI' then 'muda-mudi' end) and (g.class_id is null or mm.class_id=g.class_id) and (g.level_id is null or mm.level_id=g.level_id))) then raise exception 'Peserta tidak sesuai kategori atau kelas';end if;
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
create or replace function public.save_members_batch(p_rows jsonb) returns integer language plpgsql security definer set search_path='' as $$ declare x jsonb;n integer:=0;begin
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>500 then raise exception 'Maksimal 500 anggota';end if;
 for x in select value from jsonb_array_elements(p_rows) order by value->>'id' loop perform public.save_member(nullif(x->>'id','')::uuid,coalesce((x->>'revision')::int,0),x->'person',x->'memberships');n:=n+1;end loop;return n;end $$;

revoke insert,update,delete on public.caberawit,public.caberawit_progress from anon,authenticated;
