-- Compatibility adapter: Pengurus positions remain authoritative for new edits;
-- legacy membership mirrors let existing attendance snapshots keep working.
create or replace function public.mirror_position_membership() returns trigger language plpgsql security definer set search_path='' as $$
declare cat uuid;begin
 select id into cat from public.categories where slug='pengurus';
 if cat is null then raise exception 'Kategori kompatibilitas Pengurus tidak tersedia';end if;
 if new.legacy_membership_id is null then
 insert into public.member_memberships(member_id,category_id,office,section,duties,valid_from,valid_to,active)
 values(new.member_id,cat,new.title,new.section,new.duties,new.valid_from,new.valid_to,new.active) returning id into new.legacy_membership_id;
 else
 update public.member_memberships set member_id=new.member_id,office=new.title,section=new.section,duties=new.duties,valid_from=new.valid_from,valid_to=new.valid_to,active=new.active,ended_on=case when new.active then null else coalesce(new.valid_to+1,(now() at time zone 'Asia/Jakarta')::date) end where id=new.legacy_membership_id;
 end if;
 if new.active and new.valid_from<=(now() at time zone 'Asia/Jakarta')::date and (new.valid_to is null or new.valid_to>=(now() at time zone 'Asia/Jakarta')::date) then
 insert into public.member_categories(member_id,category_id) values(new.member_id,cat) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.mirror_position_membership() from public,anon,authenticated;
create trigger mirror_position_membership before insert or update on public.organizational_positions for each row execute function public.mirror_position_membership();
