create table public.organizational_positions (
 id uuid primary key default gen_random_uuid(), member_id uuid not null references public.members(id),
 legacy_membership_id uuid unique references public.member_memberships(id),
 title text not null check(length(trim(title))>0), section text not null default '', duties text not null default '',
 valid_from date not null,valid_to date, active boolean not null default true,
 revision integer not null default 0, created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(valid_to is null or valid_to>=valid_from)
);
alter table public.organizational_positions enable row level security;
create index organizational_positions_member on public.organizational_positions(member_id);
revoke all on public.organizational_positions from anon,authenticated;
grant select on public.organizational_positions to anon,authenticated;
create policy positions_internal_read on public.organizational_positions for select to anon,authenticated using((select public.current_app_role()) in ('ADMIN','KELOMPOK'));
-- Preserve original memberships for legacy sessions and historical reports.
insert into public.organizational_positions(member_id,legacy_membership_id,title,section,duties,valid_from,valid_to,active)
select m.member_id,m.id,coalesce(nullif(trim(m.office),''),'Pengurus'),coalesce(m.section,''),coalesce(m.duties,''),coalesce(m.valid_from,(m.created_at at time zone 'Asia/Jakarta')::date),m.valid_to,m.active
from public.member_memberships m join public.categories c on c.id=m.category_id where c.slug='pengurus';
create or replace function public.save_organizational_position(p_id uuid,p_revision integer,p_body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.organizational_positions%rowtype;person uuid;begin
 if public.current_app_role() is null or public.current_app_role() not in ('ADMIN','KELOMPOK') then raise exception 'Akses pengurus ditolak';end if;
 if p_revision is null or p_revision<0 then raise exception 'Revisi tidak valid';end if;
 person:=(p_body->>'member_id')::uuid;
 if not exists(select 1 from public.members where id=person and status='ACTIVE') then raise exception 'Anggota aktif wajib dipilih';end if;
 if length(trim(coalesce(p_body->>'title','')))=0 or (p_body->>'valid_from') is null then raise exception 'Jabatan dan tanggal mulai wajib diisi';end if;
 if p_id is not null then select * into r from public.organizational_positions where id=p_id for update;if not found then raise exception 'Jabatan tidak ditemukan';end if;if r.revision<>p_revision then raise exception 'CONFLICT: Jabatan sudah diubah';end if;
 update public.organizational_positions set member_id=person,title=trim(p_body->>'title'),section=coalesce(p_body->>'section',''),duties=coalesce(p_body->>'duties',''),valid_from=(p_body->>'valid_from')::date,valid_to=nullif(p_body->>'valid_to','')::date,active=coalesce((p_body->>'active')::boolean,true),revision=revision+1,updated_at=now() where id=p_id returning * into r;
 else insert into public.organizational_positions(member_id,title,section,duties,valid_from,valid_to) values(person,trim(p_body->>'title'),coalesce(p_body->>'section',''),coalesce(p_body->>'duties',''),(p_body->>'valid_from')::date,nullif(p_body->>'valid_to','')::date) returning * into r;end if;
 return to_jsonb(r);
end $$;
revoke all on function public.save_organizational_position(uuid,integer,jsonb) from public;
grant execute on function public.save_organizational_position(uuid,integer,jsonb) to anon,authenticated;
