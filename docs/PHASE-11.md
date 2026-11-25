# Phase 11 - activity audit filters

Authorized as the next sequential increment after Phase 10. Source: 0.11.0-dev.1. Verification date: 20 November 2026. Status: this software increment is complete.

## Workflow

Activity audit now combines its existing action/record/actor-name text search with an inclusive Pakistan-local date range, exact action and actor identity. Either date may be left open. Invalid dates, reversed ranges, oversized text and invalid actor IDs are rejected. Action/actor options come only from events in the selected branch, including historical inactive staff and system events with no actor. Identical actor names display an ID suffix for selection; names remain current user names rather than historical snapshots.

Filters reset pagination to the first page. Responses remain limited to 50 events, ordered by timestamp descending and ID for ties. Background responses from an older filter are ignored; previous rows clear while loading or after validation failure so they cannot appear to match an invalid filter. Refresh audit reloads events/options; Clear audit filters restores the unfiltered view. Event details can be expanded in the table.

Options describe available branch history, not just events in the current date window. An exact actor filter uses its identity even if its display name later changes. System selection matches only null actors. Branchless global/login events remain excluded by the existing branch boundary. Reads do not mutate audit history, financial postings, stock or session inactivity policy. Existing operational report exports remain available separately; this increment adds no raw-audit export or retention/deletion workflow.

## Access and compatibility

GET /api/audit-events retains its array response and existing query/offset inputs, adding optional from/to/action/actor filters. GET /api/audit-options returns branch action names and historical actor identities without exposing usernames or unrelated user records. Both require audit-read permission under the selected session branch; cashiers remain denied. Existing CSRF/authentication rules apply.

Migration 012 adds branch/action/date and branch/actor/date indexes without rewriting events. Date predicates use the half-open UTC interval corresponding to inclusive Asia/Karachi days. No historical audit updates or financial schema changes are introduced. Offset pages are deterministic for unchanged data; new events arriving between pages may shift offsets, so refresh and refilter when reconstructing an investigation. There is no frozen investigation snapshot or forensic completeness certification.

The frozen Phase 5 Windows archive is unchanged. Apply ordered migrations before running current source. This increment addresses the dedicated raw-event browser filter gap in FR-006; full endpoint security review, external monitoring and other requirements remain tracked separately.

## Verification

The final production build passed. All 31 automated checks are verified: the first run passed 28, while three database checks were affected by disk exhaustion; all affected files passed a sequential rerun (six checks including their input tests). All 19 browser journeys are verified: 18 passed in the full run, and the remaining branch-transfer journey passed after its test helper was corrected to wait for the branch-switch reload. The audit dropdowns use explicit labels after dedicated browser verification exposed an implicit-label selection issue. No assertions, access rules or timeouts were weakened. The new database checks cover Pakistan midnight boundaries, combined filters, exact actions, null/system and inactive actors, branch exclusion, pagination tie order and immutable events. The browser journey exercises combined date/action/actor/text filters, details, invalid-range clearing, reset and cashier denial.

The workstation ran out of disk space while creating isolated test clusters. Stopped historical test/load databases were compressed with NTFS compression, retaining their files and records; the development database was excluded. About 2.1 GiB remained free at handoff. Compression stopped after sufficient space was recovered. Migration 012 was applied to the retained demo database. The audit screen was visually reviewed at 1366 x 768; its ephemeral capture is test-results/phase-11-audit.png. Local Markdown document links resolve. Temporary demo services were stopped after verification.

## Handoff

Open Activity audit, enter a text query and optional dates/action/actor, then inspect matching records and expand View event details. Dates use Asia/Karachi; blank dates leave that boundary open. Use Previous/Next audit events to page and Refresh audit to load newly posted activity.

Physical printer/scanner and off-device recovery checks remain user-deferred. Operator acceptance and production approval remain pending. Phase 12 has not started.
