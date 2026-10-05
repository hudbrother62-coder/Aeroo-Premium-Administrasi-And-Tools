-- Additive migration: preserve IDs and history, use explicit scoped memberships.
alter table public.members add column if not exists revision integer not null default 0;
alter table public.members add column if not exists guardian_name text;
alter table public.members add column if not exists guardian_phone text;
create table public.member_memberships (
 id uuid primary key default gen_random_uuid(), member_id uuid not null references public.members(id) on delete cascade,
 category_id uuid not null references public.categories(id), level_id uuid references public.levels(id),class_id uuid references public.classes(id),
 office text,section text,duties text,valid_from date not null default current_date,valid_to date,active boolean not null default true,
 created_at timestamptz not null default now(), check(valid_to is null or valid_to>=valid_from)
);
create index on public.member_memberships(member_id,category_id,active);
insert into public.member_memberships(member_id,category_id,level_id,class_id,section)
 select mc.member_id,mc.category_id,case when c.slug in ('caberawit','muda-mudi') then m.level_id end,
 case when c.slug in ('caberawit','muda-mudi') then m.class_id end,case when c.slug='pengurus' then m.section end
 from public.member_categories mc join public.members m on m.id=mc.member_id join public.categories c on c.id=mc.category_id;
alter table public.agenda add column audience public.audience_type not null default 'KELOMPOK';
update public.agenda g set audience=a.audience from public.activity_types a where a.id=g.activity_type_id;
alter table public.agenda add column class_id uuid references public.classes(id),add column level_id uuid references public.levels(id),
 add column participant_ids uuid[] not null default '{}',add column person_in_charge text,add column attendance_enabled boolean not null default true,
 add column status text not null default 'SCHEDULED' check(status in ('SCHEDULED','ONGOING','COMPLETED','CANCELLED')),
 add column series_id uuid,add column recurrence text not null default 'once',add column revision integer not null default 0;
alter table public.attendance_events add column agenda_id uuid references public.agenda(id),add column session_key text,
 add column state text not null default 'ONGOING' check(state in ('SCHEDULED','ONGOING','COMPLETED','CANCELLED'));
create unique index attendance_session_key on public.attendance_events(session_key) where session_key is not null;
create unique index attendance_agenda_id on public.attendance_events(agenda_id) where agenda_id is not null;
alter table public.attendance_records alter column status drop not null;
alter table public.attendance_records add column revision integer not null default 0,
 add column participant_key uuid,add column class_id_snapshot uuid,add column level_id_snapshot uuid,
 add column class_name_snapshot text,add column level_name_snapshot text;
update public.attendance_records r set participant_key=coalesce(r.member_id,r.caberawit_id),class_id_snapshot=m.class_id,level_id_snapshot=m.level_id,
 class_name_snapshot=c.name,level_name_snapshot=l.name from public.members m left join public.classes c on c.id=m.class_id left join public.levels l on l.id=m.level_id where r.member_id=m.id;
update public.attendance_records set participant_key=coalesce(member_id,caberawit_id) where participant_key is null;
alter table public.attendance_records alter column participant_key set not null;
do $$ declare r record;begin for r in select conname from pg_constraint where conrelid='public.attendance_records'::regclass and contype='c' loop execute format('alter table public.attendance_records drop constraint %I',r.conname);end loop;end $$;
alter table public.attendance_records add constraint attendance_identity check(not(member_id is not null and caberawit_id is not null) and (member_id is not null or caberawit_id is not null or member_name_snapshot is not null));
create unique index attendance_participant_unique on public.attendance_records(event_id,participant_key);
create table public.attendance_changes(id bigint generated always as identity primary key,record_id uuid not null references public.attendance_records(id) on delete cascade,
 actor_id uuid references public.app_users(id),old_status text,new_status text,old_notes text,new_notes text,revision integer not null,changed_at timestamptz not null default now());
alter table public.journals add column state text not null default 'DRAFT' check(state in ('DRAFT','COMPLETED','ARCHIVED')),
 add column revision integer not null default 0;
create table public.journal_revisions(id bigint generated always as identity primary key,journal_id uuid not null references public.journals(id) on delete cascade,
 actor_id uuid references public.app_users(id),snapshot jsonb not null,created_at timestamptz not null default now());
create table public.class_teachers(class_id uuid not null references public.classes(id),member_id uuid not null references public.members(id),primary key(class_id,member_id));
alter table public.member_memberships enable row level security;
alter table public.attendance_changes enable row level security;
alter table public.journal_revisions enable row level security;
alter table public.class_teachers enable row level security;
create policy memberships_read on public.member_memberships for select to anon,authenticated using(
 public.current_app_role()='ADMIN' or public.current_app_role()='DEWAN_GURU' and public.category_is_dewan_scope(category_id)
 or public.current_app_role()='KELOMPOK' and public.category_is_kelompok_read_scope(category_id));
create policy changes_read on public.attendance_changes for select to anon,authenticated using(exists(select 1 from public.attendance_records r where r.id=record_id and public.can_write_event(r.event_id)));
create policy journal_revision_read on public.journal_revisions for select to anon,authenticated using(public.can_write_journal_id(journal_id));
create policy class_teachers_read on public.class_teachers for select to anon,authenticated using(public.current_app_role() in ('ADMIN','DEWAN_GURU'));
create policy class_teachers_write on public.class_teachers for all to anon,authenticated using(public.current_app_role() in ('ADMIN','DEWAN_GURU')) with check(public.current_app_role() in ('ADMIN','DEWAN_GURU'));
grant select on public.member_memberships,public.attendance_changes,public.journal_revisions to anon,authenticated;
grant select,insert,delete on public.class_teachers to anon,authenticated;
-- Viewers use redacted projection RPC only; raw tables never expose private columns.
create or replace function public.can_read_audience(p_audience public.audience_type) returns boolean language sql stable security definer set search_path='' set row_security=off as $$
 select case public.current_app_role() when 'ADMIN' then true when 'DEWAN_GURU' then p_audience in ('CABERAWIT','MUDA_MUDI') when 'KELOMPOK' then p_audience in ('KELOMPOK','MUDA_MUDI','IBU_IBU','PENGURUS','CUSTOM') else false end $$;
drop policy members_read on public.members;
create policy members_read on public.members for select to anon,authenticated using(public.current_app_role()='ADMIN' or public.current_app_role()='DEWAN_GURU' and public.member_is_dewan_scope(id) or public.current_app_role()='KELOMPOK' and public.member_is_kelompok_read_scope(id));
drop policy member_categories_read on public.member_categories;
create policy member_categories_read on public.member_categories for select to anon,authenticated using(public.current_app_role()='ADMIN' or public.current_app_role()='DEWAN_GURU' and public.category_is_dewan_scope(category_id) or public.current_app_role()='KELOMPOK' and public.category_is_kelompok_read_scope(category_id));
drop policy agenda_read on public.agenda;drop policy agenda_write on public.agenda;
create policy agenda_read on public.agenda for select to anon,authenticated using(public.can_read_audience(audience));
create policy agenda_write on public.agenda for all to anon,authenticated using(public.can_write_audience(audience)) with check(public.can_write_audience(audience));
revoke insert,update,delete on public.attendance_events,public.attendance_records from anon,authenticated;
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
 insert into public.attendance_changes(record_id,actor_id,actor_name,old_status,new_status,old_notes,new_notes,revision) values(r.id,public.current_app_user_id(),(select coalesce(display_name,username) from public.app_users where id=public.current_app_user_id()),v_old.status::text,r.status::text,v_old.notes,r.notes,r.revision);
 return jsonb_build_object('record',to_jsonb(r));
end $$;
revoke all on function public.save_member(uuid,integer,jsonb,jsonb),public.ensure_attendance(jsonb),public.save_attendance_record(uuid,uuid,integer,text,text) from public;
grant execute on function public.save_member(uuid,integer,jsonb,jsonb),public.ensure_attendance(jsonb),public.save_attendance_record(uuid,uuid,integer,text,text) to anon,authenticated;
-- Narrow public projections: never return contact, address, birth data, offices, or Pengurus context.
create or replace function public.viewer_data(p_resource text) returns jsonb language plpgsql stable security definer set search_path='' set row_security=off as $$
declare v jsonb;begin
 case p_resource
 when 'members' then select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'status',m.status,'class_id',m.class_id,'level_id',m.level_id,'classes',jsonb_build_object('name',c.name),'levels',jsonb_build_object('name',l.name),
 'member_categories',(select coalesce(jsonb_agg(jsonb_build_object('category_id',cat.id,'categories',jsonb_build_object('id',cat.id,'name',cat.name,'slug',cat.slug))),'[]') from public.member_categories mc join public.categories cat on cat.id=mc.category_id where mc.member_id=m.id and cat.slug<>'pengurus'),
 'member_memberships',(select coalesce(jsonb_agg(jsonb_build_object('category_id',mm.category_id,'class_id',mm.class_id,'level_id',mm.level_id,'active',mm.active,'valid_from',mm.valid_from,'valid_to',mm.valid_to,'categories',jsonb_build_object('name',cat.name,'slug',cat.slug),'classes',jsonb_build_object('name',cl.name),'levels',jsonb_build_object('name',le.name))),'[]') from public.member_memberships mm join public.categories cat on cat.id=mm.category_id left join public.classes cl on cl.id=mm.class_id left join public.levels le on le.id=mm.level_id where mm.member_id=m.id and cat.slug<>'pengurus' and mm.active)) order by m.name),'[]') into v from public.members m left join public.classes c on c.id=m.class_id left join public.levels l on l.id=m.level_id where m.status='ACTIVE' and exists(select 1 from public.member_categories mc join public.categories cat on cat.id=mc.category_id where mc.member_id=m.id and cat.slug<>'pengurus');
 when 'classes' then select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'audience',c.audience,'level_id',c.level_id,'levels',jsonb_build_object('name',l.name)) order by c.name),'[]') into v from public.classes c left join public.levels l on l.id=c.level_id where c.active and c.audience<>'PENGURUS';
 when 'levels' then select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by sort_order),'[]') into v from public.levels where active;
 when 'categories' then select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'slug',slug)),'[]') into v from public.categories where slug<>'pengurus';
 when 'attendance' then select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'event_date',e.event_date,'event_time',e.event_time,'audience',e.audience,'class_id',e.class_id,'level_id',e.level_id,'agenda_id',e.agenda_id,'state',e.state,'classes',jsonb_build_object('name',c.name),'attendance_records',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'member_id',r.member_id,'participant_key',r.participant_key,'member_name_snapshot',r.member_name_snapshot,'status',r.status,'class_id_snapshot',r.class_id_snapshot,'class_name_snapshot',r.class_name_snapshot,'level_id_snapshot',r.level_id_snapshot,'level_name_snapshot',r.level_name_snapshot)),'[]') from public.attendance_records r where r.event_id=e.id)) order by e.event_date desc),'[]') into v from public.attendance_events e left join public.classes c on c.id=e.class_id where e.audience<>'PENGURUS';
 when 'agenda' then select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'starts_at',g.starts_at,'ends_at',g.ends_at,'audience',g.audience,'status',g.status,'presenter',g.presenter,'location',g.location,'class_id',g.class_id,'level_id',g.level_id,'attendance_enabled',g.attendance_enabled,'activity_type_id',g.activity_type_id,'activity_types',jsonb_build_object('name',a.name)) order by starts_at),'[]') into v from public.agenda g left join public.activity_types a on a.id=g.activity_type_id where g.audience<>'PENGURUS';
 when 'journals' then select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'event_id',j.event_id,'journal_date',j.journal_date,'journal_kind',j.journal_kind,'title',j.title,'material',j.material,'summary',j.summary,'achievement',j.achievement,'state',j.state,'class_id',j.class_id,'member_id',j.member_id,'classes',jsonb_build_object('name',c.name),'members',jsonb_build_object('name',m.name),'assessment',jsonb_build_object('materials',coalesce(j.assessment->'materials','[]'::jsonb))) order by journal_date desc),'[]') into v from public.journals j left join public.classes c on c.id=j.class_id left join public.members m on m.id=j.member_id where j.state='COMPLETED' and j.journal_kind<>'PENGURUS' and (j.event_id is null or exists(select 1 from public.attendance_events e where e.id=j.event_id and e.audience<>'PENGURUS' and e.state<>'CANCELLED')) and (j.activity_type_id is null or exists(select 1 from public.activity_types a where a.id=j.activity_type_id and a.audience<>'PENGURUS'));
 when 'targets' then select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'code',t.code,'target_month',t.target_month,'class_id',t.class_id,'level_id',t.level_id,'version_id',t.version_id,'target_value',t.target_value,'target_unit',t.target_unit,'levels',jsonb_build_object('name',l.name),'classes',jsonb_build_object('name',c.name))),'[]') into v from public.learning_targets t left join public.levels l on l.id=t.level_id left join public.classes c on c.id=t.class_id where t.active;
 when 'versions' then select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'version',version,'period_start',period_start,'period_end',period_end,'created_at',created_at) order by created_at desc),'[]') into v from public.target_versions;
 when 'progress' then select coalesce(jsonb_agg(jsonb_build_object('member_id',coalesce(p.member_id,p.participant_key),'participant_key',p.participant_key,'target_id',p.target_id,'progress_value',p.progress_value,'created_at',p.created_at,'journal_date',j.journal_date)),'[]') into v from public.journal_progress p join public.journals j on j.id=p.journal_id where j.state='COMPLETED' and j.journal_kind in ('CABERAWIT_INDIVIDUAL','MUDA_MUDI_INDIVIDUAL') and (j.event_id is null or exists(select 1 from public.attendance_events e join public.attendance_records r on r.event_id=e.id where e.id=j.event_id and e.state<>'CANCELLED' and r.participant_key=p.participant_key and r.status='H'));
 when 'activity-types' then select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'audience',audience)),'[]') into v from public.activity_types where active and audience<>'PENGURUS';
 when 'report-templates' then v:='[]'::jsonb;
 else raise exception 'Projection non disponible';end case;return v;
end $$;
revoke all on function public.viewer_data(text) from public;grant execute on function public.viewer_data(text) to anon,authenticated;
