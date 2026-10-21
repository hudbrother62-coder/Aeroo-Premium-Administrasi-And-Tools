-- Preserve original attendance records. Group only legacy orphan participant keys consistently by audience and normalized name.
-- Verified no duplicate normalized names within one event at migration time.
CREATE OR REPLACE FUNCTION public.attendance_recap_scoped(p_month text, p_audience text DEFAULT NULL::text, p_level_id uuid DEFAULT NULL::uuid, p_class_id uuid DEFAULT NULL::uuid, p_event_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
DECLARE
  v_start date;
  v_role public.app_role;
  v_result jsonb;
BEGIN
  IF p_month IS NULL OR p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Bulan rekap tidak valid';
  END IF;
  v_start := (p_month || '-01')::date;
  v_role := public.current_app_role();

  -- Details are loaded on demand for one selected meeting only.
  IF p_event_id IS NOT NULL THEN
    SELECT jsonb_build_object('participants',
      COALESCE(jsonb_agg(jsonb_build_object(
        'id', COALESCE(r.participant_key,r.member_id,r.id),
        'name', COALESCE(r.member_name_snapshot,'Peserta'),
        'class_name', COALESCE(r.class_name_snapshot,''),
        'level_name', COALESCE(r.level_name_snapshot,''),
        'status', r.status,
        'notes', CASE WHEN v_role IS NULL OR v_role::text='VIEWER' THEN '' ELSE COALESCE(r.notes,'') END
      ) ORDER BY r.member_name_snapshot,r.id), '[]'::jsonb))
    INTO v_result
    FROM public.attendance_events e
    JOIN public.attendance_records r ON r.event_id=e.id
    WHERE e.id=p_event_id
      AND e.event_date>=v_start AND e.event_date<(v_start+INTERVAL '1 month')
      AND e.state IS DISTINCT FROM 'CANCELLED'
      AND (NULLIF(p_audience,'') IS NULL OR e.audience::text=p_audience)
      AND (
        ((v_role IS NULL OR v_role::text='VIEWER') AND e.audience::text<>'PENGURUS')
        OR (v_role IS NOT NULL AND v_role::text<>'VIEWER'
            AND public.has_app_permission('attendance.read')
            AND public.can_read_scoped_audience(e.audience,e.class_id))
      )
      AND (p_class_id IS NULL OR r.class_id_snapshot=p_class_id
          OR (r.class_id_snapshot IS NULL AND e.class_id=p_class_id))
      AND (p_level_id IS NULL OR r.level_id_snapshot=p_level_id
          OR (r.level_id_snapshot IS NULL AND e.level_id=p_level_id));
    RETURN COALESCE(v_result, '{"participants":[]}'::jsonb);
  END IF;

  WITH
  eligible_events AS MATERIALIZED (
    SELECT e.id,e.title,e.event_date,e.audience,e.class_id,e.level_id,
      COALESCE(c.name,'') AS class_name
    FROM public.attendance_events e
    LEFT JOIN public.classes c ON c.id=e.class_id
    WHERE e.event_date>=v_start AND e.event_date<(v_start+INTERVAL '1 month')
      AND e.state IS DISTINCT FROM 'CANCELLED'
      AND EXISTS (SELECT 1 FROM public.attendance_records marked WHERE marked.event_id=e.id AND marked.status IN ('H','I','A'))
      AND (NULLIF(p_audience,'') IS NULL OR e.audience::text=p_audience)
      AND (
        ((v_role IS NULL OR v_role::text='VIEWER') AND e.audience::text<>'PENGURUS')
        OR (v_role IS NOT NULL AND v_role::text<>'VIEWER'
            AND public.has_app_permission('attendance.read')
            AND public.can_read_scoped_audience(e.audience,e.class_id))
      )
      AND (
        (p_class_id IS NULL AND p_level_id IS NULL)
        OR EXISTS (
          SELECT 1 FROM public.attendance_records rr
          WHERE rr.event_id=e.id
            AND (p_class_id IS NULL OR rr.class_id_snapshot=p_class_id
                 OR (rr.class_id_snapshot IS NULL AND e.class_id=p_class_id))
            AND (p_level_id IS NULL OR rr.level_id_snapshot=p_level_id
                 OR (rr.level_id_snapshot IS NULL AND e.level_id=p_level_id))
        )
      )
  ),
  filtered_records AS MATERIALIZED (
    SELECT r.*,e.event_date,e.audience::text AS event_audience
    FROM eligible_events e
    JOIN public.attendance_records r ON r.event_id=e.id
    WHERE (p_class_id IS NULL OR r.class_id_snapshot=p_class_id
           OR (r.class_id_snapshot IS NULL AND e.class_id=p_class_id))
      AND (p_level_id IS NULL OR r.level_id_snapshot=p_level_id
           OR (r.level_id_snapshot IS NULL AND e.level_id=p_level_id))
  ),
  event_rollup AS (
    SELECT e.id,e.title,e.event_date,e.audience::text AS audience,e.class_name,
      COUNT(r.id) AS total,
      COUNT(r.id) FILTER (WHERE r.status='H') AS h,
      COUNT(r.id) FILTER (WHERE r.status='I') AS i,
      COUNT(r.id) FILTER (WHERE r.status='A') AS a
    FROM eligible_events e
    LEFT JOIN filtered_records r ON r.event_id=e.id
    GROUP BY e.id,e.title,e.event_date,e.audience,e.class_name
  ),
  person_counts AS (
    SELECT CASE WHEN r.member_id IS NULL THEN 'legacy:' || r.event_audience || ':' || lower(regexp_replace(btrim(COALESCE(r.member_name_snapshot,'')), '[[:space:]]+', ' ', 'g')) ELSE COALESCE(r.member_id,r.participant_key,r.id)::text END AS id,
      COALESCE(MIN(r.member_name_snapshot),'Peserta') AS name,
      COALESCE(MAX(r.class_name_snapshot),'') AS class_name,
      COALESCE(MAX(r.level_name_snapshot),'') AS level_name,
      COUNT(*) FILTER (WHERE r.status='H') AS h,
      COUNT(*) FILTER (WHERE r.status='I') AS i,
      COUNT(*) FILTER (WHERE r.status='A') AS a,
      COUNT(*) FILTER (WHERE r.status IS NULL) AS pending,
      COALESCE(jsonb_agg(r.event_date ORDER BY r.event_date) FILTER (WHERE r.status='H'),'[]'::jsonb) AS dates_h,
      COALESCE(jsonb_agg(r.event_date ORDER BY r.event_date) FILTER (WHERE r.status='I'),'[]'::jsonb) AS dates_i,
      COALESCE(jsonb_agg(r.event_date ORDER BY r.event_date) FILTER (WHERE r.status='A'),'[]'::jsonb) AS dates_a
    FROM filtered_records r
    GROUP BY CASE WHEN r.member_id IS NULL THEN 'legacy:' || r.event_audience || ':' || lower(regexp_replace(btrim(COALESCE(r.member_name_snapshot,'')), '[[:space:]]+', ' ', 'g')) ELSE COALESCE(r.member_id,r.participant_key,r.id)::text END
  )
  SELECT jsonb_build_object(
    'month',p_month,
    'summary', (SELECT jsonb_build_object(
      'H',COALESCE(SUM(h),0),'I',COALESCE(SUM(i),0),
      'A',COALESCE(SUM(a),0),
      'pending',COALESCE(SUM(total-h-i-a),0),'meetings',COUNT(*))
      FROM event_rollup),
    'individuals', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id',id,'name',name,'class_name',class_name,'level_name',level_name,
      'H',h,'I',i,'A',a,'pending',pending,
      'percentage',CASE WHEN h+i+a>0 THEN ROUND(h*100.0/(h+i+a),1) ELSE NULL END,
      'dates',jsonb_build_object('H',dates_h,'I',dates_i,'A',dates_a)
    ) ORDER BY name,id),'[]'::jsonb) FROM person_counts),
    'meetings', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id',id,'title',title,'date',event_date,'audience',audience,
      'class_name',class_name,'total',total,
      'summary',jsonb_build_object('H',h,'I',i,'A',a,'pending',total-h-i-a)
    ) ORDER BY event_date DESC,title,id),'[]'::jsonb) FROM event_rollup)
  ) INTO v_result;
  RETURN v_result;
END;
$function$

