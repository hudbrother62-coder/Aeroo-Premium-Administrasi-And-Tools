-- KELOMPOK readers must not gain global access to Caberawit, and vice versa.
CREATE OR REPLACE FUNCTION public.can_read_member(p_member_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select
    public.has_app_permission('person.read')
    and (
      public.current_app_role()='ADMIN'::public.app_role
      or (public.can_read_audience_global('KELOMPOK'::public.audience_type)
       and not exists (
        select 1 from public.member_memberships child
        join public.categories cat on cat.id=child.category_id
        where child.member_id=p_member_id and cat.slug='caberawit'
          and child.valid_from<=(now() at time zone 'Asia/Jakarta')::date
          and (child.valid_to is null or child.valid_to>=(now() at time zone 'Asia/Jakarta')::date)
          and (child.ended_on is null or child.ended_on>(now() at time zone 'Asia/Jakarta')::date)
          and (child.active or child.ended_on is not null or child.valid_to is not null)
       )
      )
      or exists (
        select 1
        from public.member_memberships mm
        join public.categories c on c.id=mm.category_id
        where mm.member_id=p_member_id
          and mm.valid_from <= (now() at time zone 'Asia/Jakarta')::date
          and (mm.valid_to is null or mm.valid_to >= (now() at time zone 'Asia/Jakarta')::date)
          and (mm.ended_on is null or mm.ended_on > (now() at time zone 'Asia/Jakarta')::date)
          and case c.slug
            when 'caberawit' then public.can_read_caberawit_class(mm.class_id)
            when 'muda-mudi' then public.can_read_audience('MUDA_MUDI'::public.audience_type)
            when 'ibu-ibu' then public.can_read_audience('IBU_IBU'::public.audience_type)
            else false
          end
      )
      or (
        public.can_read_audience('PENGURUS'::public.audience_type)
        and exists (
          select 1
          from public.organizational_positions op
          where op.member_id=p_member_id
            and op.active
            and op.valid_from <= (now() at time zone 'Asia/Jakarta')::date
            and (op.valid_to is null or op.valid_to >= (now() at time zone 'Asia/Jakarta')::date)
        )
      )
    )
$function$;
