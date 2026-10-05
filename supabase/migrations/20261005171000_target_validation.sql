create or replace function public.save_learning_target(p_target jsonb) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$ declare t public.learning_targets%rowtype;begin
 if public.current_app_role() is null or public.current_app_role() not in ('ADMIN','DEWAN_GURU') then raise exception 'Akses target ditolak';end if;
 t:=jsonb_populate_record(null::public.learning_targets,p_target);t.id:=gen_random_uuid();t.created_at:=now();t.updated_at:=now();t.active:=true;t.sort_order:=coalesce(t.sort_order,0);t.title:=trim(coalesce(t.title,''));
 if length(t.title)=0 or t.level_id is null or not exists(select 1 from public.levels where id=t.level_id and active) then raise exception 'Judul dan jenjang target wajib valid';end if;
 if t.class_id is not null and not exists(select 1 from public.classes where id=t.class_id and level_id=t.level_id and audience in ('CABERAWIT','MUDA_MUDI') and active) then raise exception 'Kelas target tidak sesuai jenjang';end if;
 if t.target_month is null then raise exception 'Bulan target wajib diisi';end if;t.target_month:=date_trunc('month',t.target_month)::date;
 if t.version_id is not null and not exists(select 1 from public.target_versions where id=t.version_id and (period_start is null or t.target_month>=date_trunc('month',period_start)::date) and (period_end is null or t.target_month<=date_trunc('month',period_end)::date)) then raise exception 'Versi atau periode tidak sesuai';end if;
 insert into public.learning_targets select t.*;return to_jsonb(t);
end $$;
revoke insert,update,delete on public.learning_targets,public.target_versions from anon,authenticated;
revoke all on function public.save_learning_target(jsonb) from public;grant execute on function public.save_learning_target(jsonb) to anon,authenticated;
