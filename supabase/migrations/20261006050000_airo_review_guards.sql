create or replace function public.guard_event_data() returns trigger language plpgsql security definer set search_path='' as $$
declare event uuid;agenda uuid;old_event uuid;old_agenda uuid;locked boolean;begin
 if tg_table_name='meeting_decisions' then select event_id,agenda_id into event,agenda from public.journals where id=new.journal_id;
 elsif tg_table_name='attendance_records' then event:=new.event_id;if tg_op='UPDATE' then old_event:=old.event_id;end if;
 else event:=new.event_id;agenda:=new.agenda_id;if tg_op='UPDATE' then old_event:=old.event_id;old_agenda:=old.agenda_id;end if;end if;
 select exists(select 1 from public.attendance_events e left join public.agenda a on a.id=e.agenda_id where e.id in (event,old_event) and (e.state in ('LOCKED','DRAFT') or a.status in ('LOCKED','DRAFT'))) or exists(select 1 from public.agenda a where a.id in (agenda,old_agenda) and a.status in ('LOCKED','DRAFT')) into locked;
 if locked then raise exception 'Kegiatan belum aktif atau terkunci.';end if;
 return new;
end $$;
create trigger guard_decision_event_data before insert or update on public.meeting_decisions for each row execute function public.guard_event_data();
create table public.position_revisions (
 id uuid primary key default gen_random_uuid(),position_id uuid not null references public.organizational_positions(id),actor_id uuid references public.app_users(id),snapshot jsonb not null,created_at timestamptz not null default now()
);
alter table public.position_revisions enable row level security;
create index position_revisions_position on public.position_revisions(position_id);
revoke all on public.position_revisions from anon,authenticated;
grant select on public.position_revisions to anon,authenticated;
create policy position_revision_read on public.position_revisions for select to anon,authenticated using((select public.current_app_role()) in ('ADMIN','KELOMPOK'));
create or replace function public.mirror_position_membership() returns trigger language plpgsql security definer set search_path='' as $$
declare cat uuid;today date:=(now() at time zone 'Asia/Jakarta')::date;begin
 select id into cat from public.categories where slug='pengurus';
 if cat is null then raise exception 'Kategori kompatibilitas Pengurus tidak tersedia';end if;
 if tg_op='UPDATE' then
 if new.member_id<>old.member_id or new.valid_from<>old.valid_from then raise exception 'Akhiri masa jabatan lama lalu buat jabatan baru untuk menjaga riwayat.';end if;
 insert into public.position_revisions(position_id,actor_id,snapshot) values(old.id,public.current_app_user_id(),to_jsonb(old));
 end if;
 if new.legacy_membership_id is null then
 insert into public.member_memberships(member_id,category_id,office,section,duties,valid_from,valid_to,active)
 values(new.member_id,cat,new.title,new.section,new.duties,new.valid_from,new.valid_to,new.active) returning id into new.legacy_membership_id;
 else
 update public.member_memberships set office=new.title,section=new.section,duties=new.duties,valid_to=new.valid_to,active=new.active,ended_on=case when new.active then null else coalesce(new.valid_to+1,today) end where id=new.legacy_membership_id;
 end if;
 delete from public.member_categories mc where mc.member_id=new.member_id and mc.category_id=cat and not exists(select 1 from public.member_memberships m where m.member_id=new.member_id and m.category_id=cat and m.valid_from<=today and (m.valid_to is null or m.valid_to>=today) and (m.ended_on is null or m.ended_on>today) and (m.active or m.ended_on is not null));
 if new.active and new.valid_from<=today and (new.valid_to is null or new.valid_to>=today) then insert into public.member_categories(member_id,category_id) values(new.member_id,cat) on conflict do nothing;end if;
 return new;
end $$;
