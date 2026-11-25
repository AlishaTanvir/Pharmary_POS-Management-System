# Current requirements and acceptance record

Updated 25 November 2026. Baseline: [SRS v1.0](Pharmacy_POS_SRS.md). Phase reports are historical engineering snapshots. This matrix records coverage, including gaps; it does not certify production readiness.

Implemented means source exists. Automated evidence covers the scenarios in the named tests, not every possible configuration. Partial means the requirement remains open. Hardware and operator checks require recorded evidence. No FR-009 appears in the baseline.

## Functional requirements

| ID | Current coverage | Evidence / remaining work |
|---|---|---|
| FR-001 | Implemented; field security review pending | `server/index.ts`, `expansion-routes.ts`: login/logout, password change/reset, timeout. GET polling does not renew inactivity; user activity renews both cookie and server expiry. Idle lock clears prior drafts; CSRF, throttling and selected branch permissions are regression tested. |
| FR-002 | Implemented | `domain.ts`, API permission middleware; database/browser role and selected-branch checks. Phase 19 adds a generated explicit-route inventory and all-declared-session-route authentication/CSRF/denied-role regression matrix. All allowed-role object/business paths and deployment security remain release checks. |
| FR-003 | Implemented, physical print pending | Profile editor supports name/address/phone/footer, logo and identifiers. Migration 006 snapshots new online invoices and newly prepared offline grants. Old invoices without snapshots use the current profile; old grants retain their original fields. `readiness.test.ts`. |
| FR-004 | Implemented | Daily reporting and dashboard; `checkout.spec.ts`, `production.spec.ts`. Phase 7 adds posting-date sales/return trends, recent invoices, accessible daily figures and audited trend CSV. |
| FR-005 | Implemented within supported postings | Immutable sales/returns/movements/journals, append-only reversals. Database tests and finance tests. Supplier returns/credits use immutable linked credit entries. |
| FR-006 | Implemented; deployment security review pending | Branch-scoped audit search and pagination; structured details for sensitive postings. Operational audit exceptions support date/action/actor filtering and audited export. Phase 11 adds dedicated inclusive date/exact-action/actor filters on the raw event browser, with branch-scoped historical options and stable tie ordering. |
| FR-007 | Accepted PKR-only currency scope; configurable currency deferred | Branch selection, profile tax policy, local prices and shared catalog implemented. On 25 November the user accepted PKR only; configurable base currency and FX are deferred under that decision. Existing/historical monetary meaning is preserved. Configurable role-based discount limits, basket/price-bound one-use supervisor approval and optional prescription references are implemented. |
| FR-008 | Implemented | Validated CSV preview/import and catalog edits exist. Audited complete catalog export, optional pack-unit CSV import, active/inactive navigation, reactivation and paginated search are implemented. Phase 15 adds portable category_path_json for assigned category hierarchies, preview and atomic creation/reuse on new-record import. Phase 16 adds a separate full category master CSV, including unused nodes. |
| FR-010 | Implemented; USB hardware pending | Barcode/name/generic/SKU/aliases; keyboard F2/F4/F9. `checkout.spec.ts`; Phase 18 adds F6 customer, F8 discount and a contextual shortcut guide with blocked/busy/modifier guards. Physical scanner has not been verified. |
| FR-011 | Implemented | Unit conversions and immutable allocations; domain/database tests, AT-02. |
| FR-012 | Implemented | Saleable totals/current price shown; batch inventory shows expiry/status; checkout rejects blocked stock. POS batch drilldown shows expiry, blocked status, physical/reserved/sellable quantities and pagination. |
| FR-013 | Implemented FEFO | Deterministic eligible FEFO, database concurrency tests. User accepted mandatory automatic FEFO on 25 November; manual overrides are explicitly deferred. Eligible stock selection cannot be bypassed by a supervisor approval. |
| FR-014 | Implemented for current policy | Quantities, role-restricted discounts, tax/rounding and sale notes. `domain.test.ts`, readiness tests. Configurable caps and delegated approvals are implemented in migration 007 and completion/security browser tests. |
| FR-015 | Implemented | Cash/card/wallet/split tender; partial payment requires approved customer credit. External terminal records only; no card charge initiation. |
| FR-016 | Implemented | Atomic sale/allocation/payment, unique invoice/idempotency; database fault/concurrency tests. |
| FR-017 | Software implemented; hardware pending | Browser 58/80 mm print and DUPLICATE reprint, saved independently from sale. Cutting/drawer/driver compatibility unverified. |
| FR-018 | Implemented | Number/product/cashier text search; inclusive Pakistan-local date range; 100-row pagination; own-invoice restriction for cashiers; line/payment detail. Readiness browser test. |
| FR-019 | Implemented | Original invoice allocations, capped proportional refund, quarantine, authorized approval and recorded instrument; database/production tests. |
| FR-020 | Implemented online; offline limits explicit | Cashier/branch-scoped saved carts, idempotent save, repeatable load at current prices, explicit removal and checkout cleanup. Phase 17 adds separate automatic online drafts with same-tab recovery and posted-checkout detection. No stock reservation. Customer credit limits implemented; offline checkout remains prepared cash only. |
| FR-021 | Implemented | Float, expected cash, collections/refunds/paid-outs, variance reason and password sign-off; database and browser tests. |

## Additional baseline workflows

These are requirements in narrative sections and must not disappear merely because they lack FR numbers.

| SRS section | Coverage and gaps |
|---|---|
| 4: sale recovery and restrictions | Posted invoices are durable; saved online carts survive browser reload after explicit suspension. Phase 17 adds bounded automatic unsuspended online cart recovery through a server draft and a same-tab scoped reference; current-price recovery and posted-checkout detection are implemented. The debounce window, failed saves, lost browser references and physical power-loss acceptance remain explicit limits. Restricted sales require an authorized owner/pharmacist or a valid delegated approval; configurable reference capture stores a minimal prescription reference. |
| 5: catalog and lifecycle | Batch/expiry/unit controls, recall/quarantine/disposal and count movements implemented. Supplier returns/credit notes against remaining original receipt stock and full catalog navigation are implemented. Phase 7 adds date-filtered product physical stock history with reconciliation, pagination and role-based cost/reference masking. Phase 12 adds branch-local category trees, revision-controlled assignments and descendant catalog filtering. |
| 6: purchases | Direct receipt, duplicate vendor reference, atomic payable and linked payments implemented. Phase 9 adds internal purchase orders, partial multi-lot receiving, remaining quantities and cancellation without reversing posted invoices. Phase 10 adds supplier contacts, address, identifiers, searchable directory and audited revision-controlled editing of future invoice terms. Phase 20 captures invoice-level discount/tax amounts with explicit capitalized/separate-input-tax treatment, exact whole-paisa inventory allocations, tax-aware supplier credits and matching GL components. Migration 022 extends this with fractional base-unit costs, four-decimal selected-pack PKR prices and per-line capitalized/recoverable/exempt tax amount/rate entry; Phase 21 adds separately evidenced customer/supplier openings, settlement, unpaid-remainder correction, combined aging and GL reconciliation. Supplier returns/credits, future-invoice payment terms, immutable due dates and due-date aging are implemented. Historical invoices without terms remain due on the invoice date. |
| 6.3: counts | Two-person approval and stale snapshot rejection implemented; Phase 8 also validates movement history and blocks counting against outstanding offline reservations. Phase 8 implements per-batch blind sheets filtered by existing location/form/product, blind printing and a configurable base-unit owner-escalation threshold. Every adjustment retains two-person approval. Phase 12 introduces a branch-local category hierarchy and catalog classification/filtering. Phase 13 adds category/descendant count-sheet filtering and immutable category path snapshots alongside existing location/form/product filters. |
| 7: accounts and reports | Daily net sales/tax/returns/cost/gross profit, tender totals, ledgers, invoice-age aging, shift closing, explicit GL journals/reversals/trial balance and audited exports exist. Expense evidence, due-date aging, filterable operational sales/valuation/expiry/movement/velocity/exception reports and CSV/print-to-PDF are implemented. Snapshot quantities/costs are as-of; lifecycle classification is explicitly current. Sales invoice filters return entire matching invoice totals, not product-attributed revenue. Phase 14 adds current category/descendant filtering for five product report kinds with scope/basis metadata in CSV. Sales remain complete matching invoice totals; audit exceptions has no category attribution. Phase 22 adds bank reconciliation within its single-PKR-bank/baseline/format limits; Phase 23 adds recorded as-of category/lifecycle classification from its capture baseline; unavailable legacy classification and exact commit visibility remain explicit limitations. |
| 8: UX | Desktop navigation, accessible form labels, focus/dialog handling and keyboard shortcuts implemented. Trend chart/recent invoices and accessible table are implemented in Phase 7. Phase 18 implements the proposed online cashier keymap, named shared-dialog focus entry/return, busy Escape protection, skip navigation and a bounded contrast/focus palette check. Full accessibility, device key conflicts and field timing remain acceptance work. |
| 9–11: workflows/data/API | Transaction services, versioned schema, scoped REST routes, internal integration exports and offline replay implemented. Export-only regulator adapter is the user-selected boundary; no live fiscal submission. |
| 12: deployment | Local Node/React/PostgreSQL/SQLite implementation exists. Unsigned Windows installer/lifecycle scripts and clean production bootstrap are implemented and tested with separately installed Node 24+/PostgreSQL 18. Native wrapper, Windows Service supervision and signed distribution remain open. `npm run local` is a demonstration launcher. |
| 13: security/recovery | Password hashing, session/CSRF controls, role checks, encrypted snapshots, separate restore validation and encrypted local journal payloads implemented. TLS/host controls, least-privilege deployment, key custody, off-device storage and recovery timing require site acceptance. |
| 16: sequencing | Phases 0-4 retain their historical engineering evidence. Phase 5 software was frozen at 0.5.0-rc.1 with user-deferred field checks. Phase 6 pilot preparation began after that handoff; see the separate phase reports. |

## Non-functional requirements

| ID | Status / evidence |
|---|---|
| NFR-01 | Isolated Windows backend qualification passed with 20,000 products, 1,000,100 sale lines and five concurrent tills: search p95 24 ms; sale-post p95 96 ms. These are loopback HTTP measurements, not physical scanner/print or full-UI timings. |
| NFR-02 | Automated transaction/concurrency/rollback and SQLite durability checks; retain zero-partial-posting invariant. |
| NFR-03 | Isolated 20,000-product / 1,000,000-baseline-line / five-till qualification passed: 100 additional sales and retries, zero stock or invoice mismatches. See Phase 5 for measured scope and retained evidence. |
| NFR-04 | Prepared local counter works without central PostgreSQL; real outage/reconnect browser test. Unprepared remote browser cannot bill offline. |
| NFR-05 | SQLite committed WAL crash test and central atomicity tests. Explicitly suspended online carts survive reload. Phase 17 adds automatic online draft reload after a confirmed save, scoped to the authenticated cashier/branch and browser tab. Unsaved changes, lost tab references and physical device/power-loss acceptance remain open. |
| NFR-06 | Automated selected-role/branch boundaries; no raw card storage. Phase 19 inventories declared routes and exercises their central authentication, write-CSRF and denied-role gates. All allowed-role object/business paths and deployment penetration/security review remain open. |
| NFR-07 | Open: trained-cashier scan-to-cash target and physical UAT must be agreed/measured. |
| NFR-08 | Versioned migrations/build/tests and a Windows GitHub Actions build/test workflow exist. Hosted CI execution evidence, release production feature gating and schema-incompatible rollback rehearsal remain open. Side-by-side installation preserves private data/configuration; Windows runtime/rollback boundaries are documented. |
| NFR-09 | Current Windows workstation development verified only. Windows 10/11 distribution/runtime coverage and browser matrix pending. |
| NFR-10 | Backup status and offline backlog UI exist. Structured request logs, /health, private release/recovery checks and operator-reported print-problem audit records are implemented. Browser code cannot detect physical delivery; external monitoring/log rotation remain deployment work. |
| NFR-11 | Phase 18 adds a tested online cashier/shared-dialog keyboard and focus audit plus selected text/status/focus contrast checks. Full screen-reader, zoom/reflow, touch, all-page contrast and browser/device acceptance remain open. |
| NFR-12 | Encrypted isolated restore demonstrated locally. Off-machine restore, key custody and timed RPO/RTO acceptance pending; proposed targets are not a guarantee. |

## Acceptance scenarios

| ID | Software evidence | Remaining field evidence |
|---|---|---|
| AT-01 | `checkout.spec.ts` barcode/name checkout | Deferred by user on 18 November 2026: physical USB HID scanner |
| AT-02 | `domain.test.ts`, `database.test.ts` pack/base quantities | None for arithmetic; field unit configuration approval |
| AT-03 | Domain/database FEFO allocations | Site batch policy |
| AT-04 | Domain/database blocked/expired checks | Operator blocked-stock recognition |
| AT-05 | Real PostgreSQL concurrent last-stock checkout | Intended till load |
| AT-06 | Central rollback/atomicity; abrupt SQLite process crash test | Actual device/power-loss drill |
| AT-07 | Central and offline replay/idempotency tests | None for tested retry scenarios |
| AT-08 | Sale saved before browser printing, duplicate UI | Deferred by user on 18 November 2026: disconnect actual printer, reconnect and verify duplicate |
| AT-09 | Database/production partial refund and quarantine | Store return policy approval |
| AT-10 | Atomic goods receipt and supplier ledger tests | Supplier invoice process UAT |
| AT-11 | Two-person count approval/stale snapshot tests | Count policy and approval thresholds |
| AT-12 | Cash drawer formula and signed closing tests | Till cash count UAT |
| AT-13 | Browser/API selected unauthorized-role denial checks | Complete endpoint security audit |
| AT-14 | `offline.spec.ts`: PostgreSQL down, reload, reconnect once-only | Site network/device topology drill |
| AT-15 | `production.spec.ts`: encrypted separate restore; invoice/stock/journal/transfer checks | Deferred by user on 18 November 2026: off-device timed recovery and sample owner sign-off |
| AT-16 | Persisted daily totals/returns/payment checks | Operational filter/export queries and browser export paths tested; period-specific product attribution and historical lifecycle reconstruction remain documented limitations |

Latest execution results belong in [Phase 23](PHASE-23.md); the frozen release qualification remains in [Phase 5](PHASE-5.md). A historical passing count does not imply a newly added test has run.


## User-directed transition

On 18 November 2026 the user explicitly deferred the printer/off-device backup field checks and requested progression to the next phase. Those checks remain visible and unverified; they are not silently waived as production controls. Phase 5 software handoff and the next phase are recorded separately in their phase documents.


## Phase 6 pilot preparation

After the frozen Phase 5 handoff, migration 008 adds an append-only, branch-scoped pilot acceptance tracker with owner re-authentication and audited export. Project deferrals are explicit; operator declarations and factual setup counts are distinct. This supports field UAT tracking without marking NFR-07, physical peripheral compatibility or off-machine recovery verified. See [Phase 6](PHASE-6.md).


## Phase 7 verification

The management-read-model increment adds repeatable-read trends, recent invoice navigation and product stock reconciliation without changing financial postings. New isolated PostgreSQL tests verify tax/refund/cost totals, branch boundaries and cashier masking. See [Phase 7](PHASE-7.md) for the current execution record and remaining acceptance limits.


## Phase 8 count controls

Migration 009 adds immutable count sheets and movement-count snapshots. New single-batch API clients must submit the movement snapshot; historical pending counts without one require a fresh recount. Blind responses/print projections omit expected quantities, while authorized inventory access elsewhere is unchanged. Owner thresholds never remove second-person approval. See [Phase 8](PHASE-8.md) for evidence, compatibility and operational limits.


## Phase 9 purchase orders

Migration 010 adds immutable internal orders and actual receipt links. Orders create no stock or debt; actual invoices post through atomic receiving. Concurrent receipts cannot exceed outstanding packs, and password-confirmed remainder cancellation preserves prior postings. See [Phase 9](PHASE-9.md) for verification and scope limits.

## Phase 10 supplier master

Migration 011 expands supplier contact details and adds revision-controlled owner/manager editing. Current supplier names remain live master references in historical purchasing views. Existing due dates/payable are preserved; future receipts use current terms. Phase 20 adds invoice-level discount/tax posting under its documented proportional/whole-paisa limits. Phase 21 implements controlled account openings. The supported residual-value and per-line tax extension is documented in PURCHASE-COSTING.md; other negotiated price-variance/allocation workflows are outside that policy. See [Phase 10](PHASE-10.md).

## Phase 11 audit investigations

The raw audit browser now combines text, local dates, exact action and actor filters. Options include inactive historical staff and system events within the selected branch. Offset paging is not a frozen snapshot during concurrent activity. See [Phase 11](PHASE-11.md).

## Phase 12 catalog classification

Migration 013 adds branch-local category hierarchy and medicine assignments with composite branch foreign keys. The catalog supports descendant and Uncategorized filters. Phase 13 adds count-sheet hierarchy integration and captures category snapshots for new sheets. Phase 14 adds current-category report hierarchy filtering. Phase 15 adds CSV round-trip for assigned category paths and pack units; Phase 16 adds complete category master CSV; historical report classification remains open. See [Phase 12](PHASE-12.md).

## Phase 13 category count scope

Migration 014 captures category metadata on new immutable count sheets. Category scopes include descendants and combine with location/form/product filters. Old sheets explicitly lack category snapshots; stock approval safeguards remain. See [Phase 13](PHASE-13.md).

## Phase 14 report category scope

Category/descendant and Uncategorized filters now apply to valuation, expiry, movements, invoice selection and demand. Scope is current catalog, not historical assignment; sales remain whole matching invoices. Audit exceptions rejects category attribution. See [Phase 14](PHASE-14.md).

## Phase 15 catalog classification CSV

Assigned category-name paths now round-trip through category_path_json alongside pack units. Imports create new active products only and roll back categories/products together on failure. Phase 16 supplies unused nodes through a separate master CSV; historical classification remains outside catalog CSV. See [Phase 15](PHASE-15.md).

## Phase 16 complete category master CSV

Separate export includes every current category, including unused nodes. Previewed additive import reuses branch-local sibling names and atomically creates missing ancestors within existing limits, without changing medicine assignments or financial records. See [Phase 16](PHASE-16.md) for verification and remaining limits.

## Phase 17 unsuspended online carts

Migration 015 adds transient server drafts with revision checks, replay-safe clearing, 24-hour expiry and current-price recovery. Browser storage contains only scoped references; sign-out/expiry/idle lock forget them. Recovery and checkout/suspension guards recognize an already-posted invoice without changing financial idempotency. See [Phase 17](PHASE-17.md) for tested scope and remaining durability limits.

## Phase 18 cashier keyboard and dialog access

The proposed online keymap now includes customer/discount and contextual audited receipt printing. Shared dialogs have accessible names, deliberate entry/return focus and pending-operation Escape protection. Skip navigation and selected contrast/focus improvements support keyboard use; full accessibility and physical keymap acceptance remain separate. See [Phase 18](PHASE-18.md).

## Phase 19 API access review

Generated route metadata is checked against source during builds. A private administrator view/export and isolated denial matrix cover central session/CSRF/role boundaries. Malformed local counter Host/Origin values fail with controlled denials; device sync rejects a missing/malformed bearer header before event validation. Full business-path and deployment review remain separate. See [Phase 19](PHASE-19.md) and the [proposed remaining roadmap](REMAINING-ROADMAP.md).

## Phase 20 purchase invoice adjustments

Migrations 016/017 capture immutable invoice/lot components and enforce their inventory, credit and operational-journal reconciliation. Both direct and order receipts use explicit invoice tax treatment and exact whole-paisa unit costs. Legacy data/retries are preserved. Migration 022 supersedes those fractional/mixed-treatment limits for new receipts; see PURCHASE-COSTING.md. See [Phase 20](PHASE-20.md).

## Phase 21 account openings

Customer/supplier opening debt and account credits use separately evidenced immutable sources, explicit effective/due dates, allocated settlements and expected-remainder corrections. Combined balances/aging and customer credit limits include them. Immediate source-matched GL posting, as-of opening/control reconciliation and restore-integrity checks preserve operational history. Automatic invoice-credit allocation, real-payment reversal, a complete opening trial balance and period locks remain outside this scope. See [Phase 21](PHASE-21.md) for verification and limits; field/production acceptance remains pending.

Retained-fixture qualification finding (Phase 21): the direct receipt and offline preparation selectors currently use the first 100 catalog results. Larger catalogs need searchable/paginated selection; repeated acceptance data can hide the seeded Panadol fixture. The customer directory also retains its existing 500-row picker bound. Phase 24 subsequently adds searchable/paginated medicine and customer selection and isolated 105-medicine/505-customer acceptance evidence; see PHASE-24.md. This historical finding describes the Phase 21 state.

## Phase 22 bank reconciliation

Submitted statement text and rows, reviewed exact bank matches/releases, constrained fee/interest/clearing adjustments and signed outstanding carryover are preserved with immutable checksummed closing evidence. Bank postings cannot be backdated into a closed bank period; as-of closing snapshots and exported bytes remain stable. Recovery checks source text, matching, journals and closing evidence. See [Phase 22](PHASE-22.md) for execution evidence and limits. Multiple bank subaccounts, FX, automatic bank-format/sign inference, split book entries across statement lines, unsupported initial outstanding history and full accounting-period closing remain outside this scope. Existing picker/deployment/field gaps remain tracked.

## Phase 23 recorded as-of classification

Migration 020 baselines current state without inventing prior history and captures later category/medicine/batch changes atomically. Five operational reports offer explicit recorded AS_OF classification, aligned financial/quantity cutoffs, historical tree/descendant scope and separate Unknown versus captured Uncategorized. CURRENT reports retain their old meaning. CSV metadata/data records, cutoff reuse and restore-source consistency are verified; exact commit visibility, inferred uncaptured history, historical offline reservation state and immutable report storage are not asserted. Existing count-specific snapshots and audit evidence are preserved. See [Phase 23](PHASE-23.md) for actual verification and limits.

## Phase 24 completed within accepted scope

Receipt and offline preparation now have searchable/paginated active medicine selection beyond the initial 100 results; draft receipt products/units and offline quantities survive page changes. Checkout customer selection and customer ledger review now search name/phone and page beyond 500 rows, retaining the selected account. An isolated fixture includes 105 additional medicines and 505 customers; verification is recorded in [Phase 24](PHASE-24.md). PKR-only scope is accepted and currency switching/FX are deferred. Automatic FEFO is accepted; migration 022 adds fractional purchase costs and per-line tax. Manual checkout overrides remain explicitly deferred. See PURCHASE-COSTING.md for the supported residual-value policy.

## Phase 25 release qualification

Versioned exact package inventory/hash verification, installer/launcher/supervisor integrity preflight and unknown/non-prefix migration refusal are implemented. The committed isolated acceptance runner generates its own database/account secrets and controls only its own PostgreSQL cluster. The Windows CI definition includes full Chromium, Firefox smoke and installed-package qualification; actual hosted execution remains pending. Local bootstrap, current-version encrypted backup restore, same-candidate side-by-side configuration preservation and shutdown evidence are recorded in [Phase 25](PHASE-25.md). The unsigned candidate and local guards do not resolve publisher signing, a production service policy, host/TLS/least privilege/monitoring, full target/runtime/accessibility coverage, schema-incompatible recovery or Phase 26 physical acceptance. Phase 24 PKR-only/automatic-FEFO choices are accepted and fractional/per-line costing is implemented.

## Phase 26 field evidence and handoff preparation

Structured field declarations add observed device/operator/release references, measured targets/results, append-only named history, retry protection, branch boundaries and owner re-authentication. The combined repeatable-read pilot/field export carries an audited checksum and always states production_approved=false, with the Phase 25 external gate still open after completing Phase 24. Actual 80 mm printing/USB scan evidence, off-device custody/recovery, RPO/RTO, cashier training and external owner approval remain pending. Procedures and an explicitly uncompleted template are in FIELD-ACCEPTANCE.md and FIELD-HANDOFF-TEMPLATE.md; verification and the storage-capacity interruption are tracked in PHASE-26.md.

## Accepted currency scope - 25 November 2026

The user selected PKR only. This closes the Phase 24 currency decision, with configurable base currency and FX explicitly deferred for the current scope. Profile/new-branch configuration rejects unsupported currencies, existing clients may omit the field, and Administration displays PKR (fixed). No historical amount is converted. Mandatory automatic FEFO is also accepted; fractional/mixed-treatment costing is implemented by migration 022; Phases 25/26 retain their external gates.

## Accepted stock allocation scope - 25 November 2026

The user selected automatic FEFO. The existing online and prepared-offline eligible-stock allocator remains mandatory, including its expiry/status exclusions and deterministic tie-break. Manual batch overrides are explicitly deferred for this scope. This closes the Phase 24 FEFO decision without changing posted allocations, stock, reservations or financial history. The requested fractional/per-line costing implementation completes the remaining Phase 24 software scope.


## Fractional and per-line purchase-costing follow-up

Migration 022 adds exact four-decimal selected-pack PKR inputs, receipt basis ratios and residual lot/allocated/movement values, including reserved offline value, returned stock, supplier credits, transfers and count/writeoff costing. Direct/order forms support per-line discounts and explicit capitalized/recoverable/exempt tax amount/rate entry. Reports, profit and operational journals use exact value snapshots; restore checks include modern inventory values. Historical nullable snapshots retain their legacy interpretation without revaluation. See PURCHASE-COSTING.md for supported limits and PHASE-24.md for actual validation results. Phases 25/26 external gates remain open.
