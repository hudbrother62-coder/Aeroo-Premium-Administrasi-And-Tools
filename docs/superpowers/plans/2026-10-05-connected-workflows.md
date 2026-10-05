# Aeroo Connected Workflows Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development for scoped report implementation and review; coordinator owns data and integration.

**Goal:** Ship unified people/memberships, autosaving attendance and connected agenda/journals/reports.
**Architecture:** Preserve members IDs. Add scoped memberships and historical meeting rosters. Transactional RPC attendance patches with revisions prevent overwrites. Public read RPC redacts private data and excludes Pengurus. Existing server cookie sessions remain.
**Tech Stack:** Next.js 15, Supabase Postgres/RLS, React 19, JSZip/docx.
**Spec:** User-approved conversation requirements summarized below.

## Global Constraints
- One person, multiple categories and per-category class/level placements; Ibu-Ibu explicitly selected, never inferred from Caberawit/Muda-Mudi.
- Attendance autosaves without Submit. Pending differs from Alfa, network and revision conflicts remain visible.
- Agenda recurring occurrences and journals reference attendance meeting; historical class preserved.
- Viewer no login reads allowed menus, never Pengurus or contact/address/birth data.
- PPT built-in plus uploaded split placeholders, repeated rows/slides, preview and template management. Button Cetak and no Gemini branding.
- Preserve existing IDs/history, no source data deletion, do not merge by name.

## Review Focus
- Two writers/retries cannot lose attendance or create duplicates.
- Category filtering/roster cannot leak private offices and journals.
- Missing attendance/assessment never becomes zero or Alfa.
- Imports cannot silently drop unknown class or duplicate IDs.
- Recurrence exceptions and archived people preserve past meeting data.

### Task 1: Data and attendance
Files: migration, lib/domain.ts, attendance API and pages, membership API/database pages.
- [x] Add failing domain tests for pending attendance, progression and membership filtering.
- [x] Add memberships, meeting roster snapshots, atomic revision updates and change history.
- [x] Implement unified database fields and autosave UI with per-person queues/conflicts/retry.
- [x] Verify SQL transactional rollback scenarios and domain tests.

### Task 2: Reports
Files: lib/report-template.ts, report API routes, app/laporan/page.tsx, tests/report-template.test.cjs.
- [x] Reproduce split placeholder failure.
- [x] Implement split text replacement and default PPT, per-person details, preview and template deactivate/rename.
- [x] Share progression calculation with domain and remove Gemini labels.
- [x] Run tests and TypeScript verification.

### Task 3: Agenda and journals
Files: agenda/journal APIs and pages, target/recap routes.
- [x] Add recurrence tests and version-aware progression tests.
- [x] Implement concrete recurring meetings, audience/selected participants, cancellation and journal linkage.
- [x] Implement typed journal forms, batch individual entries, revisions, draft/completed and CRUD.
- [x] Verify range, timezone, roles, and connected data behavior.

### Task 4: Integration and release
- [x] Public allowlist API and redacted pages.
- [x] Import validation, full biodata editing, levels/classes management and login failure audit.
- [x] Run all tests/build; independently review and resolve findings.
- [ ] Apply migration, verify via rolled-back SQL fixtures, push GitHub, verify Vercel READY and live routes.
