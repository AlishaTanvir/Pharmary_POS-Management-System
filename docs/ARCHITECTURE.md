# Architecture and transactional contract

Browser → same-origin API → PostgreSQL. Vite proxies /api in development; production Node serves dist and the API together. The local launcher supplies development PostgreSQL only. Production uses a separately managed PostgreSQL service and TLS reverse proxy; do not expose the database publicly.

The SRS proposes NestJS and Prisma as implementation options. This MVP uses Express and parameterized node-postgres queries to keep transaction and row locking behavior explicit. React/TypeScript and authoritative PostgreSQL follow the baseline. Tauri, SQLite and hardware service remain separate deliverables.

Relationships: branch → users, medicines, suppliers, purchases, sales; medicine → units and batches; purchase → batch receipts and payable; sale → immutable lines → exact batch allocations; sale → tender records; batch → append-only movements; user/branch → append-only audit events. Foreign keys protect references. Every API lookup constrains the session branch; callers cannot select their own branch or permissions.

Sale posting acquires a transaction-scoped advisory lock for the idempotency key, checks request hash, locks medicine rows in sorted order, locks batches, validates role/eligibility/prices and allocates FEFO. It inserts sale, snapshots, allocations, payments, stock deductions, movements and audit before a single commit. A competing last-stock checkout rereads committed stock after the lock. A repeated key with changed input is rejected. Sequence gaps after rollback are permitted; numbers are unique, not gapless fiscal numbering.

Receipt posting similarly commits purchase, lines, batches, movements, supplier liability and audit together. Supplier invoice uniqueness protects against accidental duplicate bills.

Session cookies are HttpOnly/SameSite=Strict with configurable Secure. Mutations require CSRF tokens. Passwords are bcrypt hashes. Login attempts are limited per client address. Production needs TLS, secure cookies, a non-superuser database role, operational monitoring and external rate limiting for multiple API processes. No raw card credentials are collected.

## Main endpoints

POST /api/auth/login; GET /api/auth/me; POST /api/auth/logout; POST /api/auth/password

GET/POST /api/medicines; GET /api/batches; GET/POST /api/suppliers

GET /api/purchases; POST /api/purchases/receipts

POST /api/sales/quote; POST /api/sales; GET /api/sales?query=; GET /api/sales/:id; POST /api/sales/:id/reprint

GET /api/reports/daily?date=YYYY-MM-DD; GET/PUT /api/profile; GET/POST /api/users; POST /api/users/:id/reset-password

All non-login endpoints require a session. Errors use {error: message}; input validation is server-side. Listing endpoints currently have bounded results (100 medicines/invoices/purchases; 500 batches); full pagination remains necessary before the SRS capacity target can be claimed.

## Phase 2 additions

Migration 002 adds immutable shifts/closings, original-invoice returns and allocations, customer credit entries, supplier settlements, expenses, stock counts/approvals and backup status/settings. Financial postings lock the cashier's user row, preventing close/post races. Returns lock the original sale, cap cumulative quantities/value and preserve original batch linkage. Credit limits lock the customer; collections/returns lock the affected invoice. Stock reconciliation rejects stale snapshots and the submitter's own approval.

New route groups: /api/shifts, /api/returns, /api/customers, /api/ledgers, /api/supplier-balances, /api/expenses, /api/stock-counts, /api/alerts, /api/audit-events, /api/backups and batch lifecycle actions. Server grants and branch filters protect each operation. Password confirmation is required for refunds, closing, stock approval/lifecycle changes, backup/download/restore and schedule changes.

Daily reporting uses a repeatable-read snapshot and includes returns, tax reversal and returned batch costs. Quarantine batches preserve original receipt/cost and append their own movements. Expiry maintenance appends system audit events. AES-256-GCM snapshots use native PostgreSQL custom archives. Restore verification creates a separate database, removes restored sessions and checks invoice/payment/credit and stock/movement invariants. See PHASE-2.md for deployment and recovery boundaries.

## Phase 3 additions

Migration 003 adds device grants, exclusive batch reservations, immutable sync-event receipts and offline source linkage on sales. Ordinary quotes and available-stock queries subtract all outstanding offline pool quantities. Authorization expiry never automatically releases those quantities. Closing a shift with an active grant is blocked.

The counter-local Node service serves the web UI and `/api/local/*` without a PostgreSQL dependency. Local PIN sessions protect cached data; loopback host checks, SameSite/HttpOnly cookies, request headers and origin checks protect mutations. No central password or session cookie is copied into the snapshot. Sensitive journal/configuration payloads are authenticated/encrypted with a counter-local key. SQLite metadata remains visible. Files live under `.local/`, outside tracked source.

SQLite WAL, synchronous FULL and BEGIN IMMEDIATE wrap invoice, deduction and outbox creation in a single durable commit. Stored event IDs and input hashes protect local retry. A staged two-store preparation handshake fails closed until central commit is confirmed; interrupted staging can be recovered online.

Central endpoints: POST `/api/offline/prepare`, GET `/api/offline/devices`, GET `/api/offline/conflicts`, and POST `/api/sync/events`. Sync transport authenticates a hashed device credential; the local broker never sends that credential to the browser. Broker-to-authoritative-database replay uses the same transactional service as the authenticated HTTP sync endpoint. Use a private secured database connection for this deployed topology, rather than exposing PostgreSQL publicly.

Replay locks the event key, cashier, device, medicine and batch reservation rows. Price/tax/receipt are recomputed from the approved grant, current eligibility/access is revalidated, and the sale/allocations/payments/movements/audit plus immutable acceptance receipt commit together. Business conflicts roll back posting to a savepoint and persist a reviewable conflict receipt. Transport failures retain the encrypted local outbox with backoff. Duplicate acknowledgements never deduct stock twice.

Finishing first seals local posting atomically, then releases unused central reservations. The phase does not implement silent conflict merging, automatic write-offs or automatic in-place restore of unsynchronized local journals. Offline invoices retain their original event-time invoice number centrally; report dates use the sale's actual timestamp. See PHASE-3.md for operating constraints and recovery evidence.

## Phase 4 additions

Migrations 004/005 introduce per-session branch selection, per-branch role grants, protected organization administration, versioned shared product publication, immutable transfer dispatch/receipt, movement cost snapshots, a chart of accounts, immutable balanced journals and internal connector exports. This is a single organization database; branches are not unrelated SaaS tenants.

Session authentication resolves the selected branch grant on every request. Branch switches rotate CSRF tokens and clear browser state. Role revocation invalidates affected sessions. Organization-wide backup and employee administration require the separate organization-administrator flag. Cross-branch dashboard aggregates additionally filter each grant by reporting permission.

Dispatch holds the same source medicine/batch locks used by checkout and offline preparation and subtracts outstanding offline reservations before accepting quantities. Destination receipt posts a separate batch and movement with the original cost/expiry and transfer/source ancestry. Completed transfer quantities are unique per line/receipt. Source and destination access are verified independently.

Operational GL posting is an explicit idempotent projection of immutable source transactions, rather than a second hidden mutation of stock/cash. Unique branch/source keys and deferred balance constraints protect journal commit. Reversal is a new journal and cannot alter the original. Receipt journals clear transit to interbranch accounts; automatic consolidated elimination is outside scope.

New API groups: /api/branches, /api/enterprise, /api/shared-catalog, /api/transfers, /api/finance, /api/supplier-suggestions and /api/integrations. Regulator integration is export-only by user instruction, with checksummed branch-scoped snapshots and no live transmission/acknowledgement. See PHASE-4.md for operator and rollout boundaries.


## Phase 5 readiness additions (first delivery)

Migration 006 adds cashier/branch-owned suspended carts and nullable immutable sale profile snapshots. Carts save only validated sale intent, never payments, old stock allocations or prices. Saving is idempotent by UUID; retrieval rehydrates active medicines/current units and prices and leaves the saved copy intact for safe retry. Final checkout still uses the existing transactional stock, credit and permission checks. The UI removes the saved copy after successful checkout; a failed cleanup can leave a harmless saved copy, which must still be reviewed before any new sale. It is not an unposted invoice or a stock reservation.

New online sales snapshot branding in the original sale insert. Newly prepared offline devices include branding in their approved snapshot; synchronization persists that exact profile. Historical invoices without snapshots fall back to the current branch profile, without rewriting immutable financial records. PNG/JPEG data logos have payload/signature checks; remote/SVG logo sources are rejected. This is type/size checking, not a general image-decoding service.

Sales history supports Pakistan-local inclusive dates and stable paginated ordering. Cashiers retain their own-invoice restriction. Invalid dates/reversed ranges return 400. Malformed/oversized JSON receives 400/413. STATIC_DIRECTORY optionally selects the static build path; this option alone is not a packaged deployment.

See REQUIREMENTS-MATRIX.md for known gaps and OPERATIONS.md for daily use and production gates.


## Phase 5 completion increment

Migration 007 adds branch discount/reference policy, immutable supervisor approvals/consumptions, supplier return/credit records, due-date snapshots, account terms, immutable expense evidence and history indexes. Quote checks current policy and validates a basket/price-bound short-lived approval; posting consumes it atomically after the existing idempotency check. Supplier returns lock the original invoice and source medicine/batches, subtract offline reservations and cap against original received units; payable settlement and GL projection include those credits.

Central GET polling no longer extends sessions; real activity writes renew expiry/cookie. Idle logout can revoke the old session without late cookie replacement, clears private drafts and rejects stale in-flight results using a client session generation. The local SQLite session remains separate. CSP, structured body-free/query-free request logging, liveness/readiness checks and operator print-issue audit support deployment review.

The Windows release compiles server entry points and ships only production dependencies/static files/migrations/docs/scripts with a manifest. Separate Node 24+/PostgreSQL 18 prerequisites and protected private data avoid shipping runtime databases or secrets. Startup is guarded, migrations serialized, bootstrap refuses existing pharmacy data, and shutdown uses a private loopback control token. No native wrapper, signed executable or unattended Windows Service is claimed. See WINDOWS-RELEASE.md and API-CONTROLS.md.


## Phase 6 pilot preparation

Migration 008 stores immutable pilot acceptance events by selected branch, control key, declaration state, evidence, actor and append sequence. Root organization access is required; recording additionally requires branch OWNER permission and password confirmation. Snapshot/export reads remain branch-scoped. Current profile/catalog/stock/staff facts do not automatically attest a checklist item or approve production. No financial table or posting workflow changes in this increment.


## Phase 7 management read models

The insights module adds repeatable-read daily sales/return/tax/allocated-cost aggregation and ten recent branch invoices. Day buckets are zero-filled and use Asia/Karachi posting dates; report totals reject unsafe integer precision. CSV export records an audit event. Product stock cards reconcile movement quantities across all lifecycle states, paginate 50 movements and enforce current actor branch/cost permissions. Cashier responses omit unit costs and mask other staff sale references. No financial migration or posting workflow changes.


## Phase 8 count sheets and movement snapshots

Migration 009 stores immutable count sheets/lines and one-to-one submission links to the existing stock count records. Batches are locked before snapshots/submission/approval; both current quantity and movement-count snapshots are validated. Offline reservations and closed lifecycle batches block counting. Count adjustments retain existing lifecycle/cost behavior and the original movement/audit pipeline. Approval reads current branch owner-escalation policy and always enforces separate submitter/approver identities.

Non-approver sheet JSON omits book quantities/variance. The print endpoint returns a separate blank-count metadata projection and records an audit. Blind mode does not revoke other authorized inventory views. Sheet identity filters/metadata are captured at creation; ongoing stock activity can require a new sheet without freezing tills. Older pending counts lacking movement snapshots cannot be approved; historical posted approvals are not rewritten.

## Phase 9 purchasing plans

Migration 010 stores immutable order headers/lines, receipt mappings, replay hashes and remainder closures. Receipt transactions lock the order, sum requested packs across lots, validate current conversion snapshots, and call the existing receiving service inside the same transaction. Actual invoice lines and order links commit together. The receipt advisory key also excludes reuse by direct receipt clients. Cancellation takes the same order row lock; already acknowledged receipts remain replayable. Creation has no inventory, ledger or journal side effects. Aggregate direct/order receipt totals reject unsafe integer precision.

## Phase 10 supplier directory

Migration 011 adds current contact/address/identifier/notes fields, a revision and branch/name index. The supplier module owns creation and directory search/update. Updates lock the branch supplier, reject stale revisions and atomically audit before/after data. The receiving pipeline continues to snapshot due dates from current terms; supplier edits post no financial entries. Historical purchase views retain current supplier-name joins. Full-record update clients must preserve current optional fields.

## Phase 11 activity audit queries

The audit-browser module owns filtered event reads and branch-scoped action/actor options. Timestamp bounds represent inclusive Asia/Karachi dates with an exclusive next-day upper bound. Filters compose with legacy text search; order remains timestamp descending then ID. Migration 012 adds branch/action/date and branch/actor/date indexes. Events remain immutable, and no financial posting changes occur. UI generations ignore stale filter responses; offset pagination may shift when new events arrive.

## Phase 12 branch categories

Category metadata is separate from shared product identity. Category creation/reparenting serializes by branch, validates an eight-level acyclic tree and commits an audit. Composite foreign keys constrain parent/medicine assignments to the same branch. Independent revisions protect category and medicine classification updates. Catalog filtering uses a branch-scoped recursive descendant query; inventory/financial posting services are unchanged. Category assignments persist through ordinary medicine edits; existing products default to no category.

## Phase 13 count category snapshots

Count creation holds a shared branch category advisory lock and matching medicine share locks while selecting batches; category tree writes use the exclusive lock. Migration 014 captures nullable historical category ID/path per immutable count line. Filters retain the selected category path. Old records stay null and are not reclassified. Blank/omitted category input preserves the legacy request-hash shape. Category metadata changes do not alter physical stock staleness rules.

## Phase 14 report categories

Operational reports resolves branch category membership in the existing repeatable-read transaction and uses a filtered medicine projection across its five product queries. The legacy form/action input and columns remain compatible. Filtered rows add scope/basis metadata; audit exports record the scope. No migration or financial changes occur. Current membership does not reconstruct past classification or allocate mixed-invoice revenue.

## Phase 15 catalog CSV category paths

A catalog CSV service owns create-only import and consistent export. Portable classification is a JSON array of name segments, resolved within the selected branch under the category lock. Missing nodes use the existing bounded category service; category/product/unit writes and audits share the import transaction. Repeatable-read export maps current category IDs to segments. No schema or financial posting changes are introduced.

## Phase 16 category master portability

The existing category service adds bounded additive import and full-tree CSV export. Import resolves name arrays under the same exclusive branch category advisory lock used by catalog CSV and manual tree writes. Each new node and summary audit commits with the batch; late capacity failures roll everything back. Export maps every node to JSON name segments within repeatable-read isolation. IDs remain branch-local, with no schema or posting changes.

## Phase 17 online draft recovery

Migration 015 separates mutable unsuspended drafts from immutable sales and explicit saved carts. The browser serializes debounced writes with revisions and stores only a tab-scoped opaque reference. Owner/branch and draft locks serialize quota, expiry, revision and tombstone operations. Recovery resolves current catalog data and checks checkout outcomes under the existing sale-key lock. Sale posting services remain unchanged. Session invalidation forgets references; server drafts expire after 24 hours. See PHASE-17.md.

## Phase 18 cashier access

A pure shortcut resolver applies context, role, modifier, repeat, composition, recovery and busy guards before dispatching existing UI actions. Shared dialog focus is managed by a layout effect with remembered return targets and native modal containment. Receipt click/keyboard printing share one audited action. No schema or financial service changes occur. See PHASE-18.md.

## Phase 19 access inventory

A development-time TypeScript AST scanner follows explicit router mounts and access middleware into a generated, source-fingerprinted manifest. The server bundles that metadata for organization-private review/export without a runtime compiler dependency. Build drift checks and isolated HTTP denial tests complement each other. Local Host/Origin validation is a shared bounded helper. No schema or financial service changes occur. See PHASE-19.md.

## Phase 20 purchase components

A shared pure BigInt-assisted allocator computes invoice/lot discount and tax portions and, as extended by migration 022, supports four-decimal PKR pack prices and exact fractional stock-cost ratios. Residual lot values and immutable movement/allocation totals keep all ledgers in integer paisa. Explicit per-line discounts, amount/rate taxes, mixed treatment and offline value reservations are described in PURCHASE-COSTING.md. The receiving transaction snapshots components into purchases/purchase_lines and net costs into batches; order receiving delegates to it. Supplier credits use cumulative proportional input-tax reversal. Explicit GL posting separates inventory and input tax, with deferred source-component guards in migrations 016/017. Legacy null snapshots use recorded totals/costs without rewriting history; zero optional adjustment keys retain legacy retry hashes. See PHASE-20.md.

## Phase 21 opening sources

Migration 018 introduces append-only standalone opening headers/events and a current-position view. Services serialize account/source changes and atomically post journals/audit. Deferred constraints validate source/date/control components and reject generic opening reversals. Existing operational tables remain intact. Combined ledger reads use repeatable-read snapshots; credit decisions include current signed opening positions. opening-integrity.ts also checks restored source/journal identity and components. See PHASE-21.md.

## Phase 22 bank reconciliation

Migration 019 adds immutable statement, normalized-line, match/release, adjustment, closing and cancellation sources. A shared branch bank lock serializes matching/closing against every new 1030 journal line. Deferred guards reconcile signed matches and adjustment components; closed bank dates reject later inserts, while nonbank dates retain their prior behavior. A lightweight shared domain parses normalized CSV; server schemas stay out of the browser bundle. Canonical JSON bytes/checksums preserve closed evidence and signed carryover. Restore verification reparses source text and reconciles rows, journals and closing evidence. See PHASE-22.md for one-PKR-bank/baseline and matching limits.

## Phase 23 classification capture

Migration 020 atomically locks and baselines category/medicine/batch sources, then installs append-only transaction-time capture triggers. Explicit AS_OF reporting reads the captured category tree, medicine classification/activity/form and batch lifecycle at one millisecond cutoff; stock/financial cutoffs use the same precision. Legacy periods remain UNKNOWN, distinct from captured Uncategorized. CURRENT reporting remains the default. Existing report routes/options support the new basis; AS_OF CSV has one METADATA row and DATA records. Restore checks reconcile latest captured state with retained sources. This is recorded transaction-time reporting, not exact commit visibility or an immutable report store. See PHASE-23.md.

## Phase 25 release boundary

The unsigned Windows candidate has a v2 exact-file hash manifest and migration policy. A dependency-free verifier runs at packaging/installation/launcher/supervisor entry, before private environment loading and production dependency import in the supervisor. Installed configuration takes precedence over inherited shell variables. The migrator refuses unknown applied migrations and non-prefix histories under the existing serialization lock; it does not perform a downgrade. The committed acceptance runner owns an independently named PostgreSQL cluster and generated account/key material, with the outage test parameterized to that cluster. Production supervision, trusted signing/distribution, target host controls and external recovery remain separate qualification work. See PHASE-25.md.

## Phase 26 field evidence

Append-only field declarations are separate from the original pilot checklist. Events capture recorder ID/name and declared observation/operator/site/release plus typed measurements. The organization-administrator boundary applies to all field routes; writes additionally require branch OWNER and password confirmation. A branch/key uniqueness constraint and canonical request hash make retries stable. A repeatable-read export includes both the original pilot snapshot and full field history, with an audited checksum and production_approved=false. Evidence declarations leave posting permissions in place; external owner/deployment controls still govern actual production cutover. See PHASE-26.md and FIELD-ACCEPTANCE.md.
