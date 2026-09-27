insert into public.levels(name,sort_order,active) values ('Remaja',8,true),('Generasi Produktif',9,true) on conflict (name) do update set active=true;
alter table public.learning_targets add column if not exists target_month date;
create index if not exists learning_targets_month_idx on public.learning_targets(target_month,level_id);
