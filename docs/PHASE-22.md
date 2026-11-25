# Phase 22 - Bank statement reconciliation

Authorized as the next sequential phase after Phase 21. Source: 0.22.0-dev.1. Verification date: 23 November 2026. Status: software complete within the documented single-PKR-bank reconciliation scope. Field acceptance and production approval remain pending.

## Supported scope and baseline

The SRS describes bank reconciliation as an optional advanced-finance enhancement; this phase implements the bank work package in the proposed roadmap. The Bank reconciliation workspace compares normalized statement evidence with posted general-ledger entries. It never connects to a bank, initiates payments, confirms an external transfer or infers legal/tax treatment.

The supported ledger is account 1030 Bank, in PKR, separately scoped to the selected branch. Each branch reconciles one bank alias against that control. Multiple physical bank accounts sharing 1030 must not be mixed into this workflow. Distinct bank subaccounts, FX, bank feeds, PDF/OFX/MT940 parsing and automatic file-format/sign detection are outside this increment.

The first statement requires its opening balance to equal the posted bank balance before the statement start. Independently resolve earlier outstanding items and verify this baseline before starting reconciliation history. Prior-period individual entries are baseline history, not newly matched statement items. This does not prove that undocumented earlier history was cleared. An unexplained initial difference must be investigated rather than hidden in an automatic adjustment.

Only one statement can be open per branch. After a close, the next statement must start the next calendar day, use the same alias and open at the previous statement closing. Periods cannot overlap or skip days and cannot end in the future. The bank alias is descriptive evidence, not a bank account identifier verified by the app.

## Statement import and matching

Use the exact normalized CSV header date,reference,description,amount_pkr. Dates are YYYY-MM-DD and must fall inside the statement period. Amounts use a signed decimal point with at most two decimal places: inflows to the pharmacy bank asset are positive; outflows are negative. No debit/credit column convention is inferred. Each row needs a reference and description. Repeated references can be legitimate; physical row positions identify separate lines.

The preview validates all submitted text and shows its first 20 rows, line count and movement/closing totals. Import retains the submitted UTF-8 CSV text and its SHA-256 checksum, immutable normalized lines, alias, period, opening/closing amounts, evidence reference, reason and actor. This checksum covers submitted text, not a bank's original binary file or digital signature. Limits are 1,000 lines and 500,000 CSV characters (the file picker uses a conservative 500,000-byte limit), at most 100,000,000,000 paisa per nonzero row and 100,000,000,000,000 paisa for balances. Header-only, zero-activity statements are supported. Opening plus signed movements must equal the supplied closing. A unique branch-local evidence reference and retry hash guard repeated imports.

Matching is explicitly reviewed. One statement line can match 1-100 original bank journal lines whose signed total equals it exactly. Eligible entries belong to the same branch/control, fall no later than the statement end and are inside the established reconciliation baseline. Prior unmatched book entries carry forward; already cleared entries cannot be reused. Same-amount candidates are hints only; dates and references still need independent review. A book entry cannot be partially split across statement rows. Several statement lines cannot be combined into one match in this increment.

An internal offset group can clear at least two bank book lines with an exact zero sum without inventing a statement transaction. This supports reviewed reversal/offset pairs. Match releases are new immutable records with reasons; they preserve original matching history. Closed-period matches cannot be released. Concurrent matches serialize against the branch bank lock, and database checks reject duplicate active matches, wrong branches/accounts/dates and amount differences.

## Controlled adjustments and exceptions

Unmatched statement lines block closing. Investigate the source first: operational card/wallet collections do not automatically become bank deposits. Post evidenced clearing/settlement journals explicitly and match their bank legs.

For an evidenced statement-only item, authorized finance writers can post one adjustment per statement line. The whole statement amount becomes a two-line journal and is atomically matched. Permitted offsets are 6100 Bank charges (outflows), 7100 Bank interest income (inflows), 1010 Card clearing or 1020 Wallet clearing. Receivable/payable, inventory and cash-drawer offsets are excluded. The posting date must be within the statement period and no later than today. There is no automatic balancing plug, unexplained write-off or inferred tax deduction.

Bank adjustments are general-ledger postings. They do not create operational expense records, customer/supplier settlement allocations or cashier shift movements; consult the posted ledger for their bank-fee/interest effects. Posted adjustments are immutable. Correct their classification or reverse an erroneous entry with a separately evidenced journal under existing finance controls; bank dates already closed require a later correcting date. Released matches do not undo a real journal. Clear resulting zero-sum bank pairs explicitly when appropriate.

An unclosed statement can be cancelled with a reason after releasing active matches, provided it has no posted adjustments. Original submitted evidence remains. Posted-adjustment statements and closed statements cannot be cancelled or reopened. Later correcting entries address book errors without rewriting history. Correction of an erroneous closed source file/balance and versioned reopening are outside this increment; a later journal does not revise that source evidence. Do not force the next opening balance to hide an incorrect closed statement.

## Closing and immutable evidence

The reconciliation equation is posted bank balance minus outstanding book movements equals statement closing. Outstanding deposits increase the book balance; unpresented outflows reduce it, so signed amounts must be preserved. Every statement line must be matched, the difference must be zero and the closing reason must explain carried book items. The reviewer confirms the opening baseline, matches and outstanding evidence. A fingerprint check rejects stale closing previews after any relevant workspace change.

Closing saves canonical JSON bytes and SHA-256 alongside an immutable closing row. The snapshot includes statement lines/submitted CSV/checksum, bank book entries, match groups/reasons, signed balances, carried items, baseline, previous closing checksum, actor and closing reason. The exact stored bytes can be exported with an audited password-confirmed action. This is tamper-evident application evidence, not a bank signature, legal attestation or immutable external archive. Keep an independent protected copy.

Closing also freezes bank postings dated on or before its through date. All later inserts of 1030 journal lines share the same branch lock, so a concurrent backdated posting waits and is rejected after the close commits. Both finance services and database triggers enforce this boundary. Original same-intent journal retries still return their original IDs. Other ledger accounts retain their existing date behavior; this is not a universal accounting-period lock. Later bank corrections appear as new dated entries for later statement review. Historical closing snapshots remain unchanged when carried items clear later.

Migration 019 was applied successfully to the retained development database after isolated checks passed. It is additive: bank statement/matching/adjustment/closing/cancellation tables and guards, a current-active-match view, new bank charge/interest accounts and the bank-date guard. It does not rewrite existing journals, invoices, inventory, customer/supplier openings or the frozen Phase 5 release. Prior schema versions remain usable for isolated restore checks when bank tables are absent; posting after this upgrade requires the compatible application.

## Access, recovery and API

Finance-read allows branch owner/manager/accountant/auditor review. Finance-write limits import, match/release, adjustments, cancellation and closing to owner/accountant. Finance-export allows owner/accountant/auditor closing downloads. Every new POST confirms the current password and uses central session/CSRF controls. Passwords are cleared at submission and excluded from domain intent hashes and audit payloads.

- GET /api/bank-statements?offset=0 lists 50 statements, the open workspace and last closed period; pagination preserves older access.
- GET /api/bank-statements/:id returns the current workspace or saved closed snapshot.
- POST /api/bank-statements imports validated normalized evidence.
- POST /api/bank-statements/:id/matches and POST /api/bank-statements/:id/matches/:matchId/release append reviewed matching events.
- POST /api/bank-statements/:id/adjustments posts and matches a controlled statement-only entry.
- POST /api/bank-statements/:id/close stores a fingerprint-checked closing; /cancel preserves an eligible cancellation.
- POST /api/bank-statements/:id/export returns the exact saved JSON and checksum.

The workspace bounds candidate/current-match book entries at 2,000; use shorter periods and resolve carried exceptions rather than truncating evidence. Restore verification checks source text/normalized rows, statement totals, match identity/amounts/nonreuse, adjustment journals, closing checksums/source links/balances and closed statement completion. Loading restored constraint triggers alone is not treated as historical validation. Off-device recovery and production controls remain separately unaccepted.

## Verification

The TypeScript/source-inventory/Vite build and all 55 backend tests passed (129.6 seconds). The final browser bundle is about 461 KB uncompressed (134 KB gzip); server-only validation stays outside the browser preview. The isolated access matrix verified 147 session routes, 86 write-CSRF boundaries and 545 denied-role checks across the 160 declared routes. The new bank browser journey passed independently (21 seconds including runner startup); its CSV textarea was given an explicit accessible name after the initial lookup failure. All 32 browser journeys passed together in the complete run (5.2 minutes), including the new bank workflow, original checkout/returns/ledgers, operational finance/reversals, opening balances, purchase adjustments, actual PostgreSQL outage/offline replay and encrypted isolated restore with bank-integrity checks. The run used a separately named fresh demo database, isolated SQLite store and separate backup directory; non-secret evidence locations remain in .local/phase22-acceptance-run.json. No actual bank data was invented or imported into the retained development database. Two final targeted bank tests also passed after explicit closed-status/preparation-time snapshot metadata was added. The new isolated PostgreSQL tests have passed import/matching/adjustment arithmetic, first baseline/continuity, import retries, duplicate-reference/open-workspace refusal, concurrent matching, match release, offset groups, signed carryover, source preservation, closed-period protection including a waiting raw database writer, later correcting reversal, nonbank independence, checksum stability and restore text-corruption detection. Pure tests cover strict decimal/date/CSV parsing, signed totals, quoted/multiline values, bounds and canonical checksum bytes. Browser tests cover preview/import, selecting original journal lines, fee adjustment, carryover closing, exact JSON export, closed-period rejection and cashier denial.

Visual review passed for the bank workspace and import form at 1366/1440-pixel desktop and 390-pixel narrow widths. Financial tables scroll horizontally on narrow displays. Nonposting screenshots are retained at test-results/phase-22-bank-closing.png, test-results/phase-22-bank-desktop.png, test-results/phase-22-bank-narrow.png and test-results/phase-22-import-narrow.png. The preview did not submit another bank transaction, and the acceptance API stopped after verification. Local documentation links passed.

## Handoff and remaining work

Open Bank reconciliation, prepare the normalized CSV and review the entire source independently. Import with matching opening/closing balances, review original posted bank entries, resolve statement-only exceptions, then review closing and explain carried book items. Download and retain the closing JSON/checksum independently. Match later clearing of outstanding items in the next contiguous statement; do not edit a prior close.

Phase 23 is the proposed historical-report-classification package. Four proposed phases (23-26) remain after this phase's software acceptance. The single-PKR-bank, explicit-baseline, matching and file-format limits above remain. Existing large-catalog selectors/customer-picker limits, deployment qualification, printer/scanner/off-device acceptance and production approval are still tracked separately. Phase 23 has not started.
