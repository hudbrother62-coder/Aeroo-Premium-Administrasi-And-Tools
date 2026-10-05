create or replace function public.save_member(p_id uuid,p_revision integer,p_person jsonb,p_memberships jsonb) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare v_id uuid:=coalesce(p_id,gen_random_uuid());v_role public.app_role:=public.current_app_role();v_old public.members%rowtype;x jsonb;v_cat public.categories%rowtype;k public.classes%rowtype;v_category uuid;v_keep uuid[]:='{}';v_mm public.member_memberships%rowtype;v_mid uuid;begin
 if p_revision is null or p_revision<0 then raise exception 'Versi data wajib valid';end if;
 if v_role is null or v_role='VIEWER' then raise exception 'Akses input ditolak';end if;
 if p_memberships is null or jsonb_typeof(p_memberships)<>'array' or jsonb_array_length(p_memberships)=0 then raise exception 'Pilih kategori keikutsertaan';end if;
 if exists(select 1 from jsonb_array_elements(p_memberships) el join public.categories c on c.id=(el->>'category_id')::uuid where c.slug<>'pengurus' group by c.id having count(*)>1) then raise exception 'Kategori yang sama digandakan';end if;
 if length(trim(coalesce(p_person->>'name','')))=0 then raise exception 'Nama wajib diisi';end if;
 if p_id is not null then select * into v_old from public.members where id=p_id for update;
 if not found or not(v_role='ADMIN' or v_role='DEWAN_GURU' and public.member_is_dewan_scope(p_id) or v_role='KELOMPOK' and public.member_is_kelompok_read_scope(p_id)) then raise exception 'Anggota di luar akses';end if;
 if v_old.revision is distinct from p_revision then raise exception 'CONFLICT: Data telah diubah petugas lain';end if;end if;
 for x in select value from jsonb_array_elements(p_memberships) loop
 select * into v_cat from public.categories where id=(x->>'category_id')::uuid;
 if not found or not public.can_write_audience(case v_cat.slug when 'kelompok' then 'KELOMPOK'::public.audience_type when 'caberawit' then 'CABERAWIT'::public.audience_type when 'muda-mudi' then 'MUDA_MUDI'::public.audience_type when 'ibu-ibu' then 'IBU_IBU'::public.audience_type when 'pengurus' then 'PENGURUS'::public.audience_type else 'CUSTOM'::public.audience_type end) then raise exception 'Kategori di luar akses';end if;
 if nullif(x->>'class_id','') is not null then select * into k from public.classes where id=(x->>'class_id')::uuid and active;
 if not found or k.audience::text<>(case v_cat.slug when 'caberawit' then 'CABERAWIT' when 'muda-mudi' then 'MUDA_MUDI' else 'INVALID' end) then raise exception 'Kelas tidak sesuai kategori';end if;
 if k.level_id is not null and k.level_id is distinct from nullif(x->>'level_id','')::uuid then raise exception 'Jenjang tidak sesuai kelas';end if;end if;
 if v_cat.slug not in ('caberawit','muda-mudi') and (nullif(x->>'class_id','') is not null or nullif(x->>'level_id','') is not null) then raise exception 'Kategori ini tidak memakai jenjang belajar';end if;
 if nullif(x->>'level_id','') is not null and not exists(select 1 from public.levels where id=(x->>'level_id')::uuid and active) then raise exception 'Jenjang tidak aktif';end if;
 if v_cat.slug<>'pengurus' and (nullif(x->>'office','') is not null or nullif(x->>'duties','') is not null) then raise exception 'Jabatan hanya untuk Pengurus';end if;
 end loop;
 insert into public.members(id,name,gender,birth_place,birth_date,phone,address,notes,guardian_name,guardian_phone) values(v_id,trim(p_person->>'name'),nullif(p_person->>'gender',''),nullif(p_person->>'birth_place',''),nullif(p_person->>'birth_date','')::date,nullif(p_person->>'phone',''),nullif(p_person->>'address',''),nullif(p_person->>'notes',''),nullif(p_person->>'guardian_name',''),nullif(p_person->>'guardian_phone',''))
 on conflict(id) do update set name=excluded.name,gender=excluded.gender,birth_place=excluded.birth_place,birth_date=excluded.birth_date,phone=excluded.phone,address=excluded.address,notes=excluded.notes,guardian_name=excluded.guardian_name,guardian_phone=excluded.guardian_phone,updated_at=now(),revision=public.members.revision+1;
 delete from public.member_categories mc where member_id=v_id and exists(select 1 from public.categories c where c.id=mc.category_id and (v_role='ADMIN' or v_role='DEWAN_GURU' and c.slug in ('caberawit','muda-mudi') or v_role='KELOMPOK' and c.slug in ('kelompok','ibu-ibu','pengurus')));
 for x in select value from jsonb_array_elements(p_memberships) loop
 v_category:=(x->>'category_id')::uuid;
 select * into v_mm from public.member_memberships where id=nullif(x->>'id','')::uuid and member_id=v_id and category_id=v_category and active;
 if found and v_mm.class_id is not distinct from nullif(x->>'class_id','')::uuid and v_mm.level_id is not distinct from nullif(x->>'level_id','')::uuid and coalesce(v_mm.office,'')=coalesce(x->>'office','') and coalesce(v_mm.section,'')=coalesce(x->>'section','') and coalesce(v_mm.duties,'')=coalesce(x->>'duties','') and v_mm.valid_to is not distinct from nullif(x->>'valid_to','')::date and v_mm.valid_from=coalesce(nullif(x->>'valid_from','')::date,v_mm.valid_from) and v_mm.active=coalesce((x->>'active')::boolean,true) then
 v_mid:=v_mm.id;
 else
 insert into public.member_memberships(member_id,category_id,level_id,class_id,office,section,duties,valid_from,valid_to,active) values(v_id,v_category,nullif(x->>'level_id','')::uuid,nullif(x->>'class_id','')::uuid,nullif(x->>'office',''),nullif(x->>'section',''),nullif(x->>'duties',''),case when v_mm.id is not null then current_date else coalesce(nullif(x->>'valid_from','')::date,current_date) end,nullif(x->>'valid_to','')::date,coalesce((x->>'active')::boolean,true)) returning id into v_mid;
 end if;
 v_keep:=array_append(v_keep,v_mid);
 if coalesce((x->>'active')::boolean,true) then insert into public.member_categories(member_id,category_id) values(v_id,v_category) on conflict do nothing;end if;
 end loop;
 update public.member_memberships mm set active=false,valid_to=greatest(valid_from,current_date-1) where member_id=v_id and active and not(id=any(v_keep)) and exists(select 1 from public.categories c where c.id=mm.category_id and (v_role='ADMIN' or v_role='DEWAN_GURU' and c.slug in ('caberawit','muda-mudi') or v_role='KELOMPOK' and c.slug in ('kelompok','ibu-ibu','pengurus')));
 update public.members set class_id=(select class_id from public.member_memberships m join public.categories c on c.id=m.category_id where m.member_id=v_id and m.active and c.slug in ('caberawit','muda-mudi') order by case c.slug when 'caberawit' then 0 else 1 end limit 1),level_id=(select level_id from public.member_memberships m join public.categories c on c.id=m.category_id where m.member_id=v_id and m.active and c.slug in ('caberawit','muda-mudi') order by case c.slug when 'caberawit' then 0 else 1 end limit 1),section=(select section from public.member_memberships m join public.categories c on c.id=m.category_id where m.member_id=v_id and m.active and c.slug='pengurus' limit 1) where id=v_id;
 return (select to_jsonb(m) from public.members m where id=v_id);
end $$;
