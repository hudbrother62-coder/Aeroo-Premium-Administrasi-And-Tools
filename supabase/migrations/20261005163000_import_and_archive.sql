create or replace function public.archive_member(p_id uuid,p_archive boolean) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$ declare m public.members%rowtype;begin
 if public.current_app_role() is distinct from 'ADMIN'::public.app_role then raise exception 'Hanya owner dapat mengelola arsip';end if;
 update public.members set status=case when p_archive then 'INACTIVE'::public.member_status else 'ACTIVE'::public.member_status end,updated_at=now(),revision=revision+1 where id=p_id returning * into m;if not found then raise exception 'Anggota tidak ditemukan';end if;return to_jsonb(m);end $$;
revoke all on function public.archive_member(uuid,boolean) from public;grant execute on function public.archive_member(uuid,boolean) to anon,authenticated;
revoke insert,update,delete on public.members,public.member_categories from anon,authenticated;
create unique index if not exists target_version_unique on public.target_versions(version);
create or replace function public.import_target_version(p_meta jsonb,p_targets jsonb) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare v public.target_versions%rowtype;t jsonb;lid uuid;cid uuid;begin
 if public.current_app_role() is null or public.current_app_role() not in ('ADMIN','DEWAN_GURU') then raise exception 'Akses target ditolak';end if;
 if p_targets is null or jsonb_typeof(p_targets)<>'array' or jsonb_array_length(p_targets)=0 or jsonb_array_length(p_targets)>3000 then raise exception 'Isi 1–3000 target';end if;
 if nullif(p_meta->>'period_end','')::date<nullif(p_meta->>'period_start','')::date then raise exception 'Periode tidak valid';end if;
 for t in select value from jsonb_array_elements(p_targets) loop
 lid:=(t->>'level_id')::uuid;cid:=nullif(t->>'class_id','')::uuid;
 if length(trim(coalesce(t->>'title','')))=0 or lid is null or not exists(select 1 from public.levels where id=lid and active) then raise exception 'Target atau jenjang tidak valid';end if;
 if cid is not null and not exists(select 1 from public.classes where id=cid and audience in ('CABERAWIT','MUDA_MUDI') and active and level_id=lid) then raise exception 'Kelas target tidak sesuai jenjang';end if;
 if nullif(t->>'target_month','') is null or (t->>'target_month')::date<>date_trunc('month',(t->>'target_month')::date)::date then raise exception 'Bulan target wajib valid';end if;
 if nullif(p_meta->>'period_start','') is not null and (t->>'target_month')::date<date_trunc('month',(p_meta->>'period_start')::date)::date or nullif(p_meta->>'period_end','') is not null and (t->>'target_month')::date>date_trunc('month',(p_meta->>'period_end')::date)::date then raise exception 'Bulan target di luar periode versi';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_targets) el group by el->>'level_id',el->>'class_id',el->>'target_month',lower(trim(el->>'title')) having count(*)>1) then raise exception 'Target duplikat pada kelas, jenjang, dan bulan yang sama';end if;
 perform pg_advisory_xact_lock(hashtextextended('aeroo-target-version',0));
 insert into public.target_versions(title,period_start,period_end,version,source_file_name,source_structure,analysis,published_at) values(coalesce(nullif(p_meta->>'title',''),'Target belajar'),nullif(p_meta->>'period_start','')::date,nullif(p_meta->>'period_end','')::date,(select coalesce(max(version),0)+1 from public.target_versions),p_meta->>'source_file_name',coalesce(p_meta->'source_structure','{}'),coalesce(p_meta->'analysis','{}'),now()) returning * into v;
 for t in select value from jsonb_array_elements(p_targets) loop
 insert into public.learning_targets(version_id,level_id,class_id,code,title,description,target_value,target_unit,target_month,sort_order,active,source_metadata) values(v.id,(t->>'level_id')::uuid,nullif(t->>'class_id','')::uuid,t->>'code',trim(t->>'title'),t->>'description',nullif(t->>'target_value','')::numeric,t->>'target_unit',(t->>'target_month')::date,coalesce((t->>'sort_order')::integer,0),true,coalesce(t->'source_metadata','{}'));
 end loop;return jsonb_build_object('version_id',v.id,'inserted',jsonb_array_length(p_targets),'analysis',v.analysis);
end $$;
revoke all on function public.import_target_version(jsonb,jsonb) from public;grant execute on function public.import_target_version(jsonb,jsonb) to anon,authenticated;
