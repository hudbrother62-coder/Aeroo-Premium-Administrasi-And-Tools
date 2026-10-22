-- Independent month-precise archival storage; preserve the mandatory journal_date constraint.
-- Preserve every original source paragraph and list nesting; no invented meeting dates.
CREATE TABLE IF NOT EXISTS public.meeting_minutes_archives (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_document_id text NOT NULL,
 source_tab_id text NOT NULL,
 source_section_key text NOT NULL,
 source_tab_title text NOT NULL,
 source_heading text NOT NULL,
 source_url text NOT NULL,
 title text NOT NULL,
 meeting_type text NOT NULL CHECK (meeting_type IN ('Kelompok','5 Unsur','Dewan Guru')),
 meeting_month text NOT NULL CHECK(meeting_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 meeting_date date NULL,
 date_status text NOT NULL CHECK(date_status IN ('EXACT','MONTH_ONLY','CONFLICT')),
 source_text text NOT NULL,
 source_blocks jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(source_blocks)='array'),
 sections jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(sections)='array'),
 requires_review boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT meeting_minutes_archives_source_unique UNIQUE(source_document_id,source_section_key),
 CONSTRAINT meeting_minutes_archives_month_match CHECK (meeting_date IS NULL OR to_char(meeting_date,'YYYY-MM')=meeting_month),
 CONSTRAINT meeting_minutes_archives_date_exact CHECK ((date_status='EXACT' AND meeting_date IS NOT NULL) OR (date_status<>'EXACT' AND meeting_date IS NULL))
);
CREATE INDEX IF NOT EXISTS meeting_minutes_archives_month_type ON public.meeting_minutes_archives(meeting_month DESC,meeting_type);
ALTER TABLE public.meeting_minutes_archives ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meeting_minutes_archives FROM anon,authenticated;
GRANT SELECT ON public.meeting_minutes_archives TO anon,authenticated;
DROP POLICY IF EXISTS meeting_minutes_archives_read ON public.meeting_minutes_archives;
CREATE POLICY meeting_minutes_archives_read ON public.meeting_minutes_archives FOR SELECT TO anon,authenticated
 USING (public.has_app_permission('journal.read'::text) AND public.can_read_audience('PENGURUS'::public.audience_type));
