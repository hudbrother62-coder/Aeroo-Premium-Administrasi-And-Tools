
create or replace function public.can_read_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
set row_security='off'
as $$
  select
    public.has_app_permission('person.read')
    and (
      public.current_app_role()='ADMIN'::public.app_role
      or public.can_read_audience('KELOMPOK'::public.audience_type)
      or exists (
        select 1
        from public.member_memberships mm
        join public.categories c on c.id=mm.category_id
        where mm.member_id=p_member_id
          and mm.valid_from <= (now() at time zone 'Asia/Jakarta')::date
          and (mm.valid_to is null or mm.valid_to >= (now() at time zone 'Asia/Jakarta')::date)
          and (mm.ended_on is null or mm.ended_on > (now() at time zone 'Asia/Jakarta')::date)
          and case c.slug
            when 'caberawit' then public.can_read_audience('CABERAWIT'::public.audience_type)
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
$$;

create or replace function public.can_write_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
set row_security='off'
as $$
  select
    public.has_app_permission('person.write')
    and (
      public.current_app_role()='ADMIN'::public.app_role
      or public.can_write_audience('KELOMPOK'::public.audience_type)
      or exists (
        select 1
        from public.member_memberships mm
        join public.categories c on c.id=mm.category_id
        where mm.member_id=p_member_id
          and mm.valid_from <= (now() at time zone 'Asia/Jakarta')::date
          and (mm.valid_to is null or mm.valid_to >= (now() at time zone 'Asia/Jakarta')::date)
          and (mm.ended_on is null or mm.ended_on > (now() at time zone 'Asia/Jakarta')::date)
          and case c.slug
            when 'caberawit' then public.can_write_audience('CABERAWIT'::public.audience_type)
            when 'muda-mudi' then public.can_write_audience('MUDA_MUDI'::public.audience_type)
            when 'ibu-ibu' then public.can_write_audience('IBU_IBU'::public.audience_type)
            else false
          end
      )
      or (
        public.can_write_audience('PENGURUS'::public.audience_type)
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
$$;

drop policy if exists members_read on public.members;
create policy members_read on public.members
for select to anon,authenticated
using (public.can_read_member(id));

drop policy if exists members_insert on public.members;
create policy members_insert on public.members
for insert to anon,authenticated
with check (
  public.has_app_permission('person.write')
  and (
    public.current_app_role()='ADMIN'::public.app_role
    or public.can_write_audience('KELOMPOK'::public.audience_type)
    or public.can_write_audience('CABERAWIT'::public.audience_type)
    or public.can_write_audience('MUDA_MUDI'::public.audience_type)
    or public.can_write_audience('IBU_IBU'::public.audience_type)
    or public.can_write_audience('PENGURUS'::public.audience_type)
  )
);

drop policy if exists members_update on public.members;
create policy members_update on public.members
for update to anon,authenticated
using (public.can_write_member(id))
with check (public.can_write_member(id));

drop policy if exists members_delete on public.members;
create policy members_delete on public.members
for delete to anon,authenticated
using (public.current_app_role()='ADMIN'::public.app_role);

create or replace function public.save_member(
  p_id uuid,
  p_revision integer,
  p_person jsonb,
  p_memberships jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security='off'
as $$
declare
  v_id uuid:=coalesce(p_id,gen_random_uuid());
  v_old public.members%rowtype;
  x jsonb;
  v_cat public.categories%rowtype;
  k public.classes%rowtype;
  v_category uuid;
  v_keep uuid[]:='{}';
  v_mm public.member_memberships%rowtype;
  v_mid uuid;
  v_effective date;
  v_audience public.audience_type;
begin
  if not public.has_app_permission('person.write') then
    raise exception 'Akses input ditolak';
  end if;
  if p_revision is null or p_revision<0 then
    raise exception 'Versi data wajib valid';
  end if;
  if p_memberships is null or jsonb_typeof(p_memberships)<>'array' then
    raise exception 'Keikutsertaan harus berupa daftar';
  end if;
  if p_id is null
     and jsonb_array_length(p_memberships)=0
     and not (
       public.can_write_audience('KELOMPOK'::public.audience_type)
       or public.can_write_audience('PENGURUS'::public.audience_type)
     ) then
    raise exception 'Pilih minimal satu program';
  end if;
  if length(trim(coalesce(p_person->>'name','')))=0 then
    raise exception 'Nama wajib diisi';
  end if;

  if exists(
    select 1
    from jsonb_array_elements(p_memberships) el
    group by el->>'category_id'
    having count(*)>1
  ) then
    raise exception 'Program yang sama digandakan';
  end if;

  if p_id is not null then
    select * into v_old from public.members where id=p_id for update;
    if not found or not public.can_write_member(p_id) then
      raise exception 'Anggota di luar akses';
    end if;
    if v_old.revision is distinct from p_revision then
      raise exception 'CONFLICT: Data telah diubah petugas lain';
    end if;
  end if;

  for x in select value from jsonb_array_elements(p_memberships) loop
    select * into v_cat
    from public.categories
    where id=nullif(x->>'category_id','')::uuid;

    if not found or v_cat.slug not in ('caberawit','muda-mudi','ibu-ibu') then
      raise exception 'Keikutsertaan hanya boleh Caberawit, Muda-Mudi, atau Ibu-Ibu';
    end if;

    v_audience:=case v_cat.slug
      when 'caberawit' then 'CABERAWIT'::public.audience_type
      when 'muda-mudi' then 'MUDA_MUDI'::public.audience_type
      else 'IBU_IBU'::public.audience_type
    end;

    if not public.can_write_audience(v_audience) then
      raise exception 'Program di luar akses';
    end if;

    if nullif(x->>'office','') is not null
       or nullif(x->>'section','') is not null
       or nullif(x->>'duties','') is not null then
      raise exception 'Jabatan Pengurus dikelola melalui Struktur & Pengurus';
    end if;

    if nullif(x->>'class_id','') is not null then
      select * into k from public.classes
      where id=(x->>'class_id')::uuid and active;
      if not found
         or k.audience<>v_audience
         or v_audience not in ('CABERAWIT','MUDA_MUDI') then
        raise exception 'Kelas tidak sesuai program';
      end if;
      if k.level_id is not null
         and k.level_id is distinct from nullif(x->>'level_id','')::uuid then
        raise exception 'Jenjang tidak sesuai kelas';
      end if;
    end if;

    if v_audience='IBU_IBU'
       and (nullif(x->>'class_id','') is not null or nullif(x->>'level_id','') is not null) then
      raise exception 'Ibu-Ibu tidak memakai jenjang belajar';
    end if;

    if nullif(x->>'level_id','') is not null
       and not exists(select 1 from public.levels where id=(x->>'level_id')::uuid and active) then
      raise exception 'Jenjang tidak aktif';
    end if;
  end loop;

  insert into public.members(
    id,name,gender,birth_place,birth_date,phone,address,notes,guardian_name,guardian_phone
  )
  values(
    v_id,
    trim(p_person->>'name'),
    nullif(p_person->>'gender',''),
    nullif(p_person->>'birth_place',''),
    nullif(p_person->>'birth_date','')::date,
    nullif(p_person->>'phone',''),
    nullif(p_person->>'address',''),
    nullif(p_person->>'notes',''),
    nullif(p_person->>'guardian_name',''),
    nullif(p_person->>'guardian_phone','')
  )
  on conflict(id) do update set
    name=excluded.name,
    gender=excluded.gender,
    birth_place=excluded.birth_place,
    birth_date=excluded.birth_date,
    phone=excluded.phone,
    address=excluded.address,
    notes=excluded.notes,
    guardian_name=excluded.guardian_name,
    guardian_phone=excluded.guardian_phone,
    updated_at=now(),
    revision=public.members.revision+1;

  for x in select value from jsonb_array_elements(p_memberships) loop
    v_category:=(x->>'category_id')::uuid;

    select * into v_mm
    from public.member_memberships
    where id=nullif(x->>'id','')::uuid
      and member_id=v_id
      and category_id=v_category
      and active;

    if found
       and v_mm.class_id is not distinct from nullif(x->>'class_id','')::uuid
       and v_mm.level_id is not distinct from nullif(x->>'level_id','')::uuid
       and v_mm.valid_to is not distinct from nullif(x->>'valid_to','')::date
       and v_mm.valid_from=coalesce(nullif(x->>'valid_from','')::date,v_mm.valid_from)
       and v_mm.active=coalesce((x->>'active')::boolean,true) then
      v_mid:=v_mm.id;
    else
      v_effective:=case
        when v_mm.id is not null
          and coalesce(nullif(x->>'valid_from','')::date,v_mm.valid_from)=v_mm.valid_from
          then (now() at time zone 'Asia/Jakarta')::date
        else coalesce(nullif(x->>'valid_from','')::date,(now() at time zone 'Asia/Jakarta')::date)
      end;

      if v_mm.id is not null then
        update public.member_memberships
        set active=false,
            ended_on=v_effective,
            valid_to=greatest(valid_from,v_effective-1)
        where id=v_mm.id;
      end if;

      insert into public.member_memberships(
        member_id,category_id,level_id,class_id,office,section,duties,
        valid_from,valid_to,active
      )
      values(
        v_id,
        v_category,
        nullif(x->>'level_id','')::uuid,
        nullif(x->>'class_id','')::uuid,
        null,null,null,
        v_effective,
        nullif(x->>'valid_to','')::date,
        coalesce((x->>'active')::boolean,true)
      )
      returning id into v_mid;
    end if;

    v_keep:=array_append(v_keep,v_mid);
  end loop;

  update public.member_memberships mm
  set active=false,
      ended_on=(now() at time zone 'Asia/Jakarta')::date,
      valid_to=greatest(valid_from,(now() at time zone 'Asia/Jakarta')::date-1)
  where mm.member_id=v_id
    and mm.active
    and not(mm.id=any(v_keep))
    and exists(
      select 1
      from public.categories c
      where c.id=mm.category_id
        and case c.slug
          when 'caberawit' then public.can_write_audience('CABERAWIT'::public.audience_type)
          when 'muda-mudi' then public.can_write_audience('MUDA_MUDI'::public.audience_type)
          when 'ibu-ibu' then public.can_write_audience('IBU_IBU'::public.audience_type)
          else false
        end
    );

  delete from public.member_categories where member_id=v_id;
  insert into public.member_categories(member_id,category_id)
  select distinct v_id,mm.category_id
  from public.member_memberships mm
  join public.categories c on c.id=mm.category_id
  where mm.member_id=v_id
    and c.slug in ('caberawit','muda-mudi','ibu-ibu')
    and mm.valid_from<=(now() at time zone 'Asia/Jakarta')::date
    and (mm.valid_to is null or mm.valid_to>=(now() at time zone 'Asia/Jakarta')::date)
    and (mm.ended_on is null or mm.ended_on>(now() at time zone 'Asia/Jakarta')::date)
    and (mm.active or mm.ended_on is not null or mm.valid_to is not null)
  on conflict do nothing;

  update public.members
  set
    class_id=(
      select mm.class_id
      from public.member_memberships mm
      join public.categories c on c.id=mm.category_id
      where mm.member_id=v_id
        and c.slug in ('caberawit','muda-mudi')
        and mm.valid_from<=(now() at time zone 'Asia/Jakarta')::date
        and (mm.valid_to is null or mm.valid_to>=(now() at time zone 'Asia/Jakarta')::date)
        and (mm.ended_on is null or mm.ended_on>(now() at time zone 'Asia/Jakarta')::date)
      order by case c.slug when 'caberawit' then 0 else 1 end,mm.valid_from desc
      limit 1
    ),
    level_id=(
      select mm.level_id
      from public.member_memberships mm
      join public.categories c on c.id=mm.category_id
      where mm.member_id=v_id
        and c.slug in ('caberawit','muda-mudi')
        and mm.valid_from<=(now() at time zone 'Asia/Jakarta')::date
        and (mm.valid_to is null or mm.valid_to>=(now() at time zone 'Asia/Jakarta')::date)
        and (mm.ended_on is null or mm.ended_on>(now() at time zone 'Asia/Jakarta')::date)
      order by case c.slug when 'caberawit' then 0 else 1 end,mm.valid_from desc
      limit 1
    ),
    section=null
  where id=v_id;

  return (select to_jsonb(m) from public.members m where id=v_id);
end
$$;

do $$
begin
  if exists(
    select 1
    from public.member_memberships mm
    join public.categories c on c.id=mm.category_id
    where c.slug in ('kelompok','pengurus')
  ) then
    raise exception 'Kategori legacy masih memiliki membership; migrasi dibatalkan';
  end if;
  delete from public.categories where slug in ('kelompok','pengurus');
end $$;

