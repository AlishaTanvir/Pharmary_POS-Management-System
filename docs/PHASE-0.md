# Phase 0 — discovery review

> Historical phase snapshot. Later-phase status and unresolved baseline requirements are maintained in [REQUIREMENTS-MATRIX.md](REQUIREMENTS-MATRIX.md) and [PHASE-5.md](PHASE-5.md). Statements about future phases below describe the situation when this report was written.
Status: user authorized progression to Phase 1 on 17 November 2026. Site-specific hardware and business confirmations remain tracked. Source: SRS v1.0, 16 November 2026. Do not interpret UI examples as verified operational behavior.

## Proposed scope to confirm

One Pakistan pharmacy, one branch, PKR, Asia/Karachi, Windows-friendly cashier and responsive web administration. Authoritative PostgreSQL, Node/TypeScript domain API, React/TypeScript UI. Preserve branch IDs in every transactional entity and enforce branch and permission checks on the server. A Tauri client, SQLite outbox and hardware adapter require Windows delivery and physical-device validation; a browser website alone does not fulfill those requirements.

## Workflow sketches

`dist/index.html` offers Dashboard, Point of sale, Medicines, Batch inventory, Purchases, Sales history and Delivery plan views. Search, view switching, illustrative cart quantity/unit controls and payment review are interactive. Posting is deliberately unavailable in discovery.

Sale: open shift → scan/search → select pack unit → validate stock and prescription permissions → FEFO allocation → quote → payment → atomic posting → receipt. Printer failure must not reverse a posted sale.

Purchase: supplier bill → validate reference → medicine/batch/expiry/units/cost → review → atomic receipt, movements and payable.

Returns in Phase 2: original invoice → remaining returnable quantities → approval and reason → refund record → quarantine. No deletion of sale history.

## Decisions and evidence required

| Decision | Proposed baseline | Required confirmation |
|---|---|---|
| Store identity | Single store; neutral demo branding | Legal/trading name, address, phone, registration identifiers, logo, receipt footer |
| Deployment | Browser administration + Windows cashier | Browser-only versus Tauri, local/server hosting, number of tills and concurrent users |
| Hardware | HID barcode scanner; 80 mm print layout | Scanner formats, printer make/model/interface, 58/80 mm, drawer, sample printed invoice |
| Catalog | Integer smallest units; box/strip/tablet | Real sample catalog, pack conversions, barcodes, loose-unit and pricing rules |
| Tax | Unconfigured; no fiscal references generated | Applicable registration, tax rounding and regulator integration signed off by qualified stakeholders |
| Restricted products | Human pharmacist approval | Prescription retention, approval rules, controlled-product restrictions |
| Credit and discounts | Policy disabled until confirmed | Credit limits, discount limits, manager approvals and tender providers |
| Offline | Phase 3, single-terminal or allocated stock | Outage procedure and multi-terminal stock coordination |
| Recovery | Proposed RPO 24h, RTO 4h | Owner, off-device encrypted destination, key custody, restore drill |
| Scale | SRS targets, unmeasured | Actual SKUs, invoice volume, Windows versions, representative workload |

No regulatory applicability, hardware compatibility or performance target has been verified by this discovery delivery.

## Ordered Phase 1 backlog and acceptance

| Order | Deliverable | Traceability / exit evidence |
|---|---|---|
| 1 | PostgreSQL schema/migrations, seed data, branch scoping, decimal money and integer units | Constraints, migrations, unique branch invoice and idempotency keys |
| 2 | Authenticated sessions, user roles, profile, deny-by-default API permissions | FR-001–003; key AT-13 permission cases; secure password hash, session lock |
| 3 | Medicine catalog, aliases/barcodes, pack pricing | FR-010–012; AT-01, AT-02 |
| 4 | Suppliers, batch goods receipts, immutable movement and payable posting | AT-10; duplicate supplier reference and transaction rollback checks |
| 5 | Eligibility and FEFO allocation | FR-013; AT-03–05; expired/recalled/quarantined rejection |
| 6 | Quotes, atomic checkout, split tender, snapshots and idempotency | FR-014–016; AT-05–07; concurrency and failure-injection tests |
| 7 | Receipts and printer adapter, retained invoices/reprints | FR-017–018; AT-08 and physical printer test; DUPLICATE label |
| 8 | Dashboard, sales history and daily reporting | FR-004; persisted sales/payment/stock reconciliation |

Foundation audit records accompany mutations from Phase 1; advanced audit review, returns, shift reconciliation, ledgers, alerts and backups are Phase 2. Offline claims require Phase 3 acceptance. Multi-branch operations and fiscal connectors belong to Phase 4 when applicable. Catalog CSV import is a Should requirement and remains tracked rather than silently assumed complete.

## Quality and delivery gates

Phase 1 must pass AT-01–08, AT-10 and key permission checks. Include unit tests for monetary rounding, conversion and allocation; database integration tests for atomicity, concurrency and idempotency; scan-to-receipt end-to-end checks. Do not replace database tests with UI mocks.

Phase 2: AT-09, AT-11–13, AT-15–16 and reconciliation/security/recovery evidence. Phase 3: AT-14 and conflict/failure drill. Phase 4: branch access and integration UAT.

Required subsequent artifacts: ERD, API contract, architecture decisions, environment template, CI, migration/seed tooling, test plan, Windows installer, hardware guide, backup/restore guide, operator manual and deployment runbook.

## Phase 0 exit checklist

- [x] Read and retain full SRS baseline.
- [x] Prepare workflow sketches and ordered acceptance backlog.
- [x] Record assumptions, hardware inventory questions and regulatory decisions.
- [ ] Obtain real sample invoices and catalog/hardware inventory.
- [ ] Confirm open business and deployment decisions.
- [x] User authorized the next implementation phase after receiving the sketches. Stakeholder operational sign-offs remain separate.

Phase 1 was explicitly authorized in the conversation. Real sample data, hardware tests and operational sign-offs remain required before live deployment.
