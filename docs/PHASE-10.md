# Phase 10 - supplier directory and future invoice terms

Authorized as the next sequential increment after Phase 9. Source: 0.10.0-dev.1. Verification date: 20 November 2026. Status: this software increment is complete.

## Workflow and boundaries

Purchases includes a searchable, paginated supplier directory. Supplier records support a contact person, phone, email, address, registration identifier, tax identifier, notes and payment terms from 0 to 365 days. Search covers name, contact, phone, email and identifiers; each page contains up to 25 records. Existing receipt/order supplier selectors retain their established interface.

Purchase writers can create suppliers. Owners/managers can edit supplier details with a mandatory reason. Each edit locks the selected branch record, validates its revision and records the previous and new details in the immutable activity audit. A stale revision returns 409 instead of overwriting another user's work. Close or reload the directory and open the current record before applying revised edits. After a lost response, reload and inspect the current record before submitting again; editing is not a financial posting and has no automatic retry key.

Changed payment terms apply when future actual invoices are received, including receipts against older purchase orders. Existing invoice due dates, stock quantities, supplier payable, settlements and journal records are preserved. The directory stores current master details; existing purchase/ledger views continue to resolve the current supplier name. This increment does not introduce historical supplier contact/name snapshots, duplicate supplier merging, supplier deletion, opening balances or bank/payment details. Contact identifiers are operator-entered data, not verification of legal or fiscal status. No email or other supplier communication is sent.

## Data and access

Migration 011 adds contact/address/identifier/notes fields, revision 1 for existing suppliers and a branch/name index. Existing records receive empty optional values; their terms are retained. The creation endpoint remains compatible with the existing minimal name/phone/terms input. The new branch-scoped GET /api/supplier-directory requires purchase-read permission. PUT /api/supplier-directory/:id requires both purchase-write and inventory-approval permission, restricting editing to owners/managers. Clerks retain create/read access; accountants/auditors retain purchase-read access. Cashiers have no directory access. Existing authentication and CSRF controls apply.

Updates use a complete validated record plus revision and reason. Blank optional fields are stored as empty strings; omitted optional fields take their defaults. Clients must load and preserve the current fields when submitting an update. User/branch identities are taken from the session. No arbitrary branch, balance or revision increment is accepted from request fields.

Apply migrations before running the updated source. The frozen Phase 5 Windows archive is unchanged; no new packaged release or production installation is implied. Older programs must be reviewed for schema/workflow compatibility before use with the upgraded database.

## Verification

The final production build and all 29 automated tests passed. The isolated supplier database test covers input bounds, contact/identifier search, pagination, branch isolation, concurrent stale-edit refusal, audit before/after details, unchanged existing due dates/payable, updated future due dates and stock reconciliation. All 18 browser journeys passed in the final full run (approximately 3.2 minutes), including supplier contact editing, identifier search, stale update refusal and clerk read/edit boundaries. An earlier interrupted run had timeouts in supplier credits and physical counts; both passed on the clean rerun without weakening assertions or increasing timeouts. Migration 011 was applied to the retained demo database. The directory/editor was visually reviewed at a 1366 x 768 viewport; the ephemeral capture is test-results/phase-10-suppliers.png. Local Markdown document links resolve.

## Handoff and remaining work

Open Purchases to find Supplier directory. Search by name, contact or identifier. Owners/managers can open Edit supplier, update the details and future invoice terms, enter a reason and save. Use Add supplier to create a supplier, then receive stock directly or through a purchase order.

Purchase invoice tax/discount metadata, opening balances, bank reconciliation and the other matrix gaps remain open. Physical printer/scanner and off-device recovery checks remain user-deferred; operator acceptance and production approval remain pending. Phase 11 has not started.
