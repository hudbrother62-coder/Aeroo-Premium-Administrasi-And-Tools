
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.app_users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_resource_idx on public.audit_logs(resource_type, resource_id);
alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read on public.audit_logs
for select to anon, authenticated
using ((select public.current_app_role()) = 'ADMIN'::public.app_role);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  resource_type text not null,
  file_name text,
  status text not null default 'PENDING'
    check (status in ('PENDING','VALIDATING','PREVIEW','IMPORTING','COMPLETED','PARTIAL','FAILED')),
  total_rows integer not null default 0,
  inserted_rows integer not null default 0,
  updated_rows integer not null default 0,
  skipped_rows integer not null default 0,
  error_rows integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists import_jobs_owner_created_idx on public.import_jobs(owner_user_id, created_at desc);
alter table public.import_jobs enable row level security;
drop policy if exists import_jobs_owner_read on public.import_jobs;
create policy import_jobs_owner_read on public.import_jobs
for select to anon, authenticated
using (owner_user_id = (select public.current_app_user_id()) or (select public.current_app_role()) = 'ADMIN'::public.app_role);
drop policy if exists import_jobs_owner_insert on public.import_jobs;
create policy import_jobs_owner_insert on public.import_jobs
for insert to anon, authenticated
with check (owner_user_id = (select public.current_app_user_id()) and (select public.current_app_role()) <> 'VIEWER'::public.app_role);
drop policy if exists import_jobs_owner_update on public.import_jobs;
create policy import_jobs_owner_update on public.import_jobs
for update to anon, authenticated
using (owner_user_id = (select public.current_app_user_id()) or (select public.current_app_role()) = 'ADMIN'::public.app_role)
with check (owner_user_id = (select public.current_app_user_id()) or (select public.current_app_role()) = 'ADMIN'::public.app_role);

create table if not exists public.resource_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  resource_type text not null,
  resource_id uuid,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  caption text,
  created_at timestamptz not null default now()
);
create index if not exists resource_attachments_resource_idx on public.resource_attachments(resource_type, resource_id);
alter table public.resource_attachments enable row level security;
drop policy if exists resource_attachments_owner_read on public.resource_attachments;
create policy resource_attachments_owner_read on public.resource_attachments
for select to anon, authenticated
using (
  owner_user_id = (select public.current_app_user_id())
  or (select public.current_app_role()) = 'ADMIN'::public.app_role
);
drop policy if exists resource_attachments_owner_write on public.resource_attachments;
create policy resource_attachments_owner_write on public.resource_attachments
for all to anon, authenticated
using (
  owner_user_id = (select public.current_app_user_id())
  and (select public.current_app_role()) <> 'VIEWER'::public.app_role
)
with check (
  owner_user_id = (select public.current_app_user_id())
  and (select public.current_app_role()) <> 'VIEWER'::public.app_role
);

create table if not exists public.notification_reads (
  user_id uuid not null references public.app_users(id) on delete cascade,
  notification_key text not null,
  read_at timestamptz not null default now(),
  primary key(user_id, notification_key)
);
alter table public.notification_reads enable row level security;
drop policy if exists notification_reads_owner on public.notification_reads;
create policy notification_reads_owner on public.notification_reads
for all to anon, authenticated
using (user_id = (select public.current_app_user_id()))
with check (user_id = (select public.current_app_user_id()));

create or replace function public.audit_resource_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid;
  v_id text;
begin
  v_actor := public.current_app_user_id();
  if v_actor is null then
    return coalesce(new, old);
  end if;
  v_id := coalesce((to_jsonb(new)->>'id'), (to_jsonb(old)->>'id'));
  insert into public.audit_logs(actor_user_id,action,resource_type,resource_id,before_data,after_data)
  values(
    v_actor,
    lower(tg_op),
    tg_table_name,
    v_id,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

revoke all on function public.audit_resource_change() from public;

do $$
declare t text;
begin
  foreach t in array array[
    'members','member_memberships','agenda','attendance_records','journals',
    'learning_targets','personal_notes','organizational_positions',
    'meeting_decisions','report_snapshots','app_users'
  ]
  loop
    execute format('drop trigger if exists airo_audit_change on public.%I', t);
    execute format('create trigger airo_audit_change after insert or update or delete on public.%I for each row execute function public.audit_resource_change()', t);
  end loop;
end $$;

