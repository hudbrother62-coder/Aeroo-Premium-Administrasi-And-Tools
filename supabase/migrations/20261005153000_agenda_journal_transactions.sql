-- Atomic edits, audience consistency, journal snapshots and agenda occurrences.
create or replace function public.journal_audience(p_kind text) returns public.audience_type language sql immutable set search_path='' as $$ select case when p_kind like 'CABERAWIT_%' then 'CABERAWIT'::public.audience_type when p_kind like 'MUDA_MUDI_%' then 'MUDA_MUDI'::public.audience_type when p_kind='KELOMPOK' then 'KELOMPOK'::public.audience_type when p_kind='IBU_IBU' then 'IBU_IBU'::public.audience_type when p_kind='PENGURUS' then 'PENGURUS'::public.audience_type else null end $$;
create or replace function public.can_write_journal_id(p_journal_id uuid) returns boolean language sql stable security definer set search_path='' set row_security=off as $$ select coalesce((select public.can_write_audience(public.journal_audience(journal_kind)) from public.journals where id=p_journal_id),false) $$;
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
 if j.state<>'ARCHIVED' and not exists(select 1 from public.attendance_records where event_id=j.event_id and member_id=v_member and status='H') then raise exception 'Hanya peserta hadir yang dapat dinilai';end if;
 if nullif(x->>'progress_value','') is not null and ((x->>'progress_value')::numeric<0 or (x->>'progress_value')::numeric>100) then raise exception 'Progres harus 0–100';end if;
 if v_target is not null and not exists(select 1 from public.learning_targets t join public.attendance_records r on r.event_id=j.event_id and r.member_id=v_member where t.id=v_target and (t.level_id is null or t.level_id=r.level_id_snapshot) and (t.class_id is null or t.class_id=r.class_id_snapshot) and (t.target_month is null or date_trunc('month',t.target_month)=date_trunc('month',j.journal_date))) then raise exception 'Target tidak sesuai jenjang, kelas, atau bulan';end if;
 end loop;
 if p_id is not null then insert into public.journal_revisions(journal_id,actor_id,actor_name,snapshot) values(p_id,public.current_app_user_id(),(select coalesce(display_name,username) from public.app_users where id=public.current_app_user_id()),to_jsonb(old_j)||jsonb_build_object('progress',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.journal_progress p where journal_id=p_id)));
 update public.journals set agenda_id=j.agenda_id,journal_date=j.journal_date,journal_kind=j.journal_kind,event_id=j.event_id,activity_type_id=j.activity_type_id,title=j.title,material=j.material,person_in_charge=j.person_in_charge,summary=j.summary,result=j.result,obstacles=j.obstacles,follow_up=j.follow_up,notes=j.notes,class_id=j.class_id,member_id=j.member_id,started_at=j.started_at,ended_at=j.ended_at,achievement=j.achievement,improvement_plan=j.improvement_plan,decisions=j.decisions,assessment=coalesce(j.assessment,'{}'),state=j.state,revision=j.revision,updated_at=now() where id=j.id;
 delete from public.journal_progress where journal_id=j.id;
 else insert into public.journals select j.*;end if;
 for x in select value from jsonb_array_elements(coalesce(p_progress,'[]')) loop
 select member_name_snapshot into v_name from public.attendance_records where event_id=j.event_id and member_id=(x->>'member_id')::uuid;
 insert into public.journal_progress(journal_id,member_id,participant_key,member_name_snapshot,target_id,progress_value,progress_note,assessment,follow_up) values(j.id,(x->>'member_id')::uuid,(x->>'member_id')::uuid,v_name,nullif(x->>'target_id','')::uuid,nullif(x->>'progress_value','')::numeric,coalesce(x->>'progress_note',''),coalesce(x->'assessment','{}'),nullif(x->>'follow_up',''));
 end loop;
 return to_jsonb(j);
end $$;
revoke insert,update,delete on public.journals,public.journal_progress from anon,authenticated;
revoke all on function public.save_journal(uuid,integer,jsonb,jsonb) from public;
grant execute on function public.save_journal(uuid,integer,jsonb,jsonb) to anon,authenticated;
-- Concrete recurring instances are created together; linked historical roster stays immutable.
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
revoke insert,update,delete on public.agenda from anon,authenticated;
revoke all on function public.save_agenda(uuid,integer,jsonb,text) from public;grant execute on function public.save_agenda(uuid,integer,jsonb,text) to anon,authenticated;
create or replace function public.save_members_batch(p_rows jsonb) returns integer language plpgsql security definer set search_path='' as $$ declare x jsonb;n integer:=0;begin
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>500 then raise exception 'Maksimal 500 anggota';end if;
 for x in select value from jsonb_array_elements(p_rows) order by value->>'id' loop perform public.save_member(nullif(x->>'id','')::uuid,coalesce((x->>'revision')::int,0),x->'person',x->'memberships');n:=n+1;end loop;return n;end $$;
revoke all on function public.save_members_batch(jsonb) from public;grant execute on function public.save_members_batch(jsonb) to anon,authenticated;
alter table public.journals drop constraint journals_kind_check;
alter table public.journals add constraint journals_kind_check check(journal_kind in ('KELOMPOK','IBU_IBU','PENGURUS','CABERAWIT_CLASS','CABERAWIT_INDIVIDUAL','MUDA_MUDI_CLASS','MUDA_MUDI_INDIVIDUAL'));
drop policy journals_read on public.journals;
create policy journals_read on public.journals for select to anon,authenticated using(public.can_read_audience(public.journal_audience(journal_kind)));
drop policy journal_progress_read on public.journal_progress;
create policy journal_progress_read on public.journal_progress for select to anon,authenticated using(exists(select 1 from public.journals j where j.id=journal_id and public.can_read_audience(public.journal_audience(j.journal_kind))));
