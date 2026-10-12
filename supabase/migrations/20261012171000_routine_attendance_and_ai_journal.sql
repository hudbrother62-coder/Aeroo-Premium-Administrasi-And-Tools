-- Simpul: routine attendance sessions + durable, reviewable AI journal suggestions.
-- Preserve historic events, journals, and all assessed individual progress.
do $patch$
declare f text; oldkey text; newkey text;begin
  f:=pg_get_functiondef('public.ensure_attendance(jsonb)'::regprocedure);
  oldkey:='if g.id is null then v_key:=a||'':''||v_date||'':''||coalesce(v_class::text,'''')||'':''||coalesce(v_level::text,'''')||'':''||coalesce(v_activity::text,'''')||'':''||coalesce(p_event->>''event_time'','''')||'':''||lower(trim(p_event->>''title''))||'':''||coalesce(lower(v_teacher),'''')||'':''||array_to_string(v_people,'',''); end if;';
  newkey:='if g.id is null then
    if a=''KELOMPOK'' then
      v_key:=''routine:KELOMPOK:''||v_date::text||'':''||coalesce(v_activity::text,'''');
    elsif a=''CABERAWIT'' then
      v_key:=''routine:CABERAWIT:''||v_date::text||'':''||v_class::text;
    else
      v_key:=a||'':''||v_date||'':''||coalesce(v_class::text,'''')||'':''||coalesce(v_level::text,'''')||'':''||coalesce(v_activity::text,'''')||'':''||coalesce(p_event->>''event_time'','''')||'':''||lower(trim(p_event->>''title''))||'':''||coalesce(lower(v_teacher),'''')||'':''||array_to_string(v_people,'','');
    end if;
  end if;';
  if position(oldkey in f)=0 then raise exception 'Routine key patch source not found; inspect function before updating';end if;
  f:=replace(f,oldkey,newkey);
  f:=replace(f,
    'if g.id is null and a=''CABERAWIT'' and v_teacher is null then raise exception ''Dewan Guru yang mengajar wajib diisi''; end if;',
    '-- Routine Caberawit attendance may be opened before a teacher is assigned.'
  );
  execute f;
end
$patch$;

create or replace function public.save_journal_ai_analysis(p_id uuid,p_analysis jsonb)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare j public.journals%rowtype;
begin
  if not coalesce(public.can_write_journal_id(p_id),false) then raise exception 'Jurnal di luar akses';end if;
  if jsonb_typeof(p_analysis)<>'object' or pg_catalog.length(p_analysis::text)>20000 then raise exception 'Format analisis tidak valid';end if;
  select * into j from public.journals where id=p_id for update;
  if not found or j.state='ARCHIVED' then raise exception 'Jurnal tidak dapat dianalisis';end if;
  update public.journals set assessment=jsonb_set(coalesce(assessment,'{}'::jsonb),'{ai_target_analysis}',p_analysis,true),
    updated_at=now(),revision=revision+1 where id=p_id
    returning * into j;
  return jsonb_build_object('id',j.id,'revision',j.revision,'analysis',j.assessment->'ai_target_analysis');
end $$;
revoke all on function public.save_journal_ai_analysis(uuid,jsonb) from public;
grant execute on function public.save_journal_ai_analysis(uuid,jsonb) to anon,authenticated;
