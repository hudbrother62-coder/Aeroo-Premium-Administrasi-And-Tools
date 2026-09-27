create or replace function public.list_viewer_visits()
returns table(id uuid,display_name text,device text,visited_at timestamptz)
language plpgsql stable security definer set search_path = '' set row_security = 'off' as $$
begin
  if public.current_app_role() is distinct from 'ADMIN'::public.app_role then
    raise exception 'Akses ditolak';
  end if;
  return query select v.id,v.display_name,v.device,v.visited_at from public.viewer_visits v order by v.visited_at desc limit 100;
end;
$$;
revoke all on function public.list_viewer_visits() from public;
grant execute on function public.list_viewer_visits() to authenticated, anon;
