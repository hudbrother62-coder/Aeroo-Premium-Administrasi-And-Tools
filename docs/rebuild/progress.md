# AIRO v3 implementation checkpoint
Base: ad5742430e712e829cfbb4cb7d05028ac9736d03
Branch: rebuild/airo-v3-foundation
Spec: docs/superpowers/specs/2026-10-06-airo-rebuild-design.md

## Queue
- RUNNING: private notes, serialized autosave, owner RLS, revision conflict checks.
- RUNNING: explicit Pengkajian journal, presenter/material status/duration, monthly recap.
- QUEUED: semantic themes, grouped navigation, mobile primary links, collapsible desktop sidebar.
- QUEUED: organizational positions separate from permission and membership.
- QUEUED: central archive/import entry points and operational dashboard.
- QUEUED: shared recap/export dataset and report snapshots.
- QUEUED: build, regression, database integration, responsive inspection, preview deployment.

## Decisions
- Preserve existing production data and legacy RPC behavior. Add domains alongside existing ones.
- Rebuild branch is the only write target; main remains unchanged until verification.
- Keep existing custom session authorization; new private data uses current_app_user_id, not auth.uid.
- Old SQL migrations contain stale descriptions; active v3 spec is authoritative.
- No fabricated percentage. Verified deliverables determine completion.

## Evidence
- 2026-10-06: fetched and cloned exact foundation branch; SHA confirmed.
- Domain tests RED: missing studyDuration/studyRecap/noteInput, then GREEN 3/3.
