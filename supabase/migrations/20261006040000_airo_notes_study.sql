-- Additive v3 domains. No production records are reset.
create table public.personal_notes (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references public.app_users(id),
 title text not null default 'Tanpa judul' check(length(title)<=200),
 content text not null default '' check(length(content)<=100000),
 is_pinned boolean not null default false,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','ARCHIVED','DELETED')),
 revision integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 archived_at timestamptz, deleted_at timestamptz
);
alter table public.personal_notes enable row level security;
create index personal_notes_owner_status on public.personal_notes(owner_user_id,status,updated_at desc);
revoke all on public.personal_notes from anon,authenticated;
grant select on public.personal_notes to anon,authenticated;
create policy personal_notes_owner_read on public.personal_notes for select to anon,authenticated
 using(owner_user_id=(select public.current_app_user_id()));
create or replace function public.save_personal_note(p_id uuid,p_revision integer,p_body jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n public.personal_notes%rowtype;uid uuid:=public.current_app_user_id();s text;begin
 if uid is null then raise exception 'Login diperlukan';end if;
 if p_revision is null or p_revision<0 then raise exception 'Revisi tidak valid';end if;
 s:=coalesce(p_body->>'status','ACTIVE');
 if s not in ('ACTIVE','ARCHIVED','DELETED') or length(coalesce(p_body->>'title',''))>200 or length(coalesce(p_body->>'content',''))>100000 then raise exception 'Catatan tidak valid';end if;
 if p_id is null then
 insert into public.personal_notes(owner_user_id,title,content,is_pinned,status,archived_at,deleted_at)
 values(uid,coalesce(nullif(trim(p_body->>'title'),''),'Tanpa judul'),coalesce(p_body->>'content',''),coalesce((p_body->>'is_pinned')::boolean,false),s,case when s='ARCHIVED' then now() end,case when s='DELETED' then now() end) returning * into n;
 else
 select * into n from public.personal_notes where id=p_id and owner_user_id=uid for update;
 if not found then raise exception 'Catatan tidak ditemukan';end if;
 if n.revision<>p_revision then raise exception 'CONFLICT: Catatan sudah diubah';end if;
 update public.personal_notes set title=coalesce(nullif(trim(p_body->>'title'),''),'Tanpa judul'),content=coalesce(p_body->>'content',''),is_pinned=coalesce((p_body->>'is_pinned')::boolean,false),status=s,revision=revision+1,updated_at=now(),archived_at=case when s='ARCHIVED' then coalesce(archived_at,now()) end,deleted_at=case when s='DELETED' then coalesce(deleted_at,now()) end where id=p_id and owner_user_id=uid returning * into n;
 end if;
 return to_jsonb(n);
end $$;
revoke all on function public.save_personal_note(uuid,integer,jsonb) from public;
grant execute on function public.save_personal_note(uuid,integer,jsonb) to anon,authenticated;

alter table public.journals drop constraint journals_kind_check;
alter table public.journals add constraint journals_kind_check check(journal_kind in ('KELOMPOK','PENGKAJIAN','IBU_IBU','PENGURUS','CABERAWIT_CLASS','CABERAWIT_INDIVIDUAL','MUDA_MUDI_CLASS','MUDA_MUDI_INDIVIDUAL'));
create or replace function public.journal_audience(p_kind text) returns public.audience_type language sql immutable set search_path='' as $$ select case when p_kind like 'CABERAWIT_%' then 'CABERAWIT'::public.audience_type when p_kind like 'MUDA_MUDI_%' then 'MUDA_MUDI'::public.audience_type when p_kind in ('KELOMPOK','PENGKAJIAN') then 'KELOMPOK'::public.audience_type when p_kind='IBU_IBU' then 'IBU_IBU'::public.audience_type when p_kind='PENGURUS' then 'PENGURUS'::public.audience_type else null end $$;
create or replace function public.save_journal(p_id uuid,p_revision integer,p_body jsonb,p_progress jsonb) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare j public.journals%rowtype;old_j public.journals%rowtype;e public.attendance_events%rowtype;g public.agenda%rowtype;a public.audience_type;x jsonb;v_member uuid;v_target uuid;v_name text;begin
 if p_revision is null or p_revision<0 then raise exception 'Versi jurnal wajib valid';end if;
 a:=public.journal_audience(p_body->>'journal_kind');
 if a is null or not coalesce(public.can_write_audience(a),false) then raise exception 'Jenis jurnal di luar akses';end if;
 if p_body->>'journal_kind' not in ('KELOMPOK','PENGKAJIAN','IBU_IBU','PENGURUS','CABERAWIT_CLASS','CABERAWIT_INDIVIDUAL','MUDA_MUDI_CLASS','MUDA_MUDI_INDIVIDUAL') then raise exception 'Jenis jurnal tidak valid';end if;
 if p_id is not null then select * into old_j from public.journals where id=p_id for update;if not found or not public.can_write_journal_id(p_id) then raise exception 'Jurnal di luar akses';end if;if old_j.revision is distinct from p_revision then raise exception 'CONFLICT: Jurnal sudah diubah petugas lain';end if;end if;
 j:=jsonb_populate_record(null::public.journals,case when p_id is null then p_body else to_jsonb(old_j)||p_body end);
 j.id:=coalesce(p_id,gen_random_uuid());j.journal_kind:=p_body->>'journal_kind';j.state:=coalesce(j.state,'DRAFT');j.assessment:=coalesce(j.assessment,'{}');j.revision:=coalesce(old_j.revision,-1)+1;j.created_at:=coalesce(old_j.created_at,now());j.updated_at:=now();
 if j.state not in ('DRAFT','COMPLETED','ARCHIVED') or j.journal_date is null or length(trim(coalesce(j.title,'')))=0 then raise exception 'Judul, tanggal, dan status jurnal wajib valid';end if;
 if j.ended_at is not null and j.started_at is not null and j.ended_at<=j.started_at then raise exception 'Jam selesai harus setelah mulai';end if;
 if j.journal_kind='PENGKAJIAN' then
 if j.started_at is null or j.ended_at is null then raise exception 'Waktu pengkajian wajib diisi';end if;
 if nullif(trim(j.assessment->>'presenter'),'') is null or nullif(trim(j.assessment->>'implementation'),'') is null then raise exception 'Pemateri dan pelaksanaan wajib diisi';end if;
 if jsonb_typeof(j.assessment->'materials') is distinct from 'array' or jsonb_array_length(j.assessment->'materials')=0 then raise exception 'Materi pengkajian wajib diisi';end if;
 for x in select value from jsonb_array_elements(j.assessment->'materials') loop
 if nullif(trim(x->>'topic'),'') is null or coalesce(x->>'status','') not in ('BELUM','SEBAGIAN','TUNTAS') then raise exception 'Materi pengkajian tidak valid';end if;
 end loop;
 end if;
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
