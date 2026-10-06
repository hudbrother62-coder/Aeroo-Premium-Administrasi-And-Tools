drop policy if exists memberships_read on public.member_memberships;
create policy memberships_read on public.member_memberships for select to anon,authenticated using (
 public.can_read_member(member_id) and exists(select 1 from public.categories c where c.id=category_id and public.can_read_audience(case c.slug when 'caberawit' then 'CABERAWIT'::public.audience_type when 'muda-mudi' then 'MUDA_MUDI'::public.audience_type when 'ibu-ibu' then 'IBU_IBU'::public.audience_type when 'pengurus' then 'PENGURUS'::public.audience_type else 'KELOMPOK'::public.audience_type end))
);
drop policy if exists member_categories_read on public.member_categories;
create policy member_categories_read on public.member_categories for select to anon,authenticated using (
 public.can_read_member(member_id) and exists(select 1 from public.categories c where c.id=category_id and public.can_read_audience(case c.slug when 'caberawit' then 'CABERAWIT'::public.audience_type when 'muda-mudi' then 'MUDA_MUDI'::public.audience_type when 'ibu-ibu' then 'IBU_IBU'::public.audience_type when 'pengurus' then 'PENGURUS'::public.audience_type else 'KELOMPOK'::public.audience_type end))
);
revoke insert,update,delete on public.member_categories from anon,authenticated;
revoke insert,update,delete on public.member_memberships from anon,authenticated;
