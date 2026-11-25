# Phase 4 — multi-branch expansion

> Historical phase snapshot. Later-phase status and unresolved baseline requirements are maintained in [REQUIREMENTS-MATRIX.md](REQUIREMENTS-MATRIX.md) and [PHASE-5.md](PHASE-5.md). Statements about future phases below describe the situation when this report was written.
Authorized by the user on 17 November 2026. Release metadata: 0.4.0. This expands the existing single-organization pharmacy database into a branch network; it is not an independently tenanted SaaS platform.

The user confirmed that no approved regulator provider/documentation is available and requested the adapter/export workflow only. Live FBR/POS transmission is therefore intentionally unconfigured. No fiscal IDs, acknowledgements, QR codes or compliance certification are fabricated.

## Branch access and organization administration

- Each online session has an active branch. Backend authentication joins the current branch grant on every request; the user's home role is not used as a union of permissions across branches.
- Branch switching re-authenticates the user, checks assignment and rotates the CSRF token. An open cashier shift must be closed first. The website reloads to clear branch-specific forms and cached views. A nonempty sale cart prevents switching in the UI.
- An employee can be an auditor in one branch and cashier in another. Finance/report capabilities are evaluated using the selected branch role. The network dashboard includes only assigned branches where the user also has reporting permission.
- Organization administrators create branches and assign/revoke branch roles. Grant changes invalidate that user's affected branch sessions. Staff accounts, password resets and account deactivation are organization-administrator operations; deactivation affects all branches.
- Existing OWNER accounts are migrated to organization-administrator status, preserving their prior database-wide backup authority. Normal employees do not inherit that authority. Full-database backup/download/restore requires the organization flag, not merely a branch role.
- New branches have a unique API-controlled invoice prefix, no stock, an unconfirmed tax profile and shared-catalog policy. Pharmacy profile/tax rollout decisions remain branch-specific. Branch creation does not invent tax identifiers or approval.
- The branch selector refreshes assignments when opened, including branches created during the current login.

## Shared catalog

- Migration 004 links existing medicine identities to organization product records. Existing medicine, stock, sale and purchase IDs are retained. The same barcode is now unique per branch, allowing a shared product at multiple stores.
- Administrators can adopt current-branch products into the shared catalog, revise shared names/manufacturer/restricted status with a reason, and publish explicitly to selected assigned branches. Barcode, strength, form and pack identity changes require a separate product rather than relabeling existing stock.
- Migration 005 tracks the version published to each branch; the UI indicates a pending shared revision.
- Publishing adds a missing local medicine/units or updates shared identity on an existing mapping. Existing branch prices and historical sale snapshots are preserved. Existing pack factors cannot silently change. Branch medicine editing remains available for local selling prices, while shared identity changes go through the organization publication workflow.
- Non-administrators cannot create/import local products in a SHARED_ONLY branch. Existing branches retain LOCAL policy to avoid an unapproved legacy catalog cutoff. Catalog governance does not automatically revive a branch-deactivated medicine.

## Stock transfers

- Dispatch validates source branch permissions, destination/catalog availability, batch lifecycle, local expiry and quantity free of offline reservations. It locks medicine/batch rows and commits immutable transfer/line snapshots, source deduction, stock movement and audit together.
- A transfer is in transit until the destination receives it. Receiving is a separate branch-scoped, password-approved transaction with one receipt per transfer. Duplicate retries return the original receipt; altered retries are rejected.
- Receipt preserves original batch code, expiry and per-base-unit cost, creates destination batches with transfer/source ancestry and creates matching receipt movements. It does not create a fake supplier bill/payable in the destination.
- Default receipt disposition is QUARANTINED. Manager/pharmacist/owner quality approval can receive eligible stock as AVAILABLE. Expired/blocked origin stock cannot be released through receipt.
- Returned transferred stock retains source-batch ancestry, so a null purchase origin does not lose traceability or prevent the existing quarantine-return workflow.
- This version receives complete transfer quantities. Partial receipt, shipment cancellation, transport attachments and carrier integration are not claimed implemented. Investigate discrepancies through quarantine and approved count adjustments rather than editing posted dispatches.

## Advanced finance

- Shared chart of accounts, branch-scoped immutable journals/lines, whole-paisa validation, idempotent journal posting, trial balance by as-of date, inspection and audited CSV export.
- Both application validation and deferred PostgreSQL constraint triggers require at least two balanced entries. Database triggers reject edits/deletion of posted journals and transfer history.
- Manual opening/correcting journals are explicit user actions; opening balances are not guessed from a partial history.
- Post operational period derives journals from posted sales, purchases, returns/tax reversals, customer collections, supplier payments, expenses, stock adjustments and transfers. Each branch/source posts at most once, including after retry. Unsynchronized offline transactions remain outside the central ledger until accepted and a later period-posting run includes them.
- Sale tenders debit cash/card/wallet clearing, credit sales and tax, and separately post allocated COGS/inventory. Customer credit uses receivables. Returns reduce receivables/refund tenders and reverse tax/COGS according to original snapshots.
- Legacy adjustment rows created before cost-snapshot migration use their received batch's stored acquisition-cost snapshot, explicitly identified in the posting description; current selling prices are never substituted for cost.
- Dispatch moves cost from source inventory to transit. Receipt clears source transit to an interbranch receivable and records destination inventory/interbranch payable. Per-branch trial balances remain balanced. Network financial-statement consolidation/elimination is not silently performed.
- A journal correction creates one reversing record. It does not cancel a sale, refund a customer, alter stock or change a counted drawer. Re-running period posting does not undo a deliberate journal reversal.
- CSV export requires its own finance-export permission and password confirmation and logs the event. Finance-read alone does not grant export authority.
- Bank-statement matching, fiscal-year close, automated accrual schedules, statutory financial statements and consolidation eliminations remain outside this delivered ledger. Accountant review and a documented opening/cutover policy are required before relying on production balances.

## Supplier suggestions

Suggestions use the selected branch's posted 30-day sale units, reorder threshold, user-selected days of cover and unreserved saleable stock. The suggested supplier/cost basis comes from the most recent real supplier receipt. Missing receipt history is shown as missing information.

This is a transparent replenishment heuristic, not a guaranteed forecast, live quote, best-price claim or automatic purchase order. A manager reviews pack conversions, actual demand, expiry exposure and supplier availability before ordering. No external supplier messages or purchases are sent automatically.

## Adapter and export workflow

- Modes: UNCONFIGURED or EXPORT_ONLY. Provider/documentation fields are configuration notes, not evidence of regulatory approval.
- After explicit administrator configuration, authorized reporting users can create an audited, immutable internal JSON export for their active branch and selected dates.
- The export includes branch profile, invoice lines/totals/tenders/change/credit, and return/refund/debt-reduction records. Patient/customer contact data and card credentials are not included.
- Each export has a UUID, source dates and SHA-256 checksum. Its schema is pharmacy-internal-export/v1 and its regulator_status is always NOT_SUBMITTED.
- No network adapter sends records, no provider acknowledgement is synthesized, and no customer receipt is labeled fiscally registered. Implementing a live connector will require the supplied approved provider contract, credentials, endpoint, acknowledgement/downtime rules, test environment and integration sign-off as a separately reviewable task.

## Recovery and migration

Apply migrations 004 and 005 in order; npm run local does this for the retained demo. Before a production upgrade, preserve an encrypted backup and test the upgrade against a restored copy. Older backups may need schema migrations before a cutover to current application code.

Restore verification now checks invoice/payment/credit reconciliation, batch/movement reconciliation, general-ledger balancing and transfer quantity consistency when the expansion tables are present. Snapshots remain organization-wide and can only be handled by organization administrators. Counter-local SQLite journals and keys still need independent protection; see PHASE-3.md.

## Acceptance and rollout limits

Automated PostgreSQL cases exercise branch assignments, shared publication, cross-branch rejection, offline reservation exclusion, dispatch/receipt idempotency, transferred-stock returns, source/destination cost conservation, operational GL idempotency, reversals, unbalanced-commit rejection and immutable history. Browser UAT covers branch creation/publication/dispatch/receipt, role changes across branches, unauthorized journal/snapshot access, role-scoped network totals, balanced trial balance, audited CSV and checksummed NOT_SUBMITTED exports.

Actual printer/scanner/service-installer UAT, realistic load/security testing, off-device recovery/key custody and organization operating/accounting sign-off remain rollout requirements inherited from earlier phases. The existing demo contains fictional acceptance-test branches/transactions; no real pharmacy records were imported or removed to make tests pass.

Final verification results are recorded below after the complete regression and restore run.

## Verified results — 17 November 2026

- Production TypeScript/Vite build: passed on release 0.4.0.
- Automated suite: 18 passed, 0 failed. Includes real PostgreSQL branch/transfer/finance cases plus all prior transaction, offline durability/replay and encryption regressions.
- Browser suite: 8 passed, 0 failed. Phase 4 UAT verifies new branch creation, fresh selector discovery, shared publication, dispatch/receipt, preserved cost, balanced operational journals, reversal and audited trial-balance CSV.
- Access UAT verifies unassigned switch rejection, a foreign journal returning not found, non-administrator backup denial, reporting scope excluding a branch where the employee has only cashier access, and effective-role change from auditor to cashier after an assigned branch switch.
- Export UAT verifies the downloaded file's NOT_SUBMITTED status and recomputes its SHA-256 checksum successfully. No external regulator endpoint was contacted.
- Full offline PostgreSQL-stop/reload/reconnect testing still passed with branch grants enabled. Full encrypted PostgreSQL restore passed with zero invoice, stock/movement, journal-balance and transfer-quantity mismatches.
- Browser review found and fixed stale branch options after creation; the selector now refreshes on opening. A debounced catalog-search selector in the test was corrected to wait for matching results.
- A dispatch retained by the interrupted selector test was received into its fictional destination's quarantine through the normal audited receipt service. It was not deleted or overwritten to clear the test.
- Screenshots were reviewed for the general-ledger page. Phase 4 transfer, finance, suggestions, integration and recovery artifacts are retained in ignored test-results/.

These are demo engineering/UAT checks. They do not certify production hardware, statutory accounts, regulatory compliance, workload capacity or independent penetration testing. All four implementation phases have working software; the rollout items and explicit scope boundaries above remain reviewable requirements.
