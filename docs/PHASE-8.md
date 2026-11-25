# Phase 8 - controlled physical counting

Authorized by the user's request to proceed after Phase 7. Current source: 0.8.0-dev.1. Status: this software increment is complete. Scope: batch count sheets, blind entry/printing, variance escalation and stronger snapshot safety. Physical printer/off-device recovery checks remain deferred; no production acceptance is inferred.

## Workflow

Stock counts now includes count sheets filtered by existing shelf/location, medicine form and product name/SKU/barcode. Each sheet captures immutable per-batch identity, expiry, location, lifecycle status, book quantity and movement-count snapshots. Form is the current medicine classification filter; a separate category hierarchy is not introduced. Matching more than 500 batches is rejected with instructions to narrow the filters; rows are not silently omitted.

Counters enter physical base-unit quantities, including an explicit zero, and a reason. Expected quantities and variances are omitted from non-approver sheet responses. Authorized supervisors can reveal comparison fields for review. A separate printable projection contains only batch metadata and blank count/reason fields, even when printed by an owner. Printing records an audit event and uses browser print/save-to-PDF; physical printer compatibility is not certified.

Blind counting is an entry/display procedure, not a confidentiality restriction on other inventory screens the user is already authorized to access. Every adjustment still requires a different authorized approver. Low/zero variances are never automatically posted.

Sheet creation is idempotent by its branch/key/input/creator. Line submission is once-only by sheet line; an identical retry by the original counter returns the same count record. Changed input or a different counter's attempt cannot replace an existing submission. Submission itself changes no stock. Approval continues through the existing immutable count/approval/movement/audit pipeline.

Sheets reserve no stock, have no global till lock and remain historical snapshots. New receipts/batches after creation are not silently added. Changed rows require a new sheet and physical recount; superseded/incomplete sheets are retained. Submitted-line progress is not approval or a whole-store sign-off. Names, locations and lifecycle status describe the captured sheet.

## Approval policy and safeguards

The owner profile adds **Owner approval at count variance (base units; 0 disables escalation)**. With a nonzero threshold, absolute variance at or above it requires an OWNER approver. A manager remains eligible below that threshold, subject to the different-person rule. The limit uses physical base units, not currency or a percentage. API updates that omit the new policy preserve the existing value.

New single-batch counts and count-sheet lines capture the number of committed movements at snapshot time. Submission/approval checks both quantity and that movement count, so stock moving out and back to the same quantity still invalidates an old snapshot. Direct `/api/stock-counts` clients must supply `snapshot_movement_count` from the batch snapshot. Older pending records without that snapshot cannot be approved; take a fresh count. Already-posted approvals and financial history are retained unchanged.

Outstanding offline stock reservations block sheet creation, submission and count approval until the reservations have been synchronized/finished. This prevents an adjustment from competing with unsynchronized physical sales. Disposed/returned closed batches cannot be counted back into stock. Approval retains the existing lifecycle state and cannot release quarantined/expired stock for sale.

Use a low-activity counting window and finish offline pools first. No automatic freeze, cancellation of prepared stock or deletion of old counts is performed. Branch-owner profile editing remains available, while employee administration controls require the organization-administrator flag.

## Data, permissions and verification

Migration 009 adds the branch threshold, count movement snapshot, immutable sheets/lines/submission linkage and the branch sheet index. Count-sheet routes require inventory-count permission and use the selected branch. Cost data is not part of these sheets. Older binaries that do not enforce these controls must not be used against the upgraded database; rollback needs explicit schema/policy compatibility review. Actual adjustment approval requires inventory-approval permission plus password confirmation, current threshold checks, two-person separation and fresh stock validation.

The isolated PostgreSQL tests cover idempotent concurrent submissions, blind projections, branch isolation, no stock change before approval, owner escalation, self-approval refusal, out-and-back stock changes, legacy recounts, offline reservation protection and immutable history. All 25 automated checks passed. The new browser journey covers clerk entry, printable projection, owner profile policy, policy preservation on older profile payloads, manager denial, owner approval and physical stock/movement reconciliation. Final production build passed. All 25 automated tests and all 16 browser journeys passed in the clean final run (browser suite approximately three minutes). An earlier full run was interrupted by browser/network suspension; no test timeout or application control was weakened. The count-sheet layout was visually reviewed at a 1366 x 768 desktop viewport; the screenshot was captured to ephemeral test-results/phase-8-count-sheets.png. Migration 009 was applied to the retained demo database. Markdown links were checked.

## Handoff

Open **Stock counts**, create a filtered blind count sheet, enter the physical quantities/reasons, then have a different authorized supervisor review and approve. The profile threshold is configured under Administration. Existing pending counts without movement snapshots require fresh counts before approval. Remaining optional/narrative SRS work and site acceptance remain tracked separately in REQUIREMENTS-MATRIX.md and the pilot checklist.
