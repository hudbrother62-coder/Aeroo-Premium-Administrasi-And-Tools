-- AEROO V2 consolidated schema changes.
-- These changes are already applied to Supabase project hzbsdzlhjmfgtexmhccv.
-- This file keeps the repository schema aligned with the production database.

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  audience public.audience_type not null default 'CABERAWIT',
  level_id uuid references public.levels(id) on delete set null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(name,audience)
);

alter table public.members
  add column if not exists level_id uuid references public.levels(id) on delete set null,
  add column if not exists class_id uuid references public.classes(id) on delete set null,
  add column if not exists source text not null default 'LOCAL',
  add column if not exists source_id text,
  add column if not exists last_synced_at timestamptz;

alter table public.attendance_events
  add column if not exists class_id uuid references public.classes(id) on delete set null;

alter table public.journals
  add column if not exists journal_kind text not null default 'KELOMPOK',
  add column if not exists class_id uuid references public.classes(id) on delete set null,
  add column if not exists member_id uuid references public.members(id) on delete set null,
  add column if not exists started_at time,
  add column if not exists ended_at time,
  add column if not exists achievement text,
  add column if not exists improvement_plan text,
  add column if not exists decisions text,
  add column if not exists assessment jsonb not null default '{}'::jsonb;

create table if not exists public.target_versions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  period_start date,
  period_end date,
  version integer not null default 1,
  source_file_name text,
  source_structure jsonb not null default '{}'::jsonb,
  analysis jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.learning_targets
  add column if not exists version_id uuid references public.target_versions(id) on delete cascade,
  add column if not exists class_id uuid references public.classes(id) on delete set null,
  add column if not exists code text,
  add column if not exists target_value numeric,
  add column if not exists target_unit text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

create table if not exists public.journal_progress (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  target_id uuid references public.learning_targets(id) on delete set null,
  progress_value numeric,
  progress_note text not null,
  assessment jsonb not null default '{}'::jsonb,
  follow_up text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.login_history (
  id bigint generated always as identity primary key,
  user_id uuid references public.app_users(id) on delete set null,
  username text not null,
  success boolean not null default false,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.report_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('pptx','docx')),
  file_path text not null,
  field_map jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  file_name text,
  file_base64 text,
  mime_type text
);

insert into public.categories(name,slug,is_system)
values ('Caberawit','caberawit',true)
on conflict (slug) do nothing;

insert into public.levels(name,sort_order,active)
values
('PAUD',1,true),('SD 1',2,true),('SD 2',3,true),('SD 3',4,true),
('SD 4',5,true),('SD 5',6,true),('SD 6',7,true),('Umum',99,true)
on conflict (name) do nothing;

insert into public.activity_types(name,audience,active)
values ('Musyawarah Pengurus','PENGURUS',true)
on conflict (name) do update set audience=excluded.audience,active=true;

create index if not exists members_level_id_idx on public.members(level_id);
create index if not exists members_class_id_idx on public.members(class_id);
create index if not exists classes_audience_level_idx on public.classes(audience,level_id,active);
create index if not exists attendance_events_class_id_idx on public.attendance_events(class_id);
create index if not exists journals_kind_date_idx on public.journals(journal_kind,journal_date);
create index if not exists journals_class_id_idx on public.journals(class_id);
create index if not exists journals_member_id_idx on public.journals(member_id);
create index if not exists journal_progress_member_idx on public.journal_progress(member_id);
create index if not exists journal_progress_target_idx on public.journal_progress(target_id);
create index if not exists login_history_created_idx on public.login_history(created_at desc);
create index if not exists learning_targets_version_idx on public.learning_targets(version_id);

alter table public.classes enable row level security;
alter table public.target_versions enable row level security;
alter table public.journal_progress enable row level security;
alter table public.login_history enable row level security;
alter table public.app_settings enable row level security;
alter table public.report_templates enable row level security;

create or replace function public.category_is_dewan_scope(p_category_id uuid)
returns boolean language sql stable security definer set search_path=public set row_security=off
as $$ select exists(select 1 from public.categories c where c.id=p_category_id and c.slug in ('muda-mudi','caberawit')) $$;

create or replace function public.member_is_dewan_scope(p_member_id uuid)
returns boolean language sql stable security definer set search_path=public set row_security=off
as $$ select exists(select 1 from public.member_categories mc join public.categories c on c.id=mc.category_id where mc.member_id=p_member_id and c.slug in ('muda-mudi','caberawit')) $$;

create or replace function public.member_has_no_categories(p_member_id uuid)
returns boolean language sql stable security definer set search_path=public set row_security=off
as $$ select not exists(select 1 from public.member_categories mc where mc.member_id=p_member_id) $$;

grant execute on function public.current_app_role() to anon,authenticated;
grant execute on function public.current_app_user_id() to anon,authenticated;
grant execute on function public.request_aeroo_session_token() to anon,authenticated;
grant execute on function public.member_is_muda_mudi(uuid) to anon,authenticated;
grant execute on function public.category_is_muda_mudi(uuid) to anon,authenticated;
grant execute on function public.can_read_audience(public.audience_type) to anon,authenticated;
grant execute on function public.can_write_audience(public.audience_type) to anon,authenticated;
grant execute on function public.can_read_event(uuid) to anon,authenticated;
grant execute on function public.can_write_event(uuid) to anon,authenticated;
grant execute on function public.can_read_journal(uuid,uuid) to anon,authenticated;
grant execute on function public.can_write_journal(uuid,uuid) to anon,authenticated;
grant execute on function public.can_read_journal_id(uuid) to anon,authenticated;
grant execute on function public.can_write_journal_id(uuid) to anon,authenticated;
grant execute on function public.category_is_dewan_scope(uuid) to anon,authenticated;
grant execute on function public.member_is_dewan_scope(uuid) to anon,authenticated;
grant execute on function public.member_has_no_categories(uuid) to anon,authenticated;
