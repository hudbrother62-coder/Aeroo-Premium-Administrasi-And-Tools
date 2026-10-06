create table public.report_snapshots (
 id uuid primary key default gen_random_uuid(),owner_user_id uuid not null default public.current_app_user_id() references public.app_users(id),
 title text not null,period_month text not null,period_span integer not null check(period_span in (1,6)),dataset jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.report_snapshots enable row level security;
create index report_snapshots_owner on public.report_snapshots(owner_user_id,created_at desc);
revoke all on public.report_snapshots from anon,authenticated;
grant select,insert on public.report_snapshots to anon,authenticated;
create policy report_snapshots_read on public.report_snapshots for select to anon,authenticated using(owner_user_id=(select public.current_app_user_id()));
create policy report_snapshots_create on public.report_snapshots for insert to anon,authenticated with check(owner_user_id=(select public.current_app_user_id()) and (select public.current_app_role()) in ('ADMIN','DEWAN_GURU','KELOMPOK'));
