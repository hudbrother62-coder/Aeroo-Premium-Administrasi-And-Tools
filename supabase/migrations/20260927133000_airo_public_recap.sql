create or replace function public.viewer_recap(p_month date, p_span integer)
returns jsonb language sql stable security definer
set search_path = '' set row_security = 'off' as $$
  with input as (
    select date_trunc('month', coalesce(p_month,current_date))::date as end_month,
      case when p_span = 6 then 6 else 1 end as months
  ), limits as (
    select (end_month - ((months-1) * interval '1 month'))::date as start_date,
      (end_month + interval '1 month')::date as end_date from input
  ), monthly as (
    select gs::date as month from limits l,
      generate_series(l.start_date,l.end_date - interval '1 month',interval '1 month') gs
  )
  select jsonb_build_object(
    'members',(select count(*) from public.members where status='ACTIVE'),
    'categories',(select coalesce(jsonb_agg(jsonb_build_object('name',c.name,'count',
      (select count(*) from public.member_categories mc join public.members m on m.id=mc.member_id
       where mc.category_id=c.id and m.status='ACTIVE')) order by c.name),'[]'::jsonb) from public.categories c),
    'attendance',(select jsonb_build_object('meetings',count(distinct e.id),'present',count(r.id) filter(where r.status='H'),
      'excused',count(r.id) filter(where r.status='I'),'absent',count(r.id) filter(where r.status='A'))
      from public.attendance_events e left join public.attendance_records r on r.event_id=e.id, limits l
      where e.event_date>=l.start_date and e.event_date<l.end_date),
    'journals',(select count(*) from public.journals j,limits l where j.journal_date>=l.start_date and j.journal_date<l.end_date),
    'monthly',(select coalesce(jsonb_agg(jsonb_build_object('month',to_char(m.month,'YYYY-MM'),
      'meetings',(select count(*) from public.attendance_events e where e.event_date>=m.month and e.event_date<(m.month+interval '1 month')::date),
      'journals',(select count(*) from public.journals j where j.journal_date>=m.month and j.journal_date<(m.month+interval '1 month')::date),
      'present',(select count(*) from public.attendance_records r join public.attendance_events e on e.id=r.event_id where r.status='H' and e.event_date>=m.month and e.event_date<(m.month+interval '1 month')::date)
      ) order by m.month),'[]'::jsonb) from monthly m)
  );
$$;
revoke all on function public.viewer_recap(date,integer) from public;
grant execute on function public.viewer_recap(date,integer) to anon, authenticated;
