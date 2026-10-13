-- Do not expose materialized routine agenda templates through the viewer projection.
-- Preserve the original audience privacy guard and all existing agenda rows.
do $patch$
declare f text; oldpart text; newpart text;
begin
  f:=pg_get_functiondef('public.viewer_data(text)'::regprocedure);
  oldpart:='from public.agenda g left join public.activity_types a on a.id=g.activity_type_id where g.audience<>''PENGURUS'';';
  newpart:='from public.agenda g left join public.activity_types a on a.id=g.activity_type_id where g.audience<>''PENGURUS'' and g.routine_id is null;';
  if position(oldpart in f)=0 then raise exception 'Viewer agenda projection fragment not found';end if;
  f:=replace(f,oldpart,newpart);
  execute f;
end
$patch$;
