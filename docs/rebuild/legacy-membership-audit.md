# AIRO legacy membership audit — 2026-10-06

Baseline branch: rebuild/airo-v3-foundation, 7ebb1c9.
Status: VERIFYING. Production promotion requires signed-in UI acceptance.

## Findings and fixes
- P0: create_muda_mudi_member accepted anonymous calls because its old role comparison did not reject SQL NULL. Route it through current permission checks and save_member so temporal membership is always created.
- P0: membership SELECT policies ignored revoked person.read. Require can_read_member and the actual audience scope; disallow direct writes to compatibility membership/category tables.
- P1: organizational positions still mirrored retired Pengurus categories, so saving positions failed. Keep historical position revisions while removing the obsolete mirror dependency. Attendance already resolves positions directly.
- P1: unchanged historical agendas could not be cancelled after participant archival. Preserve the original participant scope for status/title updates; validate new or changed scopes and retain existing roster immutability guards.
- P1: signed-in placement and category projections could use stale cached legacy fields. Derive them from date-effective program memberships.
- P1: exports, duplicate detection and completeness used active flags rather than effective dates. Align with temporal membership semantics; general members may have no program.
- P1: target gaps omitted scheduled transitions and counted cleared/invalid evidence as assessed. Respect latest chronology, actual zero, cancelled events and attendance eligibility.
- P1: old database quick-edit and Pengurus section paths remained. Remove unused paths and route class moves through the guarded batch endpoint.
- Recover live SQL migration records missing from source control, without resetting application data.
- Browser QCL found that login redirected anonymous viewers because /api/auth/me returns HTTP 200 for public identities. Redirect only an active, non-public identity with a user ID.

## Evidence
- The anonymous creation and revoked-read vulnerabilities were reproduced in rollback transactions before applying fixes; the regression suite now passes.
- SQL suites passed: database-integration, database-roles, database-lifecycle, database-v3, database-legacy-membership.
- Lifecycle deletion expectation was updated to the current requirement: operational history blocks permanent deletion; archival preserves snapshots and assessments.
- Position fixtures now use general persons with zero program memberships; positions do not create synthetic membership categories.
- 42 Node tests passed; TypeScript passed; Next production build passed.
- Live production database has zero members and zero memberships; all SQL test fixtures were rolled back.

## Remaining release gates
- Signed-in browser checks: members, import, notes, positions, study journals, report download and native evidence upload.
- Mobile/theme visual checks and actual offline reconnect/conflict flow.
- Verify final preview deployment, then promote exactly that verified commit to production.
- Remote browser opened the READY preview using a temporary Vercel share link. Public dashboard rendered; login redirect regression was reproduced and fixed. Authenticated acceptance remains pending. No production promotion has been performed.
