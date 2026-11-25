# Phase 7 - management visibility

Started on 18 November 2026 following the user's next-phase instruction. Phase 6's checklist software was verified before this phase; actual operator/site acceptance remains pending. The previously deferred printer and off-device recovery checks remain unverified. Current source: 0.7.0-dev.1. Status: this software increment is complete; field/production acceptance remains separate.

## Scope and behavior

- The Overview dashboard adds 14/30/90-day net-sales trends ending on its selected report date, period totals, an accessible daily table, audited CSV export and ten recent invoices with detail/duplicate-receipt navigation.
- Aggregation uses Pakistan-local posting dates. Sales and returns are attributed to the dates they were posted, including returns against invoices from an older period. Net sales include configured tax; gross profit removes net tax and stored allocated cost and excludes overhead. Collections are not relabeled revenue. Empty dates are filled with zero rows. Negative net days remain visible below zero on the chart.
- The medicine catalog adds a stock-history dialog with date filters, paginated movement details and physical opening/incoming/outgoing/closing base-unit reconciliation. Physical quantities include blocked and reserved stock; they do not replace the separate sellable-availability checks.
- History is selected-branch scoped. Cost fields require purchase-read permission. Cashiers receive no cost fields, and other staff's sale references are masked; other staff actors/reasons are generalized in cashier responses. Existing invoice-detail permissions remain unchanged.
- Report windows are ordered, valid calendar dates with at most 366 days. Clearing a UI date shows a corrective message. Unsafe reporting totals are rejected rather than silently losing integer precision. Each read uses a repeatable-read snapshot; trend CSV export is audited. No financial transaction, costing policy or database migration changes in this phase.

## Verification and limits

`tests/insights.test.ts` uses isolated PostgreSQL to verify taxed sales/returns/net cost/profit arithmetic, zero-filled dates, branch isolation, physical stock reconciliation, movement pagination and cashier cost/reference masking. Invalid/reversed/oversized dates are rejected. All 23 automated tests passed.

The Phase 7 browser journey compares the trend's one-day totals with the existing daily report, exports 30 daily rows, opens a recent invoice, inspects an owner stock card, checks empty-date feedback and verifies cashier API/UI boundaries. Final production build passed; all 23 automated tests and all 15 browser journeys passed (full browser suite approximately one minute). The dashboard panel was captured and visually reviewed at a 1366 x 768 viewport; the local screenshot was captured to ignored test-results/phase-7-insights.png (this directory may be cleared by later Playwright runs). Markdown links were checked.

Historical stock cards reconcile quantity movements, not historical lifecycle classifications or sellable availability. Cost snapshots use the existing receipt-cost fallback for legacy movements. Trend reads and existing daily-card reads are separate snapshots; concurrent new postings can occur between requests. No new production-scale performance claim is made for these read models, and no physical hardware, operator or off-machine recovery acceptance is inferred.

## Handoff

Management users open Overview for trends/recent invoices. Catalog readers open Medicines, search a product and select View stock history. The Phase 5 release ZIP remains frozen separately; this phase updates source and the local browser application. Production approval and the remaining SRS enhancements remain tracked in REQUIREMENTS-MATRIX.md and the pilot checklist.
