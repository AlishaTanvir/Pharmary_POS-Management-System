# Phase 13 - category-scoped physical count sheets

Authorized as the next sequential increment after Phase 12. Source: 0.13.0-dev.1. Verification date: 20 November 2026. Status: this software increment is complete.

## Workflow

Stock counts adds Count category alongside the existing location, medicine form and product filters. Selecting a parent includes descendant categories; Uncategorized selects medicines with no category. All categories retains the existing unfiltered behavior. Refresh count filters reloads current categories/location/form without changing any saved sheet.

New sheets capture the selected category scope/path and each included batch's category ID/path. Changing a category name, moving a category or reassigning a medicine afterward does not change existing sheet membership, scope or displayed category. A newly created sheet uses the current classification. Category metadata changes alone do not invalidate the physical stock snapshot; actual quantity/movement changes retain the existing recount requirements.

Blind entry and printable projections show captured category labels but omit expected quantities. Existing sheets created before this increment have no captured category; the UI/print labels that explicitly instead of assigning current metadata retrospectively. Print/PDF remains browser output, with physical printer acceptance deferred.

## Data, consistency and compatibility

Migration 014 adds nullable category ID/path fields to immutable count-sheet lines. It does not rewrite old sheets. Captured category IDs are historical metadata and are not a live foreign-key link that could rename or remove the recorded descriptor. The existing immutable-history trigger covers the new fields.

Creation takes a shared branch category lock while capturing category scope, preventing category edits/reparenting from changing the tree during selection. Matching medicine rows are share-locked while assignments and batch snapshots are read. Selected batch rows retain their stock locks. Category edits use the existing exclusive branch category lock; assignment edits continue to lock the medicine row. Unknown/foreign category IDs are rejected before posting any sheet.

The count-sheet request adds an optional category UUID or UNCATEGORIZED. Omitted or blank category normalizes to the original all-category input, preserving the original idempotency hash shape for older clients. Identical retries return the saved sheet, including its original category snapshot after later edits. Reusing a key for another category is rejected. Options/detail/print responses add metadata; their existing fields remain compatible.

The selected category combines with other filters before the 500-batch cap. Counts still reserve no stock and require separate approval for adjustments. Offline reservations, closed-batch exclusion, movement-count staleness, two-person separation and owner variance escalation retain their existing controls. Read/create/submit/print access remains inventory-count; category editing remains catalog-write. No category permission permits direct stock adjustment.

Migration 014 is applied to the retained demo database. Apply ordered migrations before running current source. The frozen Phase 5 Windows archive remains unchanged; no new packaged or production release is implied. Older binary compatibility requires review.

## Verification

The production build and all 35 automated checks passed in the full run (approximately 105 seconds). The additional legacy-projection assertion passed in a targeted rerun of both count-category tests. Database coverage includes descendants, Uncategorized, branch isolation, same-key retries, changed-key refusal, retained category paths after metadata edits, fresh scope, blind projections, separate approval and immutable category history. All 21 browser journeys passed in the full run (approximately 3.6 minutes), including category-scope creation, retained paths after reassignment and blind print projection. The count-sheet screen was visually reviewed at a 1366 x 768 viewport; its ephemeral capture is test-results/phase-13-category-counts.png. Local Markdown document links resolve. About 1.3 GiB of disk space remained free at verification. Temporary demo services were stopped at handoff.

## Handoff and remaining work

Open Stock counts, select Count category and any location/form/product filters, then create a blind sheet. The saved sheet shows its captured category scope and category per batch. Enter physical quantities/reasons and have a different authorized person review/approve through the established workflow. Refresh count filters to see newly added classifications.

Category filtering in operational reports, historical report classification and category CSV round-trip remain separate gaps. Printer/scanner and off-device recovery checks remain user-deferred. Operator acceptance and production approval remain pending. Phase 14 has not started.
