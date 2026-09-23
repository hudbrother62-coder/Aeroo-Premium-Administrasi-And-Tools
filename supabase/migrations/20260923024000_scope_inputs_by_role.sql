-- Align write/read scope with AEROO team roles.
-- Applied to Supabase project hzbsdzlhjmfgtexmhccv.

create or replace function public.can_write_audience(p_audience public.audience_type)
returns boolean
language sql stable security definer
set search_path=public
set row_security=off
as $$
  select case public.current_app_role()
    when 'ADMIN'::public.app_role then true
    when 'DEWAN_GURU'::public.app_role then p_audience in ('CABERAWIT','MUDA_MUDI')
    when 'KELOMPOK'::public.app_role then p_audience in ('KELOMPOK','IBU_IBU','PENGURUS')
    else false
  end
$$;

create or replace function public.category_is_kelompok_write_scope(p_category_id uuid)
returns boolean language sql stable security definer
set search_path=public set row_security=off
as $$
  select exists(select 1 from public.categories c
    where c.id=p_category_id and c.slug in ('kelompok','ibu-ibu','pengurus'))
$$;

create or replace function public.category_is_kelompok_read_scope(p_category_id uuid)
returns boolean language sql stable security definer
set search_path=public set row_security=off
as $$
  select exists(select 1 from public.categories c
    where c.id=p_category_id and c.slug in ('kelompok','muda-mudi','ibu-ibu','pengurus'))
$$;

create or replace function public.member_is_kelompok_read_scope(p_member_id uuid)
returns boolean language sql stable security definer
set search_path=public set row_security=off
as $$
  select exists(
    select 1 from public.member_categories mc
    join public.categories c on c.id=mc.category_id
    where mc.member_id=p_member_id
      and c.slug in ('kelompok','muda-mudi','ibu-ibu','pengurus')
  )
$$;

grant execute on function public.can_write_audience(public.audience_type) to anon,authenticated;
grant execute on function public.category_is_kelompok_write_scope(uuid) to anon,authenticated;
grant execute on function public.category_is_kelompok_read_scope(uuid) to anon,authenticated;
grant execute on function public.member_is_kelompok_read_scope(uuid) to anon,authenticated;

drop policy if exists member_categories_insert on public.member_categories;
create policy member_categories_insert on public.member_categories
for insert with check (
  current_app_role()='ADMIN'::public.app_role
  or (current_app_role()='DEWAN_GURU'::public.app_role and category_is_dewan_scope(category_id))
  or (current_app_role()='KELOMPOK'::public.app_role and category_is_kelompok_write_scope(category_id))
);

drop policy if exists member_categories_delete on public.member_categories;
create policy member_categories_delete on public.member_categories
for delete using (
  current_app_role()='ADMIN'::public.app_role
  or (current_app_role()='DEWAN_GURU'::public.app_role and category_is_dewan_scope(category_id))
  or (current_app_role()='KELOMPOK'::public.app_role and category_is_kelompok_write_scope(category_id))
);

drop policy if exists member_categories_read on public.member_categories;
create policy member_categories_read on public.member_categories
for select using (
  current_app_role() in ('ADMIN'::public.app_role,'VIEWER'::public.app_role)
  or (current_app_role()='DEWAN_GURU'::public.app_role and category_is_dewan_scope(category_id))
  or (current_app_role()='KELOMPOK'::public.app_role and category_is_kelompok_read_scope(category_id))
);

drop policy if exists members_read on public.members;
create policy members_read on public.members
for select using (
  current_app_role() in ('ADMIN'::public.app_role,'VIEWER'::public.app_role)
  or (current_app_role()='DEWAN_GURU'::public.app_role and member_is_dewan_scope(id))
  or (current_app_role()='KELOMPOK'::public.app_role and member_is_kelompok_read_scope(id))
);

drop policy if exists members_update on public.members;
create policy members_update on public.members
for update using (
  current_app_role()='ADMIN'::public.app_role
  or (current_app_role()='DEWAN_GURU'::public.app_role and member_is_dewan_scope(id))
  or (current_app_role()='KELOMPOK'::public.app_role and member_is_kelompok_read_scope(id))
)
with check (
  current_app_role()='ADMIN'::public.app_role
  or (current_app_role()='DEWAN_GURU'::public.app_role and member_is_dewan_scope(id))
  or (current_app_role()='KELOMPOK'::public.app_role and member_is_kelompok_read_scope(id))
);

drop policy if exists members_delete on public.members;
create policy members_delete on public.members
for delete using (
  current_app_role()='ADMIN'::public.app_role
  or (current_app_role()='DEWAN_GURU'::public.app_role and (member_is_dewan_scope(id) or member_has_no_categories(id)))
  or (current_app_role()='KELOMPOK'::public.app_role and (member_is_kelompok_read_scope(id) or member_has_no_categories(id)))
);

drop policy if exists classes_write on public.classes;
create policy classes_write on public.classes
for all using (
  current_app_role()='ADMIN'::public.app_role
  or (current_app_role()='DEWAN_GURU'::public.app_role and audience in ('CABERAWIT','MUDA_MUDI'))
)
with check (
  current_app_role()='ADMIN'::public.app_role
  or (current_app_role()='DEWAN_GURU'::public.app_role and audience in ('CABERAWIT','MUDA_MUDI'))
);
