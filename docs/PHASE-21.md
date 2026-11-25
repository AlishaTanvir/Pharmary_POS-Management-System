# Phase 21 - Controlled account opening balances

Authorized as the next sequential phase after Phase 20. Source: 0.21.0-dev.1. Verification date: 23 November 2026. Status: software complete within the documented account-opening scope. Field acceptance and production approval remain pending.

## Supported policy

This phase addresses customer/supplier account opening entries, allocated settlement, aging, corrections and reconciliation in the SRS and proposed roadmap. It imports independently evidenced outstanding account amounts without creating artificial sales, purchases, stock receipts, tax or revenue. It does not infer a migration cutoff or calculate a prior ledger balance automatically.

Each opening identifies the selected branch, customer/supplier, unique account-local evidence reference, effective posting date, original due date, signed whole-paisa amount and reason. Positive customer balances are receivables; positive supplier balances are payables. Negative amounts represent account credits owed in the opposite direction. Amounts must be nonzero and within 100,000,000,000 paisa per source. Multiple separately evidenced documents can be imported for a single account. Matching references are rejected even with a new retry key. Posting dates cannot be future dates; due dates can retain original terms independently.

Before posting, verify the source statement and confirm the amount is absent from existing POS invoices and manual opening journals. The interface requires acknowledgment; the service validates source identity, bounds and references. It cannot detect duplicate debt imported under unrelated references or a previously posted unallocated manual journal. No actual pharmacy opening amounts were invented or imported during development: acceptance records are fictional.

Opening import can record evidenced debt above an existing approved customer limit; it does not raise that limit. Subsequent credit sales include the current signed opening balance when enforcing the limit. Account directories, current balances and aging combine openings with existing operational balances. Aging uses calendar days past due in Pakistan: due today/future is Current, then 1-30, 31-60, 61-90 and over 90. Signed credits remain visible in the appropriate bucket. Original operational invoices and their existing payment allocations are preserved.

## Settlement and correction

Opening settlements allocate to one opening record, with an immutable evidence reference, reason, date and tender method. The entered amount is positive; the source's direction determines cash received versus cash paid. A settlement cannot exceed the remaining absolute balance or cross zero. Events cannot precede the opening or its latest event. Cash settlements require the actor's currently open branch shift and today's effective date. Wallet/card identify payments made outside the app; the app does not charge or transfer funds.

Cash direction is included in shift closing: customer collections increase cash, customer-credit refunds decrease it, supplier payments decrease it and supplier-credit receipts increase it. The cash-management labels identify net opening-credit effects. Noncash settlement needs valid branch access but no open cash shift. Opening imports/corrections never change cash-drawer totals.

Corrections cancel the entire unpaid remainder against opening equity. They require the reviewed expected remainder, reject stale previews, preserve settled amounts, and never refund/reverse an actual payment. A replacement is a new separately evidenced opening with its own reference and date. A fully settled/corrected record cannot be settled or corrected again. A wrong real payment requires an approved accounting/operational correction outside this cancellation workflow; this phase does not add a payment-reversal or automatic credit-to-invoice allocation feature.

Row/advisory locks serialize source changes and retries; customer account locks serialize opening changes against new credit sales. Same-key/same-intent retries return the original ID. Changed intents reject with a conflict. Imports, events, matching journals and audit records commit together or roll back together. All original opening and event records are append-only.

## General ledger and reconciliation

Openings post immediately: customer debt debits 1100 Customer receivables and credits 3000 Opening equity; supplier debt debits 3000 and credits 2000 Supplier payables. Account credits reverse those directions. Settlement offsets the appropriate control account against cash/card/wallet clearing (1000/1010/1020). Remainder corrections offset the control account against 3000. These sources are excluded from operational reposting, so later Post operations does not duplicate them.

Migration 018 adds opening_balances, opening_balance_events, their current-position view, indexes, immutable-history guards and deferred source/journal component checks. New sources require their matching dated two-line journal; balanced but incorrectly classified components and foreign-branch source journals are rejected. Both service and database prohibit generic journal reversals of opening sources; use the linked correction workflow. Existing invoices, payments, customer entries, supplier entries and journals are not backfilled or rewritten. Run the ordered migration with a compatible app; older versions do not understand the new balances. The frozen Phase 5 release is unchanged.

Account ledgers show opening records separately from operational invoices, alongside combined movements and aging. The branch reconciliation view accepts an as-of date and exposes per-account opening totals, opening-only GL/subledger differences and full AR/AP control-account differences. Opening events use effective dates; ordinary operational movements use their recorded Pakistan dates. Descriptive account names are current master references. Full differences may include unposted operational periods or unallocated manual journals; the UI reports them rather than inventing adjustments. This is account reconciliation, not bank reconciliation or a complete opening trial balance for cash, stock, tax and other accounts.

Restore verification additionally checks opening source/account identity, position bounds and exact source-to-journal components, orphan opening journals and forbidden generic reversals. This matters because restored rows are not validated simply by loading constraint triggers. Older backups without opening tables retain the prior verification path. Restore checks remain isolated from the live database; off-device disaster recovery is still unaccepted.

## Access and API

- POST /api/opening-balances: ledger-write plus finance-write; owner/accountant and current-password confirmation.
- POST /api/opening-balances/:id/settlements: ledger-write; owner/manager/accountant and current-password confirmation.
- POST /api/opening-balances/:id/correct: ledger-write plus finance-write; owner/accountant and password; expected_remaining_paisa must match the reviewed balance.
- GET /api/opening-balances/reconciliation?as_of=YYYY-MM-DD: ledger-read plus finance-read; assigned-branch owner/manager/accountant/auditor.

Existing GET /api/ledgers/:kind/:id, GET /api/customers and GET /api/supplier-balances incorporate opening positions. Session, selected-branch, CSRF and role checks remain. Cashiers/clerks cannot use these new routes. The generated inventory has 151 declared routes and 138 session routes; the isolated access matrix passed 79 write-CSRF and 505 denied-role checks. Confirmation passwords are cleared in the form at submission and excluded from domain hashes/audit payloads.

## Verification

The final TypeScript/source-inventory/Vite build passed. All 53 backend tests passed. New isolated PostgreSQL coverage includes migration over a pre-existing invoice/journal, both debt/credit directions, legacy preservation, original/differing retries, duplicate references, branch/date bounds, partial/concurrent settlement caps, stale corrections, effective-date reconciliation, all four cash directions, shift closing, credit-limit enforcement, operational posting, exposed manual-control differences, immutable history, missing journals, forbidden generic reversal and foreign-source rejection. The opening restore-integrity query returns zero mismatches on this exercised data.

The new browser journey passed independently on the retained development database. It covers customer/supplier creation, signed openings, due-date aging, retry/conflict, settlement, overpayment rejection, remaining-balance correction, retained payment history, historical/current reconciliation and cashier denial. All 31 browser journeys passed together in the final complete run (4.6 minutes), including online recovery, actual PostgreSQL outage/offline replay, operational finance and encrypted isolated restore with opening-integrity checks. The run used a separately named, freshly seeded database, SQLite store and backup directory. Its non-secret database/evidence locations are retained in .local/phase21-acceptance-run.json; all financial acceptance data is fictional.

Retained-fixture runs exposed the existing 20-active-draft quota and first-100-result catalog-selector limit. Eighteen identified fictional recovery drafts were cleared through the audited domain workflow; two other drafts and all financial history were retained, and the quota was unchanged. The catalog pagination gap is tracked in the requirements matrix/roadmap. A clean run also exposed a keyboard test relying on previously confirmed pharmacy setup; that test now explicitly establishes its fictional profile/tax prerequisite. These preparation findings are distinct from opening-balance accounting acceptance. Clean-fixture checks do not certify larger-catalog selection.

Five final targeted opening/access tests passed after the Pakistan-midnight ordering fix, including rejection of a balanced but misclassified opening journal. Existing test failures were investigated and were not counted as passing results.

Visual review passed for the ledger/reconciliation panel and opening form at desktop (1366/1440 pixels) and narrow (390 pixels) widths. A final CSS-only correction places the evidence textarea below its label at full available width; the build and nonposting desktop/narrow previews then passed again. Screenshots are retained at test-results/phase-21-opening-balances.png, test-results/phase-21-opening-form-desktop.png and test-results/phase-21-opening-form-narrow.png. No preview submitted another financial entry. Local documentation links were checked. The acceptance API was stopped after verification.

## Handoff and remaining work

Open Account ledgers, choose an account, then Record opening balance. Read the evidence/double-counting guidance, choose direction and dates, review the amount and sign off. Use Settle opening for real funds received/paid; use Correct remainder only for the unpaid import error. Inspect combined aging/movements and Branch opening and control-account reconciliation before accounting sign-off. Keep original supporting statements independently.

Phase 22 is the proposed bank-reconciliation package. Five proposed phases (22-26) remain after Phase 21 software acceptance. Automatic invoice-credit allocation, reversal of real opening settlements, a complete historical trial-balance migration and accounting-period locks are not added by this phase. Historical classification, currency policy, deployment qualification and user-deferred printer/scanner/off-device acceptance remain separately tracked. Phase 22 has not started.
