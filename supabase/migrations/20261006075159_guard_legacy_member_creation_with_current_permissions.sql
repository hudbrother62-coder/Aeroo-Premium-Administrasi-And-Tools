create or replace function public.create_muda_mudi_member(p_data jsonb)
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare v_category uuid; v_member jsonb;
begin
 if not public.has_app_permission('person.write') or not public.can_write_audience('MUDA_MUDI'::public.audience_type) then raise exception 'Akses input ditolak'; end if;
 select id into v_category from public.categories where slug='muda-mudi';
 if v_category is null then raise exception 'Program Muda-Mudi tidak tersedia'; end if;
 v_member:=public.save_member(null,0,p_data,jsonb_build_array(jsonb_build_object('category_id',v_category,'class_id',nullif(p_data->>'class_id',''),'level_id',nullif(p_data->>'level_id',''),'valid_from',(now() at time zone 'Asia/Jakarta')::date)));
 return (v_member->>'id')::uuid;
end $$;
revoke all on function public.create_muda_mudi_member(jsonb) from public;
grant execute on function public.create_muda_mudi_member(jsonb) to anon,authenticated;
