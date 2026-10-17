-- Fix row alias resolution: aggregate whole meeting rows rather than numeric h column.
-- Fast, scoped calendar history. Keeps all existing attendance events and records untouched.
-- Avoids nested PostgREST reads and correlated RLS checks for each participant.
CREATE OR REPLACE FUNCTION public.simpul_attendance_history_month(
  p_month text,
  p_audience text DEFAULT NULL,
  p_class_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
SET row_security = 'off'
AS $function$
DECLARE
  v_start date;
  v_role public.app_role;
  v_can_read boolean := false;
  v_data jsonb;
BEGIN
  IF p_month IS NULL OR p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Bulan riwayat tidak valid';
  END IF;
  v_start := (p_month || '-01')::date;
  v_role := public.current_app_role();
  IF v_role IS NOT NULL AND v_role::text <> 'VIEWER' THEN
    v_can_read := COALESCE(public.has_app_permission('attendance.read'),false);
    IF NOT v_can_read THEN RETURN '[]'::jsonb; END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(rowset) ORDER BY rowset.event_date DESC,rowset.title,rowset.id),'[]'::jsonb)
  INTO v_data
  FROM (
    SELECT e.id,e.title,e.event_date,e.audience::text AS audience,
      e.class_id,e.state,
      CASE WHEN c.id IS NOT NULL THEN jsonb_build_object('name',c.name)
        ELSE NULL END AS classes,
      COUNT(*) FILTER (WHERE r.status='H')::integer AS h,
      COUNT(*) FILTER (WHERE r.status='I')::integer AS i,
      COUNT(*) FILTER (WHERE r.status='A')::integer AS a
    FROM public.attendance_events e
    JOIN public.attendance_records r ON r.event_id=e.id
      AND r.status IN ('H','I','A')
      AND (p_class_id IS NULL OR r.class_id_snapshot=p_class_id
        OR (r.class_id_snapshot IS NULL AND e.class_id=p_class_id))
    LEFT JOIN public.classes c ON c.id=e.class_id
    WHERE e.event_date>=v_start AND e.event_date<(v_start+INTERVAL '1 month')
      AND e.state IS DISTINCT FROM 'CANCELLED'
      AND (NULLIF(p_audience,'') IS NULL OR e.audience::text=p_audience)
      AND (
        ((v_role IS NULL OR v_role::text='VIEWER') AND e.audience::text<>'PENGURUS')
        OR (v_can_read AND public.can_read_scoped_audience(e.audience,e.class_id))
      )
    GROUP BY e.id,c.id,c.name
  ) AS rowset;
  RETURN COALESCE(v_data,'[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.simpul_attendance_history_month(text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.simpul_attendance_history_month(text,text,uuid) TO anon,authenticated;
