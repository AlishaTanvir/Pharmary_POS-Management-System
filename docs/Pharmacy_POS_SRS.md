# Pharmacy POS & Management System — Complete Software Requirements Specification (SRS)

*Product, workflows, data model, architecture, controls, and acceptance criteria*

## Document Control

| Detail | Value |
|---|---|
| Document version | 1.0 — baseline specification |
| Requirements baseline | v1.0, 16 Nov 2026 |
| Prepared on | 16 November 2026 |
| Target deployment | Pakistan-first, single-pharmacy MVP; multi-branch ready |
| Intended readers | Owner, product manager, software developers, QA, pharmacist, cashier, implementation team |
| Status | Proposed requirements — subject to stakeholder approval |

**Design assumptions:** PKR currency; barcode scanner + thermal receipt printer; Windows counter computer; optional browser dashboard; batch-level medicine inventory; offline-capable checkout. Legal/tax configuration is validated at rollout.

> **Note:** This is a product-development specification, not legal advice or a confirmation of regulatory applicability. Verify current DRAP, provincial drug-sale and FBR requirements before production deployment.

## Contents

1. Executive summary and scope
2. Stakeholders and permissions
3. Core functional requirements
4. POS billing and returns
5. Medicine catalog, units and stock
6. Purchase and supplier operations
7. Accounting and management reports
8. User experience and screen inventory
9. Workflows and business rules
10. Conceptual data model
11. API and integration requirements
12. Technology and architecture
13. Security, privacy, audit and backup
14. Non-functional requirements
15. Testing and acceptance criteria
16. Delivery phases, priorities and dependencies
17. Risks, assumptions and open decisions
18. Compliance considerations and sources

---

## 01. Executive Summary and Scope

The product is an integrated Pharmacy Point of Sale (POS) and Management System to handle medicine sales, printed receipts, purchase intake, batch-based stock, expiry management, supplier/customer balances, cashier shifts, business expenses, and reporting. The product must preserve an auditable transaction history and support rapid counter operation.

### 1.1 Business objectives

- Reduce checkout time and manual billing errors.
- Provide trustworthy stock quantity by medicine, package unit, batch, expiry, and location.
- Prevent checkout of expired, recalled, quarantined, or otherwise blocked batches.
- Track purchase cost, selling price, cash collection, margins, liabilities, and returns.
- Provide actionable low-stock/near-expiry alerts and end-of-day reconciliation.
- Support one store at launch while allowing an upgrade to multiple branches.

### 1.2 In-scope and out-of-scope

| In scope — baseline | Not included by default |
|---|---|
| Counter sales, cash/card/mixed payments, receipts, credit/refunds | Diagnosis, automatic prescribing, clinical decision-making |
| Supplier purchases, batch/expiry inventory, stock count | Insurance claim adjudication or hospital EMR integration |
| Role permissions, reporting, logs, local backup | Online pharmacy delivery marketplace |
| Configurable tax and future compliant integration hooks | Claim of automatic FBR/DRAP compliance without validation |

### 1.3 Product variants

- **MVP:** one branch, Windows POS, inventory, purchases, receipts, admin reporting.
- **Production:** offline-first sync, audit controls, backup restore, advanced returns, accounting, security.
- **Enterprise:** multi-branch, transfer, centrally governed catalog, integration connectors.

---

## 02. Stakeholders and Permissions

| Role | Capabilities | Restrictions |
|---|---|---|
| Owner / Super Admin | All settings, financial reports, user access, corrections, backup oversight | Critical activities require re-authentication and audit |
| Pharmacy Manager | Inventory, purchasing, stock adjustment approval, analytics | Cannot erase transaction history |
| Licensed Pharmacist / Supervisor | Review restricted products, substitutions, prescription-linked workflow | Clinical decisions remain human-controlled |
| Cashier | Search, scan, bill, take payments, reprint own receipts | Cannot modify cost, delete finalized sales or edit other shifts |
| Stock Clerk | Goods receipt, physical count, batch tracking, supplier returns | Cannot approve own high-impact write-offs |
| Accountant | Payables, receivables, expenses, closing, finance exports | Cannot alter historical posted sales |
| Auditor / Read-only | Read reports, log review, export under policy | No create/edit/delete privileges |

**Permission model:** deny by default; permission checks are enforced on the backend (not only by hidden UI elements); branch scoping applies to every data query and mutation.

---

## 03. Core Functional Requirements

### 3.1 Requirements catalog — administration

| ID | Priority | Requirement / testable behavior |
|---|---|---|
| FR-001 | Must | Secure user login, logout, password reset by administrator and configurable session timeout. |
| FR-002 | Must | Role-based permissions for sales, approvals, purchases, reports, exports and settings. |
| FR-003 | Must | Pharmacy profile: trading name, address, phone, registration/tax identifiers as applicable, invoice footer and logo. |
| FR-004 | Must | Daily home dashboard: gross/net sales, refunds, payment totals, low stock, expiry alerts. |
| FR-005 | Must | Immutable financial posting history; corrections via new reversing/adjustment records. |
| FR-006 | Must | Searchable activity audit: actor, timestamp, branch, action, old/new values, reason. |
| FR-007 | Should | Branch/counter settings, configurable currency, tax treatment and price policies. |
| FR-008 | Should | Import/export medicine catalog via validated CSV with preview and error reporting. |

### 3.2 POS and sales requirements

| ID | Priority | Requirement / testable behavior |
|---|---|---|
| FR-010 | Must | Add items by barcode, generic/trade name, SKU or searchable aliases; keyboard-first operation. |
| FR-011 | Must | Select medicine sell unit: box/strip/tablet or other preconfigured conversion; update base-unit stock accurately. |
| FR-012 | Must | Show available, sellable batch quantities, current price, expiry and blocked-stock warning. |
| FR-013 | Must | FEFO suggestion: earliest-expiring eligible batch first, with manager-approved override if required. |
| FR-014 | Must | Manage cart quantities, discounts (permission-based), taxes, rounding and sale notes. |
| FR-015 | Must | Accept full/partial cash, card, digital wallet and split tender; compute cash change. |
| FR-016 | Must | Atomically finalize sale, allocate batch quantities, record payment(s), issue unique invoice number. |
| FR-017 | Must | Print or reprint 58/80 mm receipt, clearly labeled DUPLICATE on reprint. |
| FR-018 | Must | Search past invoices by number, product, date, cashier; show detailed lines/payments. |
| FR-019 | Must | Support refund/return referencing original invoice/batch, reason, approval, refund instrument. |
| FR-020 | Should | Suspend/retrieve carts and support customer accounts or credit sales subject to policy. |
| FR-021 | Should | Open/close cashier shifts; expected vs counted cash, paid-outs, variance sign-off. |

---

## 04. POS Billing and Returns

### 4.1 Successful checkout — main path

1. Cashier opens shift, scans or searches medicine and selects selling unit.
2. System checks stock eligibility, expiry, blocked/recalled status and quantities.
3. System allocates eligible batches (FEFO by default), calculates totals from configured unit pricing, applies authorized discounts.
4. Cashier selects payment methods and confirms amounts; system assigns invoice identifier only upon finalized posting.
5. Database transaction writes invoice, sale lines, batch allocations, stock movements, tender records and audit trail together.
6. Receipt is printed; if printing fails, sale remains posted and is reprintable without charging or posting twice.

### 4.2 Invoice content

- Invoice ID, timestamp/timezone, pharmacy legal/trading details, branch and cashier.
- Medicine trade name, strength/form, sale unit, quantity, unit selling price, discount, taxes if applicable, line total.
- Batch/expiry on merchant copy and where required on customer copy; privacy-sensitive information minimized.
- Sub-total, discount, tax breakdown, net payable, tender breakdown, paid amount, change/balance due, return policy.
- Configured regulatory identification, QR code or fiscal invoice references only when applicable and integrated.

### 4.3 Returns rules

- Require original invoice reference except authorized documented exception; disallow returning more than sold.
- Refund is recorded as a new transaction; never erase the original sale.
- Returned stock defaults to **QUARANTINED** unless an authorized quality decision permits restocking.
- Prevent duplicate refund for the same item quantity; preserve batch relationship and original payment reference.
- Controlled/restricted medicines may require additional restrictions and pharmacist authorization.

### 4.4 Price calculations

Use decimal arithmetic with explicit rounding policy. The displayed total must equal the sum of persisted line-level amounts plus applicable taxes/fees minus approved discounts. Store selling price and purchase cost snapshots at transaction time to preserve historical financial correctness; updates to catalog prices must not rewrite historical invoices.

---

## 05. Medicine Catalog, Units and Stock

### 5.1 Medicine master data

- SKU/internal code, one or more barcodes/GTIN where provided, trade name, generic/active ingredient, strength, form, manufacturer, category and supplier references.
- Purchase unit, sale unit, base unit, pack conversion (e.g., box = 10 strips, strip = 10 tablets), decimals only where medically/commercially appropriate.
- Prescription/controlled flag, storage condition, reorder threshold, default tax and default prices, active/inactive state.
- Product images optional; catalog does not replace licensed medicine advice.

### 5.2 Batch record

- Every received batch links to a medicine, supplier goods receipt, batch/lot code, expiry, quantity, cost, received date, location and lifecycle status.
- Status: `AVAILABLE`, `QUARANTINED`, `RECALLED`, `EXPIRED`, `DAMAGED`, `RETURNED` or `DISPOSED`; **only AVAILABLE stock is saleable**.
- Quantity on hand and available-to-sell are derived through movements and reservations; support physical recounts with approval.
- Expiry policy uses local calendar date, configurable cutoff and distinct alerts at 90/60/30 days.

### 5.3 Inventory rules

| ID | Rule |
|---|---|
| BR-01 | Never allow negative saleable stock for a finalized retail sale. |
| BR-02 | All stock changes create append-only `inventory_movement` records with reference and actor. |
| BR-03 | Base-unit normalization: 1 box of 10 strips × 10 tablets = 100 base tablets. |
| BR-04 | A batch past expiry date or blocked/recall status is not selectable at checkout. |
| BR-05 | No physical count overwrites stock history; post approved variance adjustment. |
| BR-06 | Cost and margin derive from batch allocations / selected approved costing model. |
| BR-07 | Record all multi-batch allocations, including when a line crosses two batches. |

### 5.4 Inventory transactions

- Receive stock; reserve/release stock; sale; sale return to quarantine; supplier return; transfers (future); write-off; expiry disposal; recall quarantine; physical count variance.
- Every movement stores product, batch, branch, movement type, quantity in base units, reference type/id, timestamp, actor and reason.
- Low-stock threshold based on saleable stock; purchase suggestions may consider demand history and lead time.

---

## 06. Purchase and Supplier Operations

### 6.1 Purchase lifecycle

- Create purchase order (optional in MVP) or direct supplier bill; capture supplier invoice reference.
- Receive products by batch, expiry, pack units, quantity, purchase cost, invoice discount, tax and selling price metadata.
- Validate duplicate supplier invoices and duplicate line identifiers under configurable rules.
- Post goods receipt atomically to batch quantities, stock movements and supplier payable ledger.
- Record part/full payments and credits, process purchase return and supplier credit note with ledger linkage.

### 6.2 Supplier entities

- Supplier legal name, contact/address, registration or tax information if needed, account opening balance, payment terms and credit limit.
- Supplier ledger shows opening balance + purchases − payments − accepted credit notes; reconciled chronologically.
- Aging buckets: current, 1–30, 31–60, 61–90, 90+ days; invoice-to-payment allocation.

### 6.3 Stock count & reconciliation

- Generate count sheet by shelf/category/batch, allow blinded count, calculate variance, require manager approval above threshold.
- Record discrepancy reason (breakage, theft, missing receipt, data correction, expiry loss) and keep before/after history.

---

## 07. Accounting and Management Reports

### 7.1 Cash and financial requirements

- Separate sale revenue, payment collection, tax liability, discounts, refunds, cost of goods sold and gross profit.
- Customer credit ledger: invoices, payment allocations, refunds, opening balance, aging and statement.
- Supplier payable ledger: purchase invoices, payments, debit/credit notes and balance.
- Expenses: category, date, amount, payment account, reference, attachment and approval.
- Cashier shift closing: **opening float + cash sales + cash credit collections − cash refunds − paid-outs = expected cash**.
- Reports allow date range, cashier, branch, product, supplier, category and export to CSV/PDF.

### 7.2 Standard reports

| Report | Minimum content |
|---|---|
| Sales overview | Gross sales, net sales, discounts, tax, refunds, tender mix and invoice count |
| Gross profit | Revenue minus allocated batch cost, with disclaimer for unallocated overhead |
| Stock valuation | Saleable, quarantined and expired quantities; cost by batch and as-of date |
| Expiry exposure | Medicines by days to expiry, remaining quantity and cost exposure |
| Movement ledger | Opening, receipts, sales, returns, adjustments and closing by batch |
| Supplier / customer aging | Outstanding balances, due dates and detailed allocations |
| Cashier closing | Tender totals, expected cash, counted cash, variance and sign-off |
| Fast / slow moving | Top/bottom movers, days of cover, reorder recommendations |
| Audit exceptions | Overrides, voids, reversals, unusual discounts, stock write-offs |

> **Accounting depth:** MVP includes operational sub-ledgers and gross-margin views. A full general ledger, chart of accounts, journal posting and bank reconciliation are optional Phase 2 enhancements, not silently assumed.

---

## 08. User Experience and Screen Inventory

| Area | Screen / key elements |
|---|---|
| Authentication | Login, lock screen, password change, session expiry |
| Dashboard | KPI cards; alerts; trend chart; recent sales; quick actions |
| POS checkout | Large search/scan field; items/cart; batch status; summary; payment modal; keyboard shortcuts |
| Medicines | Search, add/edit, units conversion, prices, flags, product history |
| Batch inventory | Medicine-batch table, expiry calendar, stock cards, adjustments, recall/quarantine action |
| Purchase management | Purchase orders/bills; receiving with batch entry; supplier payments/returns |
| Sales history | Invoices, return/refund workflow, duplicate receipt, tender records |
| Customer accounts | Profiles, credit limits, balances, receipts and statements |
| Suppliers | Contacts, purchase history, due payments, ledger, returns |
| Reports | Preset date filters, drilldown, export and print |
| Cash management | Shift opening, cash in/out, end-of-day settlement |
| Administration | Roles, employee accounts, branch config, taxes, invoice branding, audit, backups |

### 8.1 Design requirements

- Desktop-first UX at 1366×768 and 1920×1080; usable on touch screens but optimized for keyboard and scanner input.
- High-contrast status labels: **red = blocked/expired; amber = near expiry; green = available**; do not rely on color alone.
- Minimize clicks on frequent cashier actions; scanner focus must not unexpectedly move to another form.
- Confirm irreversible operations, and show plain-language error and corrective instructions.
- Create accessible labels, focus states, numeric formatting and visible loading/saving states.

### 8.2 Keyboard shortcuts — proposed

| Key | Action |
|---|---|
| F2 | Search medicine |
| F4 | Quantity edit |
| F6 | Customer |
| F8 | Discount (if permitted) |
| F9 | Payment |
| Ctrl+P | Receipt reprint |
| Esc | Close modal |

Final keymap must be user-tested for conflicts.

---

## 09. Workflows and Business Rules

### 9.1 Workflow matrix

| Workflow | Trigger / output | Failure / recovery |
|---|---|---|
| Checkout | Scan → eligibility → allocate → pay → post → receipt | Out of stock / expired blocks line; payment timeout keeps idempotent state |
| Purchase receive | Supplier bill → batches → validate → post | Validation rejects missing expiry/batch where required; never partial-post silently |
| Return | Locate invoice → select qty → approval → refund/quarantine | Reject already fully returned quantities and unauthorized refund |
| Stock count | Snapshot → count → variance → approval → adjustment | Preserve count snapshot; retain discrepancy and approval |
| Closing | Count tender → compare expected → sign off | Record variance even if zero; prevent duplicate close |
| Offline sync | Local post → durable outbox → server accept/dedupe | Retry with idempotency key; isolate conflicts for review |

### 9.2 Concurrency and idempotency

- Use ACID database transactions and row-level controls/optimistic versioning to avoid overselling.
- Retries of checkout, payment callback, refund or goods receipt must reuse idempotency key; no duplicate business posting.
- If multiple offline terminals share no live inventory coordinator, limit offline sales by pre-allocated stock pools or an approved single-terminal mode; sync alone cannot guarantee no overselling across disconnected terminals.
- Generate unique invoice identifiers without collisions under offline operation using terminal/branch-prefixed sequence or UUID mapping with controlled final numbering.

---

## 10. Conceptual Data Model

Use **PostgreSQL** as authoritative transactional storage. Tables below are conceptual; technical implementation should add primary keys, foreign keys, audit fields, tenant/branch scoping and appropriate indexes.

| Entity | Important fields / relationships |
|---|---|
| pharmacies / branches | pharmacy_id, branch_id, profile, tax_config, timezone, invoice_prefix |
| users / roles / permissions | user_id, password_hash, status, role grants, branch grants, last_login |
| medicines / barcodes / units | medicine_id, generic/trade names, strength, form, barcode, base_unit, conversion factors |
| suppliers / customers | supplier_id/customer_id, contacts, credit policy, account status |
| batches | batch_id, medicine_id, batch_code, expiry_date, unit_cost, lifecycle_status |
| stock_locations / movements | location_id, movement_id, batch_id, quantity_base, movement_type, ref, reason |
| purchase_invoices / lines | purchase_id, supplier_id, vendor_ref, received_at; lines with batch, qty, cost |
| sales / sale_lines / allocations | sale_id, number, status, totals; lines with sale unit and price snapshots; allocations by batch |
| payments / shifts | payment_id, amount, method, sale/refund ref; shift_id, cashier_id, opening/closing cash |
| returns / return_lines | return_id, original_sale_id, line_id, qty, refund, disposition |
| supplier_ledgers / customer_ledgers | ledger_id, source_ref, debit/credit, due_date, outstanding allocation |
| expenses / audit_events | expense_id, category, payment ref; event_id, actor, action, entity, before/after, IP/device |
| sync_outbox / devices | device_id, event_id, idempotency_key, payload_version, status, retry_count |

### 10.1 Relational integrity

- One medicine has many batches; one sale line may allocate multiple batches.
- Every sale is linked to one or more payment records; mixed tender supported.
- Every goods receipt creates stock movements. Every refund links to original sale and return lines.
- Store qty as integer smallest unit when feasible, monetary values as fixed-precision decimals, timestamps as timezone-aware UTC plus location settings.
- Use unique constraints for branch invoice ID, external payment reference, and idempotency keys.
- Use soft-deactivation for master data; prohibit hard deletion of referenced transaction history.

### 10.2 Suggested indexes

- `medicines(normalized_name)`
- `barcodes(code)` — unique
- `batches(medicine_id, expiry_date, status)`
- `inventory_movements(batch_id, created_at)`
- `sales(branch_id, sold_at)`
- `invoices(number)` — unique per branch
- Supplier/customer ledger by account/date

---

## 11. API and Integration Requirements

### 11.1 Example REST endpoints (illustrative)

| Method / Path | Purpose |
|---|---|
| `POST /auth/login` | Create authenticated session and assigned permissions |
| `GET /medicines?query=...` | Paginated barcode/name search |
| `GET /medicines/{id}/availability` | Available quantity grouped by batch and sale unit |
| `POST /sales/quote` | Calculate cart, policy checks and totals without posting |
| `POST /sales` | Finalize sale idempotently with payment and stock allocation |
| `POST /sales/{id}/returns` | Post authorized refund against original sale |
| `POST /purchases/receipts` | Receive supplier batch lines and post stock/payable |
| `POST /inventory/counts` | Create physical count and controlled reconciliation |
| `GET /reports/sales` | Sales metrics with authorized filters |
| `GET /audit-events` | Authorized searchable audit records |
| `POST /sync/events` | Validate, dedupe and apply durable offline events |

### 11.2 Hardware and third-party interfaces

- USB/HID barcode scanners that act as keyboard input; optional camera scanning.
- ESC/POS thermal printers (58 mm/80 mm) over USB, LAN or Bluetooth where device support is verified; test print/encoding/cut/drawer commands.
- Cash drawer trigger via compatible printer; optional label printer and handheld scanner.
- Card payment integration only with approved provider/terminal; never handle or store raw card credentials.
- Potential FBR e-invoice/POS connection must use the officially applicable integration path, credentials, required fields, acknowledgement handling and downtime policies.
- Optional SMS/WhatsApp alerts require explicit consent, supported provider and secure messaging; no unauthorized bulk messaging.

---

## 12. Technology and Architecture

### 12.1 Proposed implementation stack

| Layer | Proposal / rationale |
|---|---|
| Cashier client | Tauri + React + TypeScript; Windows installer, local hardware access |
| Admin console | Next.js/React responsive web application, role scoped |
| Backend | NestJS/Node.js TypeScript; domain modules, validation and background jobs |
| Primary database | PostgreSQL; transactional consistency, reporting indexes, migrations |
| Offline local store | SQLite on POS device; encrypted where practical, durable outbox |
| Data access | Prisma or equivalent typed ORM with raw SQL for critical transactional paths |
| Infrastructure | On-prem server or secured cloud VPS; TLS, monitoring, scheduled backup |
| Printer service | Dedicated local print adapter with ESC/POS and PDF fallback |
| Authentication | Secure password hashing (Argon2id/bcrypt), protected sessions/MFA for admins |

### 12.2 Modules and boundaries

- Identity/roles; catalog; pricing; stock/batches; purchase; sales/checkout; payments; returns; shift/cashbook; ledgers; reporting; audit; synchronization; integrations.
- Organize backend around domain services, not controller-to-table CRUD alone; ensure finance and inventory change together.
- Server remains source of truth for synchronized transactions; local offline journal is durable, authenticated and replay-safe.

### 12.3 Deployment topology

- **Single pharmacy online:** cashier desktop client → secured LAN or cloud API → PostgreSQL.
- **Offline:** local SQLite and printing service → queued transactional outbox → sync service after reconnect.
- Remote admin access uses TLS and secure identity; no direct public exposure of PostgreSQL.

### 12.4 Disaster recovery design

Perform automatic daily encrypted backups plus point-in-time capable strategy where supported. Copy backups off the primary machine and regularly test full restores. Document recovery objectives, backup owners, encryption key custody and emergency sales procedure.

---

## 13. Security, Privacy, Audit and Backup

### 13.1 Controls

- Strong unique authentication, scoped roles, least privilege, inactivity lock, rate limiting, optional MFA for admins.
- Transport encryption TLS; encrypt sensitive backups and device-local stores; protect secret keys outside source control.
- Server-side validation, parameterized queries, input escaping, CSRF protections where appropriate, secure file handling.
- Append-only audit for refunds, discounts, price overrides, purchase corrections, stock write-offs, role changes, login failures and export events.
- Mask personal/customer information on reports not requiring details; restrict export and backup access.
- Data retention and purging policies set by local rules and organization policy; financial/audit data cannot be casually deleted.
- Patch process, dependency scanning, device hardening, antimalware, printer device access controls, security incident response.

### 13.2 Backup and restore acceptance

- Daily backup success/failure visible to owner; off-machine storage and periodic restore verification.
- Backup schedule configurable; database schema version and application build recorded with snapshot.
- Documented one-click or guided restore for authorized administrator; no silent overwrite of new live transactions.

---

## 14. Non-Functional Requirements

| ID | Attribute | Target / acceptance measure |
|---|---|---|
| NFR-01 | Performance | Typical barcode search results under 300 ms locally; checkout UI responsive at 95th percentile under intended hardware load. |
| NFR-02 | Transaction integrity | Zero committed partial invoices or partial stock movements; atomicity is verified by fault tests. |
| NFR-03 | Capacity | Baseline 1 branch, 2–5 concurrent tills, catalog 20,000 SKUs, 1 million sale lines; load-test before scale claims. |
| NFR-04 | Availability | POS can bill during internet outage under approved offline topology, subject to stock allocation controls. |
| NFR-05 | Reliability | After device/app crash, finalized invoices remain durable; unfinalized carts are recoverable when configured. |
| NFR-06 | Security | Access checks on 100% sensitive API endpoints; no raw passwords/card details; admin audit. |
| NFR-07 | Usability | Newly trained cashier can complete simple scan-to-cash sale within target set during field UAT. |
| NFR-08 | Maintainability | Versioned migrations, CI checks, automated tests, feature flags and clear error reporting. |
| NFR-09 | Portability | Support Windows 10/11 where dependency/runtime compatibility verified; admin on current browsers. |
| NFR-10 | Observability | Structured application logs, health monitoring, sync backlog count, print errors and backup status. |
| NFR-11 | Accessibility | Keyboard operability, sufficient text contrast, clear focus order and status text. |
| NFR-12 | Recovery | Proposed RPO ≤ 24h and RTO ≤ 4h for cloud/on-prem incidents; owner to confirm and budget. |

> Performance/capacity figures above are proposed engineering targets, not measured capabilities or service-level guarantees. Test with actual scanner, printer, PCs and realistic data.

---

## 15. Testing and Acceptance Criteria

### 15.1 Test matrix

| Test ID | Acceptance test |
|---|---|
| AT-01 | Scan known barcode → medicine added, correct configured unit/price shown. |
| AT-02 | One box with 10 strips of 10 tablets → sale of 2 strips reduces exactly 20 base units. |
| AT-03 | Two eligible batches → earliest expiry chosen; sales line records exact allocations. |
| AT-04 | Expired/quarantined/recalled batch → checkout blocked with reason. |
| AT-05 | Last eligible stock sold by two concurrent checkouts → at most one succeeds for disputed units. |
| AT-06 | Power/process interruption during checkout → no half-posted invoice or unbalanced movement. |
| AT-07 | Retry identical sale with same idempotency key → one invoice and one stock deduction. |
| AT-08 | Receipt printer disconnected → sale persists, reprint later marked DUPLICATE. |
| AT-09 | Return 1 of 3 items → refund capped to original amount, stock quarantined. |
| AT-10 | Receive batch purchase → stock, cost, supplier payable all post together. |
| AT-11 | Physical count adjustment → approval, reason and immutable before/after audit. |
| AT-12 | Cash drawer closing → expected and counted totals, variance and sign-off correct. |
| AT-13 | Unprivileged cashier attempts cost edit, bulk export, refund override → denied and logged. |
| AT-14 | Internet loss → supported local checkout; reconnect → each event syncs exactly once. |
| AT-15 | Restore most recent backup → consistency checks and sample invoices reconcile. |
| AT-16 | Sales reporting → line totals match persisted sales/returns/payments in sample period. |

### 15.2 Quality gates

- Automated unit tests for pricing, unit conversion, stock allocation, tax rounding and ledger balance.
- Integration tests for transactions, foreign keys, concurrency, sync and permission boundaries.
- End-to-end tests covering scan-to-receipt, returns, purchase receiving, cash closing.
- UAT performed by owner/manager, cashier and pharmacist; record sign-off and unresolved issues.
- Regression tests on Windows installer, USB printer models and backup restore before each production release.

---

## 16. Delivery Phases, Priorities and Dependencies

| Phase | Deliverables | Exit criteria |
|---|---|---|
| 0 — Discovery | Confirmed workflows, sample invoices, hardware inventory, tax/DRAP applicability, signed UI sketches | Approved scope and backlog |
| 1 — MVP | Users, catalog, stock/batches, purchases, POS, printer, sales history, daily reports | AT-01 through AT-08, AT-10, key permissions pass |
| 2 — Production | Returns, shift closing, supplier/customer ledgers, expiry automation, alerts, audit, backups | Reconciliation, security and recovery tests pass |
| 3 — Offline hardening | Local database, event outbox, sync, offline stock safeguards | AT-14 and conflict/failure drill pass |
| 4 — Expansion | Multi-branch, transfers, advanced finance, supplier suggestions, regulator connectors as applicable | Branch-level access and integration UAT pass |

### 16.1 Recommended build order

Database schema/migrations → user/role policies → catalog and unit conversions → goods receipt and movement ledger → batch allocation service → atomic sale posting → receipts → returns → financial reconciliation → offline sync → reporting and administration.

### 16.2 Delivery artifacts

- Product requirements/SRS (this document), architecture decision records, ERD, API contract, wireframes, issue backlog and acceptance tests.
- Source repository, setup guide, environment variable template, automated CI, database migrations, seed demo data and test plan.
- Windows installer, printer setup guide, backup/restore instructions, operator manual, administrator training and deployment runbook.

---

## 17. Risks, Assumptions and Open Decisions

### 17.1 Key risks

| Risk | Mitigation |
|---|---|
| Unit conversion mistakes cause unsafe stock counts | Use base-unit integer quantities and invariant tests for every conversion |
| Offline simultaneous terminals oversell | Pre-allocate sellable quantity per device or central LAN coordinator |
| Printer/model incompatibility | Test physical printers early; provide driver-specific adapters and PDF fallback |
| Expiry data missing in purchases | Mandatory batch/expiry controls and supervised quarantine workflows |
| Unclear regulatory obligation | Obtain tax/legal/pharmacist sign-off on site-specific configuration |
| Backups held on same PC only | Off-device encrypted backup and scheduled restore exercise |
| Excessive cashier privileges | Least privilege and approval/audit for high-risk actions |

### 17.2 Confirm before implementation

- Is the deployment one pharmacy, a chain, or a SaaS sold to multiple pharmacies?
- Windows-only cashier, browser-only, or both? Must billing operate with no internet?
- Number of counters, branches, expected SKUs, invoice volume, printer models and barcode formats?
- Billing for strips/tablets/loose units; specific pack conversion and pricing rules?
- Credit-sales policies, customer accounts, discounts and cashier manager approvals?
- Which tax registrations, drug-sale licenses, controlled medicine workflows and FBR requirements apply?
- Is full double-entry accounting required or just operational reporting/ledgers?
- Minimum backup/recovery commitments and whether sensitive customer/prescription data will be retained?

---

## 18. Compliance Considerations and References

This SRS incorporates traceability, recall, batch and expiry capabilities as prudent system design. Actual duties depend on pharmacy location, licensing, products, legal status and regulator guidance. Compliance is not automatically achieved by software features alone.

### 18.1 DRAP and pharmacy operations

- DRAP Good Distribution Practices guidance describes transaction records with product identification, quantities, batch/expiry and participants; implement retrievable, reliable history and traceability.
- Controls for expired, returned, recalled or temperature-sensitive stock require on-site documented procedures and pharmacist/manager responsibility.
- Prescription and controlled-product workflows must be configured in consultation with a qualified pharmacist and relevant provincial and federal requirements.

### 18.2 FBR

- FBR publishes POS integration legal provisions and e-invoicing guidance. Requirement/technical path should be evaluated for the registered business before rollout.
- If integration is required, do not manually invent fiscal invoice IDs/QR codes; follow the officially applicable licensed integration protocol and failure-handling rules.

### 18.3 Source URLs — official references

- DRAP Good Distribution Practices (2023): https://www.dra.gov.pk/wp-content/uploads/2023/03/Guidelines-on-Good-Distribution-Practices-for-Pharamceutical-Products.pdf
- DRAP QA and supply chain guidelines: https://www.dra.gov.pk/publications/guidelines/qa-lt/
- FBR POS legal provisions: https://www.fbr.gov.pk/pos-legal-provisions/163085/163086
- FBR electronic invoicing FAQs: https://www.fbr.gov.pk/faqs/173967/173969

---

## Final Baseline Decision

Build a batch-aware, offline-capable, Windows-friendly pharmacy POS with a secure web admin dashboard and a PostgreSQL back end. Deliver the first release for one store, but keep branch IDs, permission boundaries and synchronization interfaces in the schema to avoid a redesign when scaling.

*END OF SPECIFICATION*


## Implementation addendum ? 18 November 2026

The v1.0 requirements above remain the baseline. The user authorized Phase 5 production readiness after the original phases 0?4. [Phase 5](PHASE-5.md) records this extension, [the requirements matrix](REQUIREMENTS-MATRIX.md) maps all numbered requirements and additional narrative workflows to implementation/evidence/gaps, and [the operations runbook](OPERATIONS.md) records operator and release acceptance. Historical phase completion does not mean all SRS requirements or field acceptance checks are complete.

Confirmed equipment preference: 80 mm thermal printer and USB scanner. Physical compatibility remains unverified. The user selected an adapter and internal export workflow until an approved regulator provider/documentation is available; live fiscal submission remains unconfigured.


Phase 6 implementation addendum: after the Phase 5 software handoff the user deferred the physical printer/off-device destination checks and requested progression. [Phase 6](PHASE-6.md) covers pilot rollout preparation and acceptance tracking. Deferred controls remain unverified; the baseline above is preserved.


Phase 7 implementation addendum (18 November 2026): [management visibility](PHASE-7.md) adds posting-date trends, recent invoices and role-safe product physical stock history. The original requirements above remain the baseline; operator, peripheral and recovery acceptance are not inferred from software completion.


Phase 8 implementation addendum (18 November 2026): [controlled physical counting](PHASE-8.md) adds blind per-batch sheets, existing location/form/product filtering, owner variance escalation, movement snapshots and reserved-stock safeguards. This extends section 6.3 without replacing the original baseline or the outstanding operator/site acceptance requirements.

Phase 9 implementation addendum (20 November 2026): [purchase orders and partial receiving](PHASE-9.md) adds internal purchasing plans, multi-lot actual receiving, outstanding quantities and audited remainder cancellation. This addresses the optional purchase-order workflow without replacing the baseline or declaring remaining invoice metadata, supplier master and field acceptance gaps complete.

Phase 10 implementation addendum (20 November 2026): [supplier directory](PHASE-10.md) expands contact/address/identifier fields, search and audited revision-controlled editing of future invoice terms. Existing debt/due dates are retained. Invoice tax/discount accounting, opening balances and field acceptance remain tracked gaps.

Phase 11 implementation addendum (20 November 2026): [activity audit filters](PHASE-11.md) adds inclusive Pakistan-local dates, exact actions and historical actor filters to the branch audit browser, addressing the dedicated filter gap in FR-006. Immutable history and existing permissions are retained; deployment security review and field acceptance remain open.

Phase 12 implementation addendum (20 November 2026): [branch medicine categories](PHASE-12.md) adds current category hierarchy, audited assignments and descendant catalog filtering. Count/report hierarchy integration, historical category classification and CSV category round-trip remain explicit gaps; stock and financial postings are retained.

Phase 13 implementation addendum (20 November 2026): [category-scoped count sheets](PHASE-13.md) adds descendant category filtering and immutable category metadata to physical counting. Older sheets are not retrospectively classified. Existing stock/approval controls remain; report classification and category CSV round-trip remain gaps.

Phase 14 implementation addendum (20 November 2026): [category-scoped operational reports](PHASE-14.md) adds current category/descendant filtering across five product report kinds with explicit scope/basis metadata. Mixed-category sales remain whole invoices. Historical report classification, CSV classification round-trip and other matrix gaps remain open.

Phase 15 implementation addendum (21 November 2026): [category-aware catalog CSV](PHASE-15.md) adds portable JSON category-name paths, preview and transactional branch-local creation/reuse alongside new medicine imports. Existing pack-unit and create-only import controls remain. Unused-category master export, historical classification and field acceptance remain separate gaps.

Phase 16 implementation addendum (21 November 2026): [complete category master CSV](PHASE-16.md) adds separate full-tree export including unused nodes and previewed additive import with branch-local name reuse and atomic capacity validation. Medicine assignments, stock and financial history are retained. Historical classification and field acceptance remain separate gaps.

Phase 17 implementation addendum (22 November 2026): [automatic online cart recovery](PHASE-17.md) adds debounced server drafts, same-tab cashier/branch-scoped recovery at current prices, revision/tombstone protection and already-posted checkout detection. Browser storage contains only opaque references. Durability requires a confirmed save; tab loss, physical power-loss testing and deployment acceptance remain explicit limits.

Phase 18 implementation addendum (23 November 2026): [cashier keyboard access and dialog focus](PHASE-18.md) completes the proposed online cashier key bindings and adds accessible shared-dialog names, entry/return focus, busy Escape protection, skip navigation and bounded contrast checks. The final keymap still requires device/operator testing; full accessibility acceptance remains separate.

Phase 19 implementation addendum (23 November 2026): [API access inventory/security review](PHASE-19.md) adds source-checked declared endpoint metadata, isolated session/CSRF/denied-role regressions, private administrator review/export and local boundary hardening. Full business-path/deployment review remains separate. At the user's request, [a proposed roadmap](REMAINING-ROADMAP.md) groups remaining work into phases 19-26; this estimate extends rather than rewrites the original phase table.

Phase 20 implementation addendum (23 November 2026): [purchase invoice adjustments](PHASE-20.md) adds invoice-level discount/tax amounts, explicit capitalization/separate-input-tax selection, exact whole-paisa lot costs, proportional supplier tax credits and matching operational GL components. Legacy history/retries are preserved. Fractional unit costs and allocation policies outside the documented proportional model remain explicit limits; opening balances and other roadmap packages remain separate.

## Phase 21 implementation addendum

23 November 2026: [controlled account opening balances](PHASE-21.md) adds separately evidenced customer/supplier debt/credits, allocated settlement, immutable unpaid-remainder corrections, combined due-date aging/credit limits, immediate source-matched GL posting and as-of account reconciliation. Existing operational history is preserved. Automatic invoice-credit allocation, real-payment reversal, full trial-balance migration and accounting-period locks are outside this phase. Other roadmap and field acceptance work remains separate.

## Phase 22 implementation addendum

23 November 2026: [bank reconciliation](PHASE-22.md) implements the proposed optional advanced-finance work package for one PKR/1030 bank ledger per branch. Normalized signed CSV import, reviewed exact/grouped matches, exceptions, constrained adjustments, signed carryover and immutable closing/export evidence are implemented. Closing protects prior bank dates without rewriting operational history. Bank connections, multiple bank subaccounts, FX, arbitrary statement formats and whole-ledger period closing remain outside the declared scope.

## Phase 23 implementation addendum

24 November 2026: [recorded historical classification](PHASE-23.md) preserves CURRENT reporting and adds an explicit captured AS_OF basis for category trees/assignments, medicine classification/activity and batch lifecycle. Quantities and financial rows align to the same cutoff. Missing legacy periods remain Unknown; existing financial/count/audit history is retained. Capture uses logical database transaction timestamps and does not assert exact commit visibility, inferred external effective dates, historical reservation balances or immutable report storage. Report/CSV coverage metadata and restore consistency checks are included.

## Accepted scope decision - 25 November 2026: PKR only

The user explicitly selected retaining PKR only. FR-007 configurable currency and full FX/multi-currency support are deferred for the accepted current release scope. All monetary values remain whole PKR paisa with the existing 100-paisa scale. No historical values, invoices or balances are relabeled or converted. This decision does not resolve optional FEFO overrides, purchase-costing scope, deployment qualification or field acceptance. See PHASE-24.md.

## Accepted scope decision - 25 November 2026: mandatory automatic FEFO

The user explicitly selected automatic FEFO. The existing eligible-stock allocator stays mandatory for online checkout and the prepared offline pool, with its expiry/status restrictions and deterministic tie-break. Manual checkout batch overrides are deferred; other supervisor approvals do not bypass this policy. Offline allocation uses the prepared pool/snapshot, with central eligibility rechecked at synchronization; disconnected counters do not gain real-time recall awareness. Explicit receiving/return/count/transfer batch references are unaffected. Posted allocations and monetary history are unchanged. Purchase-costing scope remains a separate open decision. See PHASE-24.md.


## Purchase-costing extension - 25 November 2026

The user requested fractional costs and per-line tax support. Migration 022 and the matching app add four-decimal selected-pack PKR costs, exact receipt-value/base-quantity ratios, residual lot value allocation, per-line discounts and explicit capitalized/recoverable/exempt amount or percentage tax. Invoice-level entry remains available; historical snapshots and journals are not revalued. Payments and ledgers remain integer paisa. This supersedes the earlier whole-paisa base-unit divisibility limit and mixed-treatment restriction for new receipts. See PURCHASE-COSTING.md and the Phase 24 verification addendum. PKR-only and automatic FEFO decisions remain in force; deployment and field acceptance remain separate.
