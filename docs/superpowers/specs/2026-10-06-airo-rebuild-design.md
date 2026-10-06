# AIRO Rebuild v3 — Design & Architecture Specification

Date: 2026-10-06
Repository: hudbrother62-coder/Aeroo-Premium-Administrasi-And-Tools
Branch: rebuild/airo-v3-foundation
Vercel Project: aeroo-premium-administrasi-and-tools
Supabase Project: Aeroo Premium Administrasi (hzbsdzlhjmfgtexmhccv)

## 1. Goal Lock

AIRO is rebuilt as a single operational administration system for one large workspace: **Kelompok Pengorgan**.

The application must connect:
- people
- memberships
- organizational positions
- agenda/events
- attendance
- journals
- target/progress
- personal notes
- recap
- reports

Core chain:

Person -> Membership -> Event -> Attendance / Journal / Progress -> Recap -> Report

The rebuild is not a visual patch. Existing production infrastructure is retained, but the product shell, navigation, information architecture, domain boundaries, and database model are progressively migrated.

## 2. Organizational Model

There is no active hierarchy of Daerah -> Desa -> Kelompok.

Active workspace:
- Kelompok Pengorgan

Programs:
- Caberawit
- Muda-Mudi
- Ibu-Ibu

Pengurus is not a program/category. It is a position/assignment held by a person.

One person has one master identity.

Membership is temporal:
- valid_from
- valid_to
- active
- program/category
- level/class where relevant

Position is temporal and separate from system permission.

## 3. Rebuild Principles

1. One person = one master identity.
2. Membership history must never be overwritten.
3. Pengurus position is separate from program membership and app permission.
4. Event is the operational center.
5. Attendance is immediate, autosaved, reversible, and revisioned.
6. Journals follow real domain needs; no universal journal form.
7. Progress requires evidence/source.
8. Recap and reports use the same reporting dataset.
9. Permission is enforced on backend/database, not only UI.
10. Historical records remain correct after current membership changes.
11. Mobile and desktop are intentionally different.
12. No feature is DONE before functional, integrity, security, responsive, regression, and edge-case checks pass.

## 4. UI Direction

The uploaded HTML references are design references, not final layouts.

The rebuild must simplify them.

### Remove visual noise
Avoid:
- long breadcrumbs
- explanatory paragraphs under obvious headings
- duplicate metadata
- too many badges
- too many nested cards
- decorative copy
- status text repeated in multiple places
- large descriptive blocks before primary actions

### Default copy rule
Prefer:
- page title
- section title
- field label
- status
- action

Use helper text only when the user cannot understand the field from its label alone.

Example:

Bad:
"Database Anggota & Person 360 — Pusat master data satu identitas anggota Kelompok Pengorgan lintas program, presensi, jurnal, dan rekam riwayat organisasi."

Preferred:
"Anggota"

Bad:
"Jurnal Musyawarah Pengurus & Tindak Lanjut Keputusan"

Preferred page title:
"Musyawarah"

Tabs:
- Notulen
- Keputusan
- Presensi

### Visual behavior
- clean, calm, high readability
- controlled information density
- consistent spacing/radius/borders
- shadows only for floating elements
- no unnecessary gradient
- no generic SaaS hero blocks inside the app
- responsive mobile-first behavior
- smooth, short transitions
- large enough touch targets

### Themes
Light Mode and Dark Mode are mandatory.

Do not hard-code the final brand hue from the uploaded references.
The implementation must use semantic design tokens so the final palette can be refined later without rewriting components.

Required token groups:
- background
- surface
- surface-muted
- text
- text-muted
- border
- primary
- primary-foreground
- success
- warning
- danger
- info

Dark Mode must be designed intentionally, not produced by simple inversion.

## 5. Navigation

### Desktop

BERANDA
- Dashboard

OPERASIONAL
- Agenda
- Presensi
- Jurnal

PEMBINAAN
- Target & Progres

DATA
- Anggota
- Struktur & Pengurus

PRIBADI
- Catatan

ANALISIS
- Rekap
- Laporan

SISTEM
- Arsip
- Import Center
- Pengaturan

Desktop uses a collapsible sidebar.

### Mobile

Bottom navigation:
- Beranda
- Agenda
- Presensi
- Jurnal
- Lainnya

Quick action:
- Buat Agenda
- Mulai Presensi
- Buat Jurnal
- Jurnal Pengkajian
- Tambah Anggota
- Catatan Baru

Do not force desktop sidebar/table layouts onto mobile.

## 6. Dashboard

Dashboard is role/task-aware.

### Operator
Show:
- Kegiatan Hari Ini
- Mulai Presensi
- Isi Jurnal
- Belum Selesai
- Quick Action

### Admin/Pengurus
Show:
- kegiatan hari ini
- presensi belum lengkap
- jurnal belum selesai
- target tertinggal
- tindak lanjut terlambat
- data belum lengkap
- concise monthly summary

Every metric must drill down to source records.

Avoid decorative analytics.

## 7. Agenda / Event Engine

Event lifecycle:
- DRAFT
- SCHEDULED
- ACTIVE
- COMPLETED
- LOCKED
- CANCELLED

Event can define:
- title
- type
- date
- start/end
- program
- level/class if relevant
- audience
- PIC
- presenter
- location
- attendance requirement
- journal requirement
- documentation requirement
- recurrence

Recurring event editing:
- this occurrence
- this and future
- entire series

Participant membership is resolved using effective dates.

When the session starts, create a participant snapshot.

## 8. Attendance

Statuses:
- BELUM
- HADIR
- IZIN
- ALFA

No Submit button.

Changing status:
- updates immediately
- shows saving/saved state
- can be changed later if permitted
- creates revision history

"Tandai Semua Hadir" only changes BELUM.
It must not overwrite IZIN or ALFA.

Preserve:
- member/person snapshot
- class/level snapshot
- revision
- actor
- timestamp

Offline UI states:
- pending sync
- synced
- failed
- conflict

Conflicting writes must not silently overwrite without revision awareness.

## 9. Journal Family

Journal Center:
- Caberawit
- Muda-Mudi
- Ibu-Ibu
- Pengurus
- Pengkajian Kelompok

### Caberawit
- class journal
- optional individual journal
- multiple material items
- target/realisasi
- evaluation
- follow-up
- documentation

### Muda-Mudi
- activity/topic
- presenter/PIC
- purpose
- implementation
- evaluation
- obstacle
- follow-up
- documentation

### Ibu-Ibu
- activity
- theme
- presenter
- material summary
- implementation
- note
- documentation
- follow-up

### Pengurus / Musyawarah
Tabs:
- Notulen
- Keputusan
- Presensi

Decision:
- decision
- PIC
- deadline
- status
- evidence
- note

### Jurnal Pengkajian Kelompok
Fields:
- tanggal
- waktu mulai
- waktu selesai
- durasi otomatis
- pelaksanaan
- pemateri
- materi dituntaskan
- catatan pelaksanaan
- dokumentasi

Presenter:
- existing AIRO person
- external presenter

Material items:
- nama materi
- bagian/halaman
- status: BELUM / SEBAGIAN / TUNTAS
- catatan

Monthly recap:
- jumlah pengkajian
- total durasi
- jumlah pemateri
- materi tuntas
- materi belum tuntas

## 10. Personal Notes

New module: Catatan.

Purpose:
Quick personal writing that does not need to become an agenda, journal, decision, or formal report.

Default behavior:
- private to owner
- autosave
- searchable
- pin
- archive
- delete
- excluded from organizational reports

Fields:
- id
- owner_user_id
- title
- content
- is_pinned
- status
- created_at
- updated_at
- archived_at
- deleted_at

No category is required.

## 11. Target & Progress

Target is enabled only for relevant programs/categories.

Progress source must be explicit:
- MANUAL
- JOURNAL
- ASSESSMENT
- IMPORT
- ADJUSTMENT

Progress must retain evidence and correction history.

Do not allow AI-generated facts to become official progress automatically.

## 12. Recap & Reporting

Recap dimensions:
- period
- program
- category
- level/class
- person
- event

Every aggregate must allow drill-down.

Reporting engine is shared by:
- dashboard
- recap
- Word
- Excel
- PDF
- PowerPoint

Published reports use versioned snapshots.

Editing historical source data after publication must not silently mutate an already published report version.

## 13. Permission Model

Do not equate organizational position with app permission.

Authorization model:
Identity + Permission + Program Scope

Existing roles are transitional and must be migrated gradually.

Viewer/public access must use safe projections/read models.
Private notes, internal Pengurus details, personal journal notes, audit logs, and write operations must never be exposed publicly.

## 14. Existing Database Audit

Current reusable foundations:
- members
- member_memberships
- attendance_events
- attendance_records
- attendance_changes
- journals
- journal_revisions
- journal_progress
- learning_targets
- target_versions
- classes
- levels
- app_users
- app_sessions
- report_templates

Current redundancy/debt to migrate:
- standalone caberawit master table
- caberawit_progress
- direct level_id/class_id fields on members
- member_categories plus member_memberships overlapping responsibilities
- old audience/role terminology
- journals table carrying too many journal-specific concepts in one flat record
- old navigation/access concepts

No destructive migration is allowed before data mapping and verification.

## 15. Migration Strategy

Use staged migration.

Stage A — Compatibility
- keep existing production reads/writes functioning
- add new structures alongside old ones
- add adapters where required

Stage B — Backfill
- map all existing people to one master person record
- normalize membership history
- preserve snapshots and revision logs
- map legacy Caberawit records
- map old role/audience terminology

Stage C — Cutover
- switch UI/API to new domain model
- verify recap/report parity
- freeze legacy writes

Stage D — Cleanup
- archive or remove redundant legacy structures only after verification

Do not reset production data.

## 16. 30% Foundation Scope

This rebuild is intentionally divided.

### Included in foundation milestone
- approved product/domain specification
- repo rebuild branch
- simplified UI contract
- Light/Dark Mode token strategy
- navigation contract
- event/attendance/journal/notes domain contract
- Supabase migration strategy
- Vercel/repo linkage verification
- acceptance criteria for the foundation
- implementation plan after spec approval

### Deferred to Work implementation
- high-fidelity visual refinement
- full page-by-page redesign
- complete database migration
- full API rewrite
- all report generators
- all import workflows
- full offline synchronization
- complete QA matrix execution

## 17. Foundation Acceptance Criteria

Foundation is acceptable only when:

1. Existing production remains deployable.
2. Rebuild work is isolated from main.
3. Navigation no longer depends on old flat menu assumptions.
4. UI design tokens support Light/Dark Mode.
5. Page templates avoid unnecessary explanatory copy.
6. Person identity and temporal membership are the target source of truth.
7. Attendance architecture retains autosave/revision/snapshot behavior.
8. Journal types are explicit, including Jurnal Pengkajian Kelompok.
9. Catatan exists as an independent private domain.
10. Migration is non-destructive.
11. Supabase RLS remains mandatory.
12. Vercel production is not changed until foundation verification passes.

## 18. Do Not Change Yet

Until the foundation is implemented and verified:
- do not delete production tables
- do not reset Supabase
- do not overwrite production data
- do not remove current production deployment
- do not merge the rebuild branch into main
- do not treat mock data as production data

## 19. Quality Convergence Loop

For each implementation unit:

IMPLEMENT
-> TEST
-> INSPECT
-> GAP ANALYSIS
-> IMPROVE
-> RETEST

Status remains VERIFYING/IMPROVING until material defects are resolved.

DONE requires:
- functional correctness
- data integrity
- permission/RLS correctness
- responsive UI
- Light/Dark Mode
- regression check
- historical integrity
- edge-case coverage
