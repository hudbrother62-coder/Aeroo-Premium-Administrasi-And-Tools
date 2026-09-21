# Aeroo schema and invariants

## Kelompok
`members` is the single person master. `member_categories` is many-to-many. System categories include Kelompok, Muda Mudi, Ibu-Ibu, Pengurus Kelompok. A Muda-Mudi participant remains part of Kelompok; filtering Muda-Mudi selects only that category.

## Caberawit
`caberawit` is independent and local to Aeroo. It does not sync from One Pro. `levels` is dynamic so jenjang can be added without source-code changes. Inactive records remain for history.

## Attendance
One `attendance_events` row represents a meeting. `attendance_records` stores H/I/A per participant. A record must reference exactly one of `member_id` or `caberawit_id`. Date queries are range-based and can cross month/year boundaries.

## Journal
Journals can reference an attendance event, allowing date/activity context to be reused rather than duplicated.

## Learning progress
Targets belong to a dynamic Caberawit level. Progress is 0–100 and unique per Caberawit/target pair.

## Security
All tables use RLS and intentionally expose no policies to anon/authenticated clients. This app has no login UI, so all database access is through trusted Next.js server routes. `SUPABASE_SERVICE_ROLE_KEY` must only exist in server environment variables. This is appropriate for a controlled internal no-login deployment; if the URL becomes public-facing, add an access gateway or authentication before production use.
