
alter table public.journal_progress add column if not exists source text not null default 'JOURNAL'
  check (source in ('MANUAL','JOURNAL','ASSESSMENT','IMPORT','ADJUSTMENT'));
alter table public.journal_progress add column if not exists evidence jsonb not null default '[]'::jsonb;
alter table public.journal_progress add column if not exists correction_reason text;

do $$
declare f text;
begin
  f:=pg_get_functiondef('public.save_journal(uuid,integer,jsonb,jsonb)'::regprocedure);
  f:=replace(
    f,
    'if j.ended_at is not null and j.started_at is not null and j.ended_at<=j.started_at then raise exception ''Jam selesai harus setelah mulai'';end if;',
    'if j.ended_at is not null and j.started_at is not null and j.ended_at=j.started_at then raise exception ''Durasi tidak valid'';end if; if j.ended_at is not null and j.started_at is not null and j.ended_at<j.started_at and j.journal_kind<>''PENGKAJIAN'' then raise exception ''Jam selesai harus setelah mulai'';end if;'
  );
  f:=replace(
    f,
    'insert into public.journal_progress(journal_id,member_id,participant_key,member_name_snapshot,target_id,progress_value,progress_note,assessment,follow_up) values(j.id,(select id from public.members where id=(x->>''member_id'')::uuid),(x->>''member_id'')::uuid,v_name,nullif(x->>''target_id'','''')::uuid,nullif(x->>''progress_value'','''')::numeric,coalesce(x->>''progress_note'',''''),coalesce(x->''assessment'',''{}''),nullif(x->>''follow_up'',''''));',
    'insert into public.journal_progress(journal_id,member_id,participant_key,member_name_snapshot,target_id,progress_value,progress_note,assessment,follow_up,source,evidence,correction_reason) values(j.id,(select id from public.members where id=(x->>''member_id'')::uuid),(x->>''member_id'')::uuid,v_name,nullif(x->>''target_id'','''')::uuid,nullif(x->>''progress_value'','''')::numeric,coalesce(x->>''progress_note'',''''),coalesce(x->''assessment'',''{}''),nullif(x->>''follow_up'',''''),coalesce(nullif(x->>''source'',''''),''JOURNAL''),coalesce(x->''evidence'',''[]''::jsonb),nullif(x->>''correction_reason'',''''));'
  );
  execute f;
end $$;

