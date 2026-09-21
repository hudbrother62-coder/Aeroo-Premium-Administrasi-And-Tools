# Aeroo Premium Administrasi

Mobile-first administration application for Kelompok, Muda Mudi, and Caberawit.

## Stack
- Next.js 15 / React 19 / TypeScript
- Supabase PostgreSQL
- Server-only Supabase service-role access (no login UI, no browser DB credentials)
- XLSX / DOCX / PDF report exports

## Local setup
1. `npm install`
2. Copy `.env.example` to `.env.local`.
3. Fill `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the Aeroo Supabase project.
4. `npm run dev`

The application opens directly to `/`; there is no login or registration route.

## Security model
RLS is enabled on every application table and there are intentionally no anon/authenticated policies. Database CRUD is performed only by Next.js server routes using `SUPABASE_SERVICE_ROLE_KEY`. Never prefix that key with `NEXT_PUBLIC_`.

## Core domains
- Database Kelompok with many-to-many categories
- Database Caberawit with dynamic jenjang
- Attendance events + H/I/A records
- Jurnal Kegiatan Kelompok
- Agenda
- Caberawit learning targets/progress
- Date-range recaps and Excel/Word/PDF export endpoints

## Deployment
Not deployed yet by design. Vercel deployment is the final manual step.