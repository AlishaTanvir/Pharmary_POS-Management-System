# API controls and review boundaries

Reviewed for the Phase 5 release candidate on 18 November 2026. This is an implementation inventory and regression record, not a penetration-test certificate.

## Shared controls

The API listens on loopback. Central `/api` routes authenticate the current session, active user, active branch and current branch role grant. Writes require the session CSRF token. Read-only polling does not extend inactivity; real user activity/write requests renew the database expiry and HttpOnly/SameSite cookie. Idle lock clears session-specific drafts. A delayed idle logout revokes the old server session without overwriting a new login's browser cookie.

Permission middleware records role denials; the error handler records additional authenticated forbidden business actions outside rolled-back posting transactions. Structured request logs contain timestamp, method, path, status, request ID and elapsed time, not bodies, credentials or query strings. CSP limits scripts/connections to the application origin, disables embedded objects/frames, and permits only self/data images. JSON size limits and real calendar-date validation reject invalid input.

| Route group | Principal controls |
|---|---|
| `/api/auth/login` | Active account and assigned branch, bcrypt comparison, per-client failed-attempt limit, random session/CSRF tokens; no default password |
| `/api/auth/me`, activity/logout/password | Current session; writes need CSRF; password change re-authenticates and revokes sessions |
| `/api/medicines`, batches, availability | Catalog read/write grants; selected-branch predicates; cost fields withheld where applicable; server-side eligibility on checkout |
| Catalog CSV import/export/reactivation | Write/report permissions; validated row/pack input, atomic import, duplicate refusal, formula-safe export and audit; no silent overwrite |
| Sales quote/post/history/reprint/print issue | Sales permission, selected branch, cashier own-history restriction, stock locks/FEFO, idempotency, credit/shift checks; printing cannot alter posted sale |
| `/api/checkout-approvals` | Authenticated cashier/branch, five-attempt limit, another active branch-authorized supervisor and password, reason, five-minute basket/price/policy binding; one-time consumption in sale transaction |
| `/api/carts` | Sales permission plus cashier/branch ownership on every operation; validated intent, idempotent save and cart limit; current-price reload without reservation |
| Purchases and supplier credits | Receipt write permission; approved supplier return additionally requires ledger write/password; original-branch invoice/batch locks, original quantity/physical/reservation limits and immutable stock/credit records |
| Customer/supplier ledgers and terms | Ledger read/write permissions, selected branch, invoice-linked allocation and overpayment checks; future-invoice terms cannot rewrite old due dates |
| Expenses and evidence | Posting permission and idempotency, immutable evidence, branch ownership, type/signature/size limits, audited authenticated download; attachments are downloaded rather than rendered inline |
| Returns, shifts, counts and lifecycle | Role, selected branch, open-shift/ownership rules, password sign-off where required, original-invoice refund caps, two-person count approval and stale snapshot checks |
| Reports/audit/exports | Report/audit permission, explicit branch predicates, date/filter validation and audited exports; row/print limits are explicit rather than silent totals truncation |
| Branches/grants/shared catalog | Organization-administrator checks for organization mutations, selected branch grants and controlled shared-product identity/versioning |
| Transfers | Independent source/destination grants, source medicine/batch locks, reservation limits, immutable dispatch and once-only destination receipt |
| Finance | Branch-specific finance grants; whole-paisa balanced journals, source idempotency, deferred database balance constraints and append-only reversals |
| Integration exports | Branch report/admin controls, immutable checksummed internal export marked NOT_SUBMITTED; no configured live fiscal submission |
| Backups and private readiness | Organization administrator plus password for backup mutations; encryption key/utility configuration; isolated restore rather than live overwrite |
| `/api/local` | Loopback-host/origin check, local request header, prepared device authorization, PIN throttling, separate expiring local session and encrypted SQLite journal |
| `/api/sync` | Prepared device secret and event/device identity, current user/grant, reservation/price/tax validation, idempotent central replay; conflicts retained for review |
| `/health` | Minimal unauthenticated local liveness/database availability; no credentials/schema details |
| `/_control/stop` | Optional private control token, loopback listener, no public shutdown credential or secret in command arguments |

## Verification and remaining deployment review

Tests cover central/SQLite transaction failure/replay, selected-branch finance and export boundaries, unauthorized cashier operations, approval pricing/reuse/consumption, supplier credit settlement/GL consistency, evidence validation, session cookie behavior, CSP/input bounds and approval throttling. The sensitive groups above have explicit permission/ownership controls; this inventory does not claim exhaustive adversarial coverage.

Before an external deployment, verify TLS/reverse-proxy configuration, database least privilege, OS account/storage controls, log retention/rotation, process supervision and dependency/runtime patch policy. Authentication throttles are per-process; a multi-process or externally exposed deployment needs a shared limiter. CSP's inline-style allowance supports current receipt/page styling. Upload signatures are type/size checks, not malware scanning or a general document-decoding sandbox.


The idle-lock regression advances the browser clock beyond the session lifetime, signs in as a different cashier and verifies the prior draft is empty. A one-shot lock and generation change on successful login prevent delayed requests from the old session cancelling the new session. Login password fields clear immediately on submission. A demo cashier credential observed in an early failure artifact was rotated and its sessions revoked; generated context artifacts were sanitized. No credential value is included in the release.


Phase 7 adds `/api/insights/dashboard` and its audited export under report permission. `/api/medicines/:id/history` requires catalog read and verifies the medicine's selected branch before querying movements. Cost fields depend on purchase-read permission; cashier responses omit them and mask other staff sale references. Date windows and pagination are validated, and repeatable-read transactions keep each response consistent.


Phase 8 count-sheet options/list/create/detail/print/line submission routes require inventory-count permission and selected-branch ownership. Approver-only fields are projected conditionally; printable sheets omit book/count figures for every role. Existing count approval additionally checks movement history, outstanding offline reservations, closed batch state and current owner-escalation threshold. Direct single-batch submissions require a movement snapshot; legacy pending counts need a recount. All stock posting remains in the separate approval transaction.

Phase 9 purchase-order list/detail/export requires selected-branch purchase-read access. Creation/receiving requires purchase-write; cancellation additionally requires inventory-approval and password re-authentication. UUIDs, whole packs, real dates and safe currency totals are validated. Immutable branch/key/input replay records and order row locks prevent double receiving and over-receiving across lots/concurrent requests. Export is internal JSON only and audited. See PHASE-9.md.

Phase 10 supplier-directory reads require purchase-read and filter the selected branch. Creation retains purchase-write; updating additionally requires inventory-approval. Full-record updates validate bounds, email, terms, revision and reason. Row locks and optimistic revision checks prevent lost updates; foreign IDs return 404. Old/new supplier details are audited atomically. Existing CSRF/session controls apply. See PHASE-10.md.

Phase 11 audit-events and audit-options require audit-read and selected-branch filtering. Historical actor options derive from branch event references, including inactive users and null/system actors, rather than the user administration API. Date/action/actor/text/offset inputs are validated; blank date boundaries are omitted. Branchless events and foreign-branch history remain excluded. No audit mutation or raw export route is added. See PHASE-11.md.

Phase 12 category reads require catalog-read; writes and medicine-category assignment require catalog-write. Parent/category/medicine identities are selected-branch validated, and composite foreign keys reinforce branch separation. Category edits and classification require revisions/reasons; branch locks reject concurrent cycles. The catalog accepts category UUID/UNCATEGORIZED filters. Categories are local metadata even under shared identity policies. No stock, price, financial or shared-identity permission is bypassed. See PHASE-12.md.

Phase 13 adds optional category UUID/UNCATEGORIZED filtering to count-sheet creation and category metadata to options/detail/print. Foreign categories are rejected; descendants remain branch-scoped. Snapshot creation blocks concurrent tree/assignment edits while reading metadata. Blind projections expose category labels without book quantities. The 500-batch cap, offline-reservation protection and separate stock approval remain unchanged. See PHASE-13.md.

Phase 14 reports/options adds branch category_tree. Operational reports accepts category_id UUID/UNCATEGORIZED independently from legacy category text. Foreign IDs return 404; audit exceptions rejects hierarchy scope. Existing reports permission, branch scope, repeatable-read transactions, date/cap validation and audited export remain. CSV scopes are operator-entered paths protected by existing formula escaping. See PHASE-14.md.

Phase 15 medicine import validates optional category_path arrays (up to eight names, 1-80 characters each) alongside existing medicine rules. Matching paths are branch-local and case-insensitive by sibling. Missing categories and new medicines commit/roll back together; existing records are rejected. Shared-only policy and catalog-write controls remain. Export adds category_path_json and retains reports permission, formula escaping and audited repeatable-read output. See PHASE-15.md.

Phase 16 POST /api/categories/import validates 1-500 strict path objects with 1-8 names of 1-80 characters. It requires catalog-write and selected-branch session/CSRF controls. The route alone accepts up to 2 MB JSON to cover a complete bounded master. POST /api/categories/export requires reports permission and returns audited, repeatable-read CSV for all branch categories. Import creates/reuses paths only; it cannot edit IDs, parents, medicine assignments or financial records. Cashiers are denied both operations. See PHASE-16.md.

Phase 17 /api/online-drafts/:id requires sales-write and selected cashier/branch ownership, including reads. GET returns current metadata/state/outcome; PUT validates strict bounded draft state and expected revision; POST /restore validates revision and current branch catalog/customer references; DELETE clears to a tombstone. Writes retain session/CSRF controls. State excludes payment and supervisor approval data. Outcome lookups share sale-key locks; old revisions cannot overwrite changed or discarded state. Only draft identifiers live in browser session storage, and detected expiry/sign-out/idle lock forget them. See PHASE-17.md.

Phase 18 adds no endpoint or grant. Keyboard actions call the existing payment-review and receipt-print actions; duplicate receipt printing still awaits the selected-role/branch reprint audit endpoint. F8 only focuses the existing discount field, retaining server limits and supervisor approval. Busy/recovery context guards and disabled dialog fields prevent accidental keyboard actions during requests. See PHASE-18.md.

Phase 19 adds organization-administrator GET /api/security/api-access and audited POST /api/security/api-access/export, retaining central CSRF/session controls. The generated inventory covers declared registrations, inherited administrator gates and reviewed self-service/local/device exceptions; builds reject stale/unclassified/duplicate registrations. An isolated runtime matrix checks all declared central session routes, write CSRF and declared denied roles, plus local/device negative cases. This does not exhaust allowed-role object or business authorization paths. Local malformed Host/Origin inputs now return 403, and sync checks device-secret shape before event validation. See PHASE-19.md.

Phase 20 receipt inputs accept optional integer-paisa discount/tax and explicit CAPITALIZE/RECOVERABLE treatment. Existing purchase-write, selected-branch, amount/unit, CSRF and idempotency controls remain. Fractional resulting base costs reject the transaction. New GET /api/purchases/:id requires purchase-read and branch ownership; request hash/key are omitted from its response. Supplier credits retain password/write/ledger approval and quantity locks while adding capped input-tax reversal. Deferred database guards reject mismatched receipt, credit and operational-journal components. See PHASE-20.md.

## Phase 21 opening balance routes

Four new session routes are inventoried: creating/correcting openings requires ledger:write plus finance:write, settlements require ledger:write, and branch reconciliation requires ledger:read plus finance:read. All writes confirm the current password and use central CSRF/session controls. The current matrix covers 151 declared routes, 138 session routes, 79 CSRF checks and 505 denied-role checks. Existing ledger/directory routes include openings without expanding their grants. See PHASE-21.md.

## Phase 22 bank statement routes

Nine new session routes require finance:read, finance:write or finance:export as appropriate. All seven new POST routes require current-password confirmation and the central CSRF boundary. Branch scope applies to statements, original book legs, match groups and exports. Finance-write is owner/accountant; managers can inspect and auditors can inspect/export. Current inventory: 160 declared routes, 147 session routes, 86 write-CSRF checks and 545 denied-role checks. CSV requests have a dedicated 1 MB parser with a smaller domain text/line bound; the ordinary 100 KB API bound remains. New closing fingerprints and database bank-date guards protect stale/concurrent actions. See PHASE-22.md.

## Phase 23 historical report basis

Existing GET /api/reports/options accepts classification_basis, to and optional classification_at; existing POST /api/reports/operational accepts CURRENT or AS_OF and optional explicit-zone cutoff. UNKNOWN category is historical-only, and audit exceptions reject AS_OF. Cutoffs must be on the Pakistan-local through-date and no later than generation. Historical tree/identity lookups are branch scoped. Existing reports/session/CSRF/export-audit controls are retained: 160 declared routes, 147 session routes, 86 CSRF checks and 545 denied-role checks. Classification tables have no writable public endpoint. See PHASE-23.md.
