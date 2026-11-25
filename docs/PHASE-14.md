# Phase 14 - category-scoped operational reports

Authorized as the next sequential increment after Phase 13. Source: 0.14.0-dev.1. Verification date: 20 November 2026. Status: this software increment is complete.

## Workflow and interpretation

Daily reports / Operational reports adds Report category independently of the existing Medicine form / audit action text filter. A selected parent includes its descendants; Uncategorized selects medicines without a category. All categories retains prior behavior. Hierarchy filtering applies to stock valuation, expiry exposure, batch movement reconciliation, sales invoices and fast/slow movers. Category options come from the selected branch's current catalog.

Reports use current category membership at generation time, even when their dates describe older postings or through-date inventory. They do not reconstruct category assignments as of the reporting period. Moving or reclassifying a medicine can change which rows a later regeneration includes. Each response identifies its scope and CURRENT_CATALOG basis; screen/PDF notices state that interpretation.

Sales rows remain whole matching invoice totals, including mixed-category invoices. A category filter identifies invoices containing a matching medicine; it does not allocate invoice revenue, tax, discount, cost or returns to that category. Do not sum independently filtered invoice reports as category revenue. Existing invoice and lifetime-return notices remain explicit.

Audit exceptions have no reliable medicine-category attribution. Their hierarchy control is disabled and cleared when switching to that report; the API rejects an explicit hierarchy filter rather than silently ignoring it. Existing action/actor/text filters remain available, and response scope is NOT_APPLICABLE. The existing category output column in product reports still means dosage form for compatibility; the new hierarchy input is category_id.

## Export and UI behavior

Nonempty hierarchy-filtered CSV/report rows include category_scope and category_basis alongside the original columns. This keeps the selected path and current-classification basis with exported values. The audited export event records the chosen ID, path, descendant flag, basis and row count. Empty exports retain the existing no-data behavior; they provide no attributed data rows. Print/save-to-PDF uses the same report result and scope notice. The invoice-total limitation applies to every format.

Changing a filter clears the previous result. Inputs are disabled during generation, and failed requests leave no prior report displayed as if it matched new filters. Category options load on entering reports; re-enter/refresh the page after changes elsewhere. Existing row paging, 100,000-row export cap, 10,000-row print cap, formula-safe CSV values and date validation remain.

## Data and access

No migration or financial posting change is introduced. Operational report transactions already use repeatable-read isolation, so the current category tree and underlying query share a consistent database snapshot. A branch-scoped medicine projection applies the category/descendant filter across all five product queries. Unknown/foreign category IDs return 404, and the existing report permission remains required for options, preview and export. Cashiers remain denied.

GET /api/reports/options adds category_tree while retaining the existing dosage-form categories list. POST /api/reports/operational adds optional category_id (UUID or UNCATEGORIZED), leaving omitted/blank behavior compatible. Existing category text remains the form/action filter. Response/export scope metadata is additive. Category filtering does not bypass lifecycle, costing, supplier, date or actor behavior documented for each report.

The frozen Phase 5 Windows archive remains unchanged. This is a source increment, not a new production installation or approval.

## Verification

The full automated suite passed all 37 checks (approximately 87 seconds). The final audit-exception scope annotation passed the targeted report-category rerun (two checks), and the final production build passed. New isolated PostgreSQL tests cover all five product kinds, parent/child membership, Uncategorized, independent form/supplier filters, foreign categories, whole mixed-invoice totals, CSV scope/basis, export audit metadata, current reclassification and unchanged stock/payable. All 22 browser journeys passed in the full run (approximately 3.6 minutes), including descendant/Uncategorized selection, CSV scope/basis, cleared stale results, disabled audit category input and cashier denial. The report screen was visually reviewed at 1366 x 768; its ephemeral capture is test-results/phase-14-report-categories.png. Local Markdown document links resolve. A bounded set of 12 stopped historical test databases was NTFS-compressed without deleting records to support verification; about 1 GiB of space remained free afterward. Temporary demo services were stopped at handoff.

## Handoff and remaining work

Open Daily reports, choose a product report, set Report category and other filters, and run or export. Read the scope/valuation/status/invoice notices before interpreting totals. Audit exceptions continues to use actions and actors.

Historical report classification, category CSV import/export round-trip, purchase invoice tax/discount metadata, opening balances and other matrix gaps remain open. Printer/scanner and off-device recovery checks remain user-deferred; operator acceptance and production approval remain pending. Phase 15 has not started.
