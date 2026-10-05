# Aeroo connected workflow verification

## Implemented behavior

- A single person ID links explicit category memberships, class/level history, and Pengurus office/section/duties/tenure. Ibu-Ibu is a separate category.
- Attendance edits save per participant without Submit. Pending is separate from Alfa; durable retries preserve revisions and conflicting changes require a visible choice. Meeting rosters retain historical identity and placement.
- Agenda uses concrete recurring occurrences, audience/class/level/selected participants, cancellation, and attendance/journal links. Journals support drafts, completion, archival/restoration, typed materials, class assessments, individual H-only assessments, and governance decisions.
- Targets import atomically into explicit versions. Progress averages only assessed targets and follows meeting chronology. Reports support built-in PPT/Word, split-run placeholders, preview, detail pages, rename/deactivate, and historical placement.
- Public reads use explicit redacted projections. Database RPCs enforce role scope, revisions and atomic writes; failed logins are audited. Imports preserve IDs and reject invalid placements and duplicate records.

## Bugs caught during final verification

- Editing biodata accidentally triggered archive handling when a full member object contained status.
- Future membership changes displaced the current roster before the effective date.
- Editing or cancelling historical selected-participant agendas failed after participants moved or were archived.
- Journal archival revalidated current attendance and could reject a historical record.
- Permanent deletion overwrote historical participant names; snapshots now only fill missing names.
- Manual target save referenced a nonexistent updated_at column and omitted JSON defaults.
- A new class_teachers relationship made member-to-class API joins ambiguous; direct member class joins now name their foreign key.
- Public/managed filters must use effective membership dates; whole-audience attendance recaps must use participant class snapshots.
- Legacy public write/login RPCs and direct mutations bypassed the intended scope; guarded transactions replace them.

## Checks

- 32 application tests passed: autosave queues/retry/conflict, pending attendance, chronology, date handling, recurrence, historical membership, assessments, report XML/Office package validation, and spreadsheet parsing.
- TypeScript validation and production build passed.
- Three live database suites passed in transactions rolled back after assertions: connected workflows, role boundaries, and historical lifecycle/manual targets.
- Dependency audit reported zero known vulnerabilities after updating jsPDF, PostCSS and SheetJS.
- Signed HTTP integration passed for login, member creation/listing, attendance autosave and completed journal. Built-in PPTX (9,839 bytes) and DOCX (8,890 bytes) downloaded and parsed as valid Office packages. Temporary QA records and the QA account were removed afterward.
- Production deployment status is verified after pushing this release.

Tests use isolated QA fixtures. No user data was merged or deleted during migration. Tests are evidence for the covered flows, not a guarantee that every possible defect is absent.
