# Phase 2 — operational controls

> Historical phase snapshot. Later-phase status and unresolved baseline requirements are maintained in [REQUIREMENTS-MATRIX.md](REQUIREMENTS-MATRIX.md) and [PHASE-5.md](PHASE-5.md). Statements about future phases below describe the situation when this report was written.
Authorized by the user on 17 November 2026. Phase 3 offline synchronization and Phase 4 expansion remain unstarted. This phase does not retroactively certify outstanding Phase 1 hardware, Windows packaging, tax configuration or UAT.

## Delivered scope

- Returns against original invoice lines, with password approval, quantity caps, retry deduplication and exact discounted/taxed refund entitlement. Full returns cannot exceed the original invoice value. Original sales remain immutable. Return batches are separate QUARANTINED records linked to the original allocations; saleable stock is not silently increased. Restricted products require owner/pharmacist permission.
- Cashier shift opening and signed closing. New sales require an open shift. Expected cash = opening float + cash sales after change + cash customer collections - cash refunds - cash expenses/supplier paid-outs. Counted cash, zero/nonzero variance, reason and sign-off persist in immutable closing records. The same shift cannot close twice. Historical Phase 1 sales remain unchanged and are not assigned retroactively to shifts.
- Customer accounts with approved credit limits, partial/full credit sales and invoice-specific collections. Returns reduce outstanding debt first and refund only the remaining paid portion. Collections cannot exceed remaining invoice debt.
- Supplier account movements, outstanding purchase invoices and invoice-specific payments; overpayment is blocked. Aging currently uses invoice age with immediate due terms, explicitly shown in the UI. Negotiated terms and historical opening balances require an approved migration rather than invented balances.
- Authorized expense posting with category, amount, tender, reference and reason. Cash expenses reduce the posting user's open drawer.
- Physical stock-count snapshots with mandatory second-person approval. Stale snapshots are rejected. Variance postings and before/after audit records preserve stock history.
- 90/60/30-day expiry lists; automatic AVAILABLE-to-EXPIRED lifecycle processing; authorized recall, quarantine, damage, disposal and release decisions with reasons/re-authentication. Disposal writes off remaining quantity through a movement. Expired stock cannot be released for sale.
- Searchable branch-scoped audit review with paging, actor/time/action/entity and expandable event details. Financial/audit records remain protected against updates and deletion by database triggers.
- AES-256-GCM encrypted database snapshots, schedule configuration, visible success/failure, encrypted download and isolated restore verification. Snapshots include schema/application version and checksums. Wrong keys, tampering and malformed archives are rejected. Restore always creates a new database; it never overwrites live sales. Restored sessions are revoked and invoice/stock reconciliation is checked.
- Daily reports deduct posted returns, reverse the associated tax and allocated cost, and display refunds separately from credit reductions.

## Operational configuration

`npm run local` applies ordered migrations and creates a random BACKUP_KEY in the ignored `.env` if missing. Retain that key securely and separately: encrypted archives cannot be recovered without it. No credentials are stored in source or passed to PostgreSQL utility arguments.

The development backup destination is `backups/` in this workspace. Set BACKUP_DIRECTORY to an administrator-managed off-machine encrypted storage location, then declare BACKUP_OFF_DEVICE=true only after verifying it. The UI displays whether an off-device destination has been confirmed. A local snapshot alone is not disaster recovery.

Windows tools: run `powershell -File scripts/install-pg-tools.ps1` to obtain official PostgreSQL utilities from the EDB distribution. Existing utilities were installed into the ignored `.tools/pgsql/bin` for this delivery. Source and downloaded archive SHA-256 are recorded in `.tools/source.json`; this is an inventory checksum, not an independently published vendor signature. Official distribution references: https://www.postgresql.org/download/windows/ and https://www.enterprisedb.com/download-postgresql-binaries . On other hosts install matching PostgreSQL client utilities or set PG_DUMP_PATH / PG_RESTORE_PATH.

Maintenance checks run at startup and once per minute while the API server is running. Default backup interval is 24 hours and can be changed by the owner. Run the server as a supervised service for uninterrupted scheduling; shutting down the counter/server stops the scheduler. No capacity or RPO/RTO claim has been measured from the small demo dataset.

## Recovery procedure

1. Sign in as owner. Open Backups & recovery; confirm a successful snapshot and independent off-device copy.
2. Choose Verify restore and re-enter the owner password. A `restore_<uuid>` database is created alongside the source. Live transactions are preserved.
3. Review invoice count, return count, zero stock mismatches and zero invoice mismatches. Review sample invoices against the original system and physical records.
4. A real incident cutover requires a planned maintenance window, preservation of newer transactions, correct keys, database access configuration and authorized switching of DATABASE_URL. The app deliberately provides no silent in-place overwrite.
5. Verification databases are retained for inspection. An administrator may remove only an explicitly identified verification database after review. This delivery does not automatically delete data.

## Acceptance and boundaries

Automated tests cover Phase 1 regressions and Phase 2 monetary rounding, return caps/retries/quarantine, customer credit/collections/debt reduction, supplier overpayment/idempotency, second-person stock approval/stale snapshots, signed cash closing, automatic expiry, movement reconciliation, append-only history and encrypted-backup authentication. Browser acceptance covers user workflows and a real PostgreSQL restore drill. Final measured results are recorded after validation below.

Production rollout still requires owner/manager/pharmacist UAT, actual 80 mm printer/USB scanner checks, deployment security review, off-device backup access, key-custody agreement and a timed recovery drill on realistic data. Full double-entry general ledger is outside the baseline. This version records manual approved expenses; attachment uploads, negotiated account terms, supplier stock-return/credit-note workflows and account opening-balance migration remain tracked extensions and are not claimed implemented.

## Verified results — 17 November 2026

- Production TypeScript/Vite build: passed.
- Automated tests: 12 passed, 0 failed. The PostgreSQL integration case includes concurrent/idempotent sales, return caps/retries/quarantine, customer credit/collection/return debt reduction, supplier overpayment prevention, count approval/stale snapshot rejection, cash closing, auto-expiry and movement reconciliation.
- Playwright browser journeys: 5 passed, 0 failed. Includes Phase 1 checkout/admin regressions; returns/credit/expenses/audit/cash closing; second-person stock approval/supplier payment; encrypted snapshot and real isolated PostgreSQL restore.
- Restored snapshot reconciliation: zero invoice mismatches and zero stock/movement mismatches. Demo invoices/returns were retained; source/live transactions were not overwritten.
- Screenshot review performed for the backup/recovery page. Artifacts are in ignored test-results/.
- Initial backup attempts correctly recorded FAILED when native utilities were missing. The official utilities were installed, backups then succeeded, and the successful restore drill completed. Failed attempts remain visible rather than being erased.

These results verify the demo implementation; they do not substitute for site-specific production sign-off, off-device recovery or hardware testing. Phase 3 and Phase 4 were not started.
