-- Simpul: jabatan Kelompok Zam Zam mengikuti satu master anggota dan hirarki yang eksplisit.
-- hierarchy_level: 1 adalah pimpinan tertinggi; display_order menjaga urutan daftar sumber.
alter table public.organizational_positions
  add column if not exists hierarchy_level integer not null default 99,
  add column if not exists display_order integer not null default 999;

do $seed$
declare
  entry record;
  person_id uuid;
  match_count integer;
begin
  -- Nama pada daftar sumber tidak ada di master; buat tepat sekali sebagai anggota,
  -- lalu kaitkan jabatan lewat member_id (bukan teks nama yang berdiri sendiri).
  insert into public.members (name)
  select 'Alfin Dana'
  where not exists (
    select 1 from public.members where lower(btrim(name)) = lower('Alfin Dana')
  );

  for entry in
    select * from (values
      (1, 1, 'Didik Purwanto', 'Kyai Kelompok', 'Pimpinan'),
      (2, 2, 'Bp.H.Saiful Hadi', 'Wakil Kyai', 'Wakil Kyai'),
      (2, 3, 'Eko Hadi Sulistiawan', 'Wakil Kyai', 'Wakil Kyai'),
      (3, 4, 'Bp. Billy Catur Firmansyah', 'Penerobos', 'Penerobos'),
      (3, 5, 'Dzakwan Yudha Firdaus', 'Penerobos', 'Penerobos'),
      (4, 6, 'Supriyanto', 'Agnia', 'Agnia'),
      (5, 7, 'Hardiansyah', 'Mubaligh', 'Mubaligh'),
      (5, 8, 'Ilman Daylami', 'Mubaligh', 'Mubaligh'),
      (6, 9, 'Singgih Setyo Wibowo', 'KU', 'KU'),
      (6, 10, 'Alfin Dana', 'Penulis KU', 'KU'),
      (7, 11, 'Bp Kasnan', 'Tim Kematian', 'Tim Kematian'),
      (8, 12, 'Sony Nurcholis', 'Pembangunan & Dhuafa', 'Pembangunan & Dhuafa')
    ) as v(hierarchy_level, display_order, member_name, position_title, position_section)
  loop
    select count(*), (array_agg(id))[1] into match_count, person_id
    from public.members where lower(btrim(name)) = lower(entry.member_name);
    if match_count <> 1 then
      raise exception 'Nama % tidak cocok secara unik pada master anggota (jumlah: %)',
        entry.member_name, match_count;
    end if;

    update public.organizational_positions
       set title = entry.position_title,
           section = entry.position_section,
           hierarchy_level = entry.hierarchy_level,
           display_order = entry.display_order,
           revision = revision + 1,
           updated_at = now()
     where member_id = person_id and active = true;

    if not found then
      insert into public.organizational_positions
        (member_id, title, section, duties, valid_from, active, hierarchy_level, display_order)
      values (
        person_id, entry.position_title, entry.position_section, '',
        (now() at time zone 'Asia/Jakarta')::date, true,
        entry.hierarchy_level, entry.display_order
      );
    end if;
  end loop;
end
$seed$;

-- Pertahankan pemeriksaan revisi dan pembatasan role untuk CRUD posisi.
-- Kolom urutan baru disimpan di transaksi yang sama dengan perubahan jabatan.
create or replace function public.save_organizational_position(
  p_id uuid, p_revision integer, p_body jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
set row_security='off'
as $fn$
declare
  r public.organizational_positions%rowtype;
  person uuid;
  new_valid_to date;
  new_level integer;
  new_order integer;
begin
  if public.current_app_role() is null
     or public.current_app_role() not in ('ADMIN', 'KELOMPOK') then
    raise exception 'Akses dapukan ditolak';
  end if;
  if p_revision is null or p_revision < 0 then
    raise exception 'Revisi tidak valid';
  end if;

  person := (p_body->>'member_id')::uuid;
  if not exists (select 1 from public.members where id=person and status='ACTIVE') then
    raise exception 'Anggota aktif wajib dipilih';
  end if;
  if length(btrim(coalesce(p_body->>'title',''))) = 0
     or (p_body->>'valid_from') is null then
    raise exception 'Dapukan dan tanggal mulai wajib diisi';
  end if;

  if p_id is not null then
    select * into r from public.organizational_positions
      where id=p_id for update;
    if not found then raise exception 'Dapukan tidak ditemukan'; end if;
    if r.revision<>p_revision then
      raise exception 'CONFLICT: Dapukan sudah diubah';
    end if;
  end if;
  new_level := coalesce(nullif(p_body->>'hierarchy_level','')::integer,
                       case when p_id is null then 99 else r.hierarchy_level end);
  new_order := coalesce(nullif(p_body->>'display_order','')::integer,
                       case when p_id is null then 999 else r.display_order end);
  if new_level not between 1 and 99 or new_order not between 1 and 99999 then
    raise exception 'Lapisan atau nomor urut di luar rentang';
  end if;

  if p_id is not null then
    new_valid_to := case when p_body ? 'valid_to'
      then nullif(p_body->>'valid_to','')::date else r.valid_to end;
    update public.organizational_positions
       set member_id=person,
           title=btrim(p_body->>'title'),
           section=coalesce(p_body->>'section',''),
           duties=coalesce(p_body->>'duties',''),
           valid_from=(p_body->>'valid_from')::date,
           valid_to=new_valid_to,
           active=coalesce((p_body->>'active')::boolean,r.active),
           hierarchy_level=new_level,
           display_order=new_order,
           revision=revision+1,updated_at=now()
     where id=p_id returning * into r;
  else
    insert into public.organizational_positions
      (member_id,title,section,duties,valid_from,valid_to,hierarchy_level,display_order)
    values (
      person,btrim(p_body->>'title'),coalesce(p_body->>'section',''),
      coalesce(p_body->>'duties',''),(p_body->>'valid_from')::date,
      nullif(p_body->>'valid_to','')::date,new_level,new_order
    ) returning * into r;
  end if;
  return to_jsonb(r);
end
$fn$;

revoke all on function public.save_organizational_position(uuid,integer,jsonb) from public;
grant execute on function public.save_organizational_position(uuid,integer,jsonb)
  to anon,authenticated;
