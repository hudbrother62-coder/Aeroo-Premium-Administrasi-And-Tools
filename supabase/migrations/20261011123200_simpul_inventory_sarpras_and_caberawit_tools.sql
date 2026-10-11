
-- Sarana & prasarana: organizational scope and teaching assets.
create table if not exists public.simpul_org_units (
 id uuid primary key default gen_random_uuid(),
 parent_id uuid references public.simpul_org_units(id) on delete restrict,
 unit_type text not null check(unit_type in ('DAERAH','DESA','KELOMPOK')),
 name text not null check(char_length(btrim(name)) between 1 and 120),
 created_at timestamptz not null default now()
);
create unique index if not exists simpul_org_unit_identity on public.simpul_org_units
 (coalesce(parent_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(name));
create index if not exists simpul_org_unit_parent on public.simpul_org_units(parent_id);

insert into public.simpul_org_units(parent_id,unit_type,name) values(null,'DAERAH','Malang Timur') on conflict do nothing;
insert into public.simpul_org_units(parent_id,unit_type,name)
select d.id,'DESA',v.name from public.simpul_org_units d
cross join (values('Mangliawan'),('Sawojajar'),('Cibuni')) v(name)
where d.unit_type='DAERAH' and d.name='Malang Timur'
on conflict do nothing;
insert into public.simpul_org_units(parent_id,unit_type,name)
select d.id,'KELOMPOK',v.kelompok
from (values
 ('Mangliawan','Utara'),('Mangliawan','Selatan'),('Mangliawan','Sekarpuro'),('Mangliawan','Mendit'),('Mangliawan','Zam Zam'),
 ('Sawojajar','Sawojajar'),('Sawojajar','Muharto'),('Sawojajar','Kerinci'),('Sawojajar','Madyopuro'),('Sawojajar','Polehan'),
 ('Cibuni','Cibuni'),('Cibuni','Bengawan Solo'),('Cibuni','Mergosono'),('Cibuni','Pandanwangi'),('Cibuni','Plaosan'),('Cibuni','Klonjen')
) v(desa,kelompok)
join public.simpul_org_units d on d.name=v.desa and d.unit_type='DESA'
join public.simpul_org_units parent on parent.id=d.parent_id and parent.name='Malang Timur'
on conflict do nothing;

create table if not exists public.simpul_inventory (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('MAIN','TEACHING')),
 org_unit_id uuid not null references public.simpul_org_units(id) on delete restrict,
 level_id uuid references public.levels(id) on delete restrict,
 class_id uuid references public.classes(id) on delete restrict,
 name text not null check (char_length(btrim(name)) between 1 and 160),
 asset_code text check(asset_code is null or char_length(asset_code)<=64),
 quantity numeric(12,2) not null default 1 check (quantity>=0),
 unit text not null default 'unit' check(char_length(btrim(unit)) between 1 and 32),
 asset_condition text not null default 'BAIK' check(asset_condition in ('BAIK','RUSAK_RINGAN','RUSAK_BERAT')),
 location text check(location is null or char_length(location)<=200),
 responsible_name text check(responsible_name is null or char_length(responsible_name)<=160),
 notes text check(notes is null or char_length(notes)<=3000),
 acquired_on date,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','ARCHIVED')),
 revision integer not null default 0,
 created_by uuid references public.app_users(id) on delete set null,
 updated_by uuid references public.app_users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint simpul_inventory_teaching_scope check(
   (kind='MAIN' and level_id is null and class_id is null) or
   (kind='TEACHING' and level_id is not null)
 )
);
create index if not exists simpul_inventory_org_kind on public.simpul_inventory(org_unit_id,kind,status);
create index if not exists simpul_inventory_level_class on public.simpul_inventory(level_id,class_id) where kind='TEACHING';

create or replace function public.simpul_inventory_validate() returns trigger
language plpgsql set search_path='' as $fn$
declare v_uid uuid; v_audience public.audience_type; v_level uuid;
begin
 v_uid:=public.current_app_user_id();
 if v_uid is null then raise exception 'Login diperlukan untuk menyimpan sarpras'; end if;
 new.name:=btrim(new.name);
 new.unit:=btrim(new.unit);
 new.asset_code:=nullif(btrim(new.asset_code),'');
 new.location:=nullif(btrim(new.location),'');
 new.responsible_name:=nullif(btrim(new.responsible_name),'');
 new.notes:=nullif(btrim(new.notes),'');
 if new.kind='TEACHING' and new.class_id is not null then
   select audience,level_id into v_audience,v_level from public.classes where id=new.class_id;
   if not found or v_audience<>'CABERAWIT'::public.audience_type or v_level is distinct from new.level_id then
     raise exception 'Kelas alat bantu harus kelas Caberawit sesuai jenjang';
   end if;
 end if;
 if tg_op='INSERT' then new.created_by:=v_uid; new.revision:=0;
 else new.revision:=old.revision+1; end if;
 new.updated_by:=v_uid; new.updated_at:=now();
 return new;
end
$fn$;
drop trigger if exists trg_simpul_inventory_validate on public.simpul_inventory;
create trigger trg_simpul_inventory_validate before insert or update on public.simpul_inventory
for each row execute function public.simpul_inventory_validate();

alter table public.simpul_org_units enable row level security;
alter table public.simpul_inventory enable row level security;
drop policy if exists simpul_org_unit_read on public.simpul_org_units;
create policy simpul_org_unit_read on public.simpul_org_units for select to anon,authenticated
using (public.current_app_user_id() is not null);
drop policy if exists simpul_inventory_read on public.simpul_inventory;
create policy simpul_inventory_read on public.simpul_inventory for select to anon,authenticated
using (
 public.current_app_user_id() is not null and
 (
   (kind='MAIN' and public.current_app_role() in ('ADMIN'::public.app_role,'KELOMPOK'::public.app_role))
   or
   (kind='TEACHING' and public.can_read_scoped_audience('CABERAWIT'::public.audience_type,class_id))
 )
);
drop policy if exists simpul_inventory_insert on public.simpul_inventory;
create policy simpul_inventory_insert on public.simpul_inventory for insert to anon,authenticated
with check (
 public.current_app_user_id() is not null and
 (
   (kind='MAIN' and public.current_app_role() in ('ADMIN'::public.app_role,'KELOMPOK'::public.app_role))
   or
   (kind='TEACHING' and public.can_write_scoped_audience('CABERAWIT'::public.audience_type,class_id))
 )
);
drop policy if exists simpul_inventory_update on public.simpul_inventory;
create policy simpul_inventory_update on public.simpul_inventory for update to anon,authenticated
using (
 public.current_app_user_id() is not null and
 (
   (kind='MAIN' and public.current_app_role() in ('ADMIN'::public.app_role,'KELOMPOK'::public.app_role))
   or
   (kind='TEACHING' and public.can_write_scoped_audience('CABERAWIT'::public.audience_type,class_id))
 )
)
with check (
 public.current_app_user_id() is not null and
 (
   (kind='MAIN' and public.current_app_role() in ('ADMIN'::public.app_role,'KELOMPOK'::public.app_role))
   or
   (kind='TEACHING' and public.can_write_scoped_audience('CABERAWIT'::public.audience_type,class_id))
 )
);
grant select on public.simpul_org_units to anon,authenticated;
grant select,insert,update on public.simpul_inventory to anon,authenticated;
revoke delete on public.simpul_inventory from anon,authenticated;
