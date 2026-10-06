
do $$
declare f text;
begin
  f:=pg_get_functiondef('public.save_agenda(uuid,integer,jsonb,text)'::regprocedure);
  f:=replace(
    f,
    'g.attendance_enabled:=coalesce(g.attendance_enabled,true);',
    'g.attendance_enabled:=coalesce(g.attendance_enabled,true); g.journal_required:=coalesce(g.journal_required,false); g.documentation_required:=coalesce(g.documentation_required,false); g.target_tracking_enabled:=coalesce(g.target_tracking_enabled,false);'
  );
  f:=replace(
    f,
    'person_in_charge=g.person_in_charge,status=g.status,attendance_enabled=g.attendance_enabled,',
    'person_in_charge=g.person_in_charge,status=g.status,attendance_enabled=g.attendance_enabled,journal_required=g.journal_required,documentation_required=g.documentation_required,target_tracking_enabled=g.target_tracking_enabled,'
  );
  execute f;
end $$;

