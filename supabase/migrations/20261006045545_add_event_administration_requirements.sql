
alter table public.agenda add column if not exists journal_required boolean not null default false;
alter table public.agenda add column if not exists documentation_required boolean not null default false;
alter table public.agenda add column if not exists target_tracking_enabled boolean not null default false;

