CREATE OR REPLACE FUNCTION public.target_review_catalog(p_version_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select coalesce(
    (select jsonb_build_object(
      'version', jsonb_build_object(
        'id', v.id, 'title', v.title, 'version', v.version,
        'period_start', v.period_start, 'period_end', v.period_end,
        'source_file_name', v.source_file_name
      ),
      'group_rows', coalesce(v.source_structure->'source_group_rows', '{}'::jsonb),
      'month_masks', coalesce(v.source_structure->'verified_detail_month_masks', '{}'::jsonb),
      'contextual_months', coalesce(v.source_structure->'context_verified_repeated_titles', '[]'::jsonb),
      'targets', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', t.id, 'level_id', t.level_id, 'class_id', t.class_id,
          'version_id', t.version_id, 'code', t.code, 'title', t.title,
          'description', t.description, 'target_month', t.target_month,
          'target_value', t.target_value, 'target_unit', t.target_unit,
          'sort_order', t.sort_order,
          'levels', jsonb_build_object('name', l.name),
          'classes', case when c.id is null then null else jsonb_build_object('name', c.name) end,
          'source_metadata', jsonb_build_object(
            'aspect', t.source_metadata->>'aspect',
            'subject', t.source_metadata->>'subject',
            'parent', t.source_metadata->>'parent',
            'program', t.source_metadata->>'program',
            'semester', t.source_metadata->'semester',
            'source_file', t.source_metadata->>'source_file',
            'source_sheet', t.source_metadata->>'source_sheet',
            'source_row', t.source_metadata->'source_row',
            'source_cell', t.source_metadata->>'source_cell',
            'source_kind', t.source_metadata->>'source_kind',
            'planned_month_numbers', coalesce(t.source_metadata->'planned_month_numbers','[]'::jsonb)
          )
        ) order by t.sort_order, t.title, t.id), '[]'::jsonb)
        from public.learning_targets t
        join public.levels l on l.id = t.level_id
        left join public.classes c on c.id = t.class_id
        where t.version_id = v.id and t.active = true
      )
    ) from public.target_versions v where v.id = p_version_id),
    '{}'::jsonb
  );
$function$
;
revoke all on function public.target_review_catalog(uuid) from public;
grant execute on function public.target_review_catalog(uuid) to anon,authenticated;
