create or replace function public.mirror_position_membership()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
   if new.member_id<>old.member_id or new.valid_from<>old.valid_from then raise exception 'Akhiri masa jabatan lama lalu buat jabatan baru untuk menjaga riwayat.'; end if;
   insert into public.position_revisions(position_id,actor_id,snapshot) values(old.id,public.current_app_user_id(),to_jsonb(old));
 end if;
 return new;
end $$;
