alter table public.journal_progress add column participant_key uuid;
update public.journal_progress set participant_key=member_id;
alter table public.attendance_changes add column actor_name text;
alter table public.journal_revisions add column actor_name text;
alter table public.class_teachers drop constraint class_teachers_member_id_fkey;
alter table public.class_teachers add constraint class_teachers_member_id_fkey foreign key(member_id) references public.members(id) on delete cascade;
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
 if j.event_id is not null then select * into e from public.attendance_events where id=j.event_id;if not found or e.audience<>a or not public.can_write_event(e.id) or (e.state='CANCELLED' and j.state<>'ARCHIVED') then raise exception 'Pertemuan tidak sesuai jurnal';end if;if e.event_date<>j.journal_date or (e.class_id is not null and e.class_id is distinct from j.class_id) then raise exception 'Tanggal atau kelas jurnal tidak sesuai pertemuan';end if;end if;
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
 update public.journals set journal_date=j.journal_date,journal_kind=j.journal_kind,event_id=j.event_id,activity_type_id=j.activity_type_id,title=j.title,material=j.material,person_in_charge=j.person_in_charge,summary=j.summary,result=j.result,obstacles=j.obstacles,follow_up=j.follow_up,notes=j.notes,class_id=j.class_id,member_id=j.member_id,started_at=j.started_at,ended_at=j.ended_at,achievement=j.achievement,improvement_plan=j.improvement_plan,decisions=j.decisions,assessment=coalesce(j.assessment,'{}'),state=j.state,revision=j.revision,updated_at=now() where id=j.id;
 delete from public.journal_progress where journal_id=j.id;
 else insert into public.journals select j.*;end if;
 for x in select value from jsonb_array_elements(coalesce(p_progress,'[]')) loop
 select member_name_snapshot into v_name from public.attendance_records where event_id=j.event_id and member_id=(x->>'member_id')::uuid;
 insert into public.journal_progress(journal_id,member_id,participant_key,member_name_snapshot,target_id,progress_value,progress_note,assessment,follow_up) values(j.id,(x->>'member_id')::uuid,(x->>'member_id')::uuid,v_name,nullif(x->>'target_id','')::uuid,nullif(x->>'progress_value','')::numeric,coalesce(x->>'progress_note',''),coalesce(x->'assessment','{}'),nullif(x->>'follow_up',''));
 end loop;
 return to_jsonb(j);
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

drop policy journal_progress_read on public.journal_progress;
create policy journal_progress_read on public.journal_progress for select to anon,authenticated using(exists(select 1 from public.journals j where j.id=journal_id and public.can_read_audience(public.journal_audience(j.journal_kind))));
