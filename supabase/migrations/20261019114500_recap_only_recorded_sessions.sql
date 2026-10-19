-- Exclude sessions with zero H/I/A from the official monthly recap.
-- Pending participants remain visible when at least one participant was marked.
-- This matches Simpul attendance history and keeps missing status distinct from Alfa.
do $patch$
declare
  f text;
  old_fragment text := E'LEFT JOIN public.classes c ON c.id=e.class_id\n    WHERE e.event_date>=v_start AND e.event_date<(v_start+INTERVAL ''1 month'')\n      AND e.state IS DISTINCT FROM ''CANCELLED''';
  new_fragment text;
begin
  f := pg_get_functiondef('public.attendance_recap_scoped(text,text,uuid,uuid,uuid)'::regprocedure);
  if position(old_fragment in f)=0 then raise exception 'Monthly attendance recap structure changed; manual review required'; end if;
  new_fragment := old_fragment || E'\n      AND EXISTS (SELECT 1 FROM public.attendance_records marked WHERE marked.event_id=e.id AND marked.status IN (''H'',''I'',''A''))';
  f := replace(f,old_fragment,new_fragment);
  execute f;
end
$patch$;
