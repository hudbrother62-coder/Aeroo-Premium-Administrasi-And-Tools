
-- Kalender rutin Simpul: satu instansi agenda per tanggal dan kelas.
-- Pemateri, isi jurnal, peserta khusus, dan lokasi sengaja belum diisi.
create table if not exists public.simpul_agenda_routines (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  audience public.audience_type not null,
  weekday integer not null check (weekday between 0 and 6),
  starts_at_local time without time zone not null,
  ends_at_local time without time zone,
  activity_type_id uuid references public.activity_types(id),
  class_id uuid references public.classes(id),
  series_id uuid not null default gen_random_uuid(),
  active_from date not null default date '2026-10-12',
  active_until date,
  active boolean not null default true,
  constraint simpul_routine_duration check (ends_at_local is null or ends_at_local > starts_at_local),
  constraint simpul_routine_dates check (active_until is null or active_until >= active_from)
);
alter table public.simpul_agenda_routines enable row level security;
revoke all on table public.simpul_agenda_routines from anon, authenticated;
alter table public.agenda
  add column if not exists routine_id uuid references public.simpul_agenda_routines(id),
  add column if not exists routine_slot_date date;
create unique index if not exists agenda_routine_slot_unique
  on public.agenda(routine_id,routine_slot_date) where routine_id is not null;
create index if not exists agenda_routine_date_idx
  on public.agenda(routine_slot_date) where routine_id is not null;

-- Pertemuan kelompok: Senin & Jumat pukul 19.30 WIB (akhir belum ditentukan).
insert into public.simpul_agenda_routines
  (code,title,audience,weekday,starts_at_local,ends_at_local,activity_type_id)
select
  'kelompok-'||w.day::text,
  'Pengajian Kelompok',
  'KELOMPOK'::public.audience_type,
  w.day,
  time '19:30',
  null::time,
  (select id from public.activity_types where name='Pengajian Kelompok' and audience='KELOMPOK' and active order by created_at limit 1)
from (values (1),(5)) as w(day)
on conflict (code) do nothing;

-- Caberawit: satu pertemuan PER KELAS untuk Senin s/d Sabtu, bukan satu agenda gabungan.
insert into public.simpul_agenda_routines
  (code,title,audience,weekday,starts_at_local,ends_at_local,activity_type_id,class_id)
select
  'caberawit-'||c.id::text||'-'||w.day::text,
  'Pengajian Caberawit — '||c.name,
  'CABERAWIT'::public.audience_type,
  w.day,
  time '16:00',
  time '17:00',
  (select id from public.activity_types where name='Pengajian Caberawit' and audience='CABERAWIT' and active order by created_at limit 1),
  c.id
from public.classes c
cross join generate_series(1,6) as w(day)
where c.audience='CABERAWIT' and c.active
  and c.name in ('PAUD Kecil','PAUD Besar','Kelas A','Kelas B','Kelas C')
on conflict (code) do nothing;

-- Fungsi materialisasi hanya bisa dieksekusi lewat wrapper terautentikasi.
create or replace function public._materialize_simpul_routines(p_from date,p_to date)
returns integer
language plpgsql security definer set search_path='' set row_security='off'
as $routine$
declare n integer:=0;
begin
  if p_from is null or p_to is null or p_to<p_from or p_to>p_from+62 then
    raise exception 'Rentang agenda rutin tidak valid (maksimal 63 hari)';
  end if;
  insert into public.agenda
    (title,starts_at,ends_at,activity_type_id,audience,class_id,level_id,
     participant_ids,attendance_enabled,journal_required,documentation_required,
     target_tracking_enabled,status,series_id,recurrence,routine_id,routine_slot_date)
  select
    r.title,
    (d.day::date+r.starts_at_local) at time zone 'Asia/Jakarta',
    case when r.ends_at_local is null then null
         else (d.day::date+r.ends_at_local) at time zone 'Asia/Jakarta' end,
    r.activity_type_id,r.audience,r.class_id,null::uuid,
    '{}'::uuid[],true,true,false,(r.audience='CABERAWIT'),
    'SCHEDULED',r.series_id,'weekly',r.id,d.day::date
  from public.simpul_agenda_routines r
  cross join lateral generate_series(
    greatest(p_from,r.active_from)::timestamp,
    least(p_to,coalesce(r.active_until,p_to))::timestamp,
    interval '1 day'
  ) as d(day)
  where r.active
    and extract(dow from d.day)::integer=r.weekday
  on conflict do nothing;
  get diagnostics n=row_count;
  return n;
end;
$routine$;
revoke all on function public._materialize_simpul_routines(date,date) from public,anon,authenticated;

-- GET agenda memanggil wrapper ini, tanpa memberi user hak INSERT ke tabel agenda.
create or replace function public.ensure_simpul_routine_agenda(p_from date,p_to date)
returns integer
language plpgsql security definer set search_path='' set row_security='off'
as $routine$
declare today_jakarta date:=(now() at time zone 'Asia/Jakarta')::date;
begin
  if public.current_app_user_id() is null then return 0; end if;
  if p_from is null or p_to is null or p_to<p_from or p_to>p_from+62 then
    raise exception 'Rentang agenda rutin tidak valid';
  end if;
  if p_to<date '2026-10-12' or p_from>today_jakarta+730 then return 0; end if;
  return public._materialize_simpul_routines(
    greatest(p_from,date '2026-10-12'),
    least(p_to,today_jakarta+730)
  );
end;
$routine$;
revoke all on function public.ensure_simpul_routine_agenda(date,date) from public;
grant execute on function public.ensure_simpul_routine_agenda(date,date) to anon,authenticated;

-- Persiapan tiga bulan lebih dahulu, tanpa membuat catatan hadir/jurnal palsu.
select public._materialize_simpul_routines(date '2026-10-12',date '2026-12-12');
select public._materialize_simpul_routines(date '2026-12-13',date '2027-02-12');
