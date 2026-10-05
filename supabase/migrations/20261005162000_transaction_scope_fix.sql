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
create or replace function public.save_journal(p_id uuid,p_revision integer,p_body jsonb,p_progress jsonb) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare j public.journals%rowtype;old_j public.journals%rowtype;e public.attendance_events%rowtype;a public.audience_type;x jsonb;v_member uuid;v_target uuid;v_name text;begin
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
