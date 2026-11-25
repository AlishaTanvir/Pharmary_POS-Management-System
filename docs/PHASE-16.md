# Phase 16 - complete category master CSV

Authorized as the next sequential increment after Phase 15. Source: 0.16.0-dev.1. Verification date: 21 November 2026. Status: software complete; field acceptance and production approval remain pending.

## Scope and workflow

Phase 15 catalog CSV represents paths assigned to medicines. Phase 16 adds a separate category master CSV containing every category in the selected branch, including unused roots, intermediate nodes and leaves. This closes the unused-category CSV gap without mixing category maintenance with medicine creation.

In Medicines, use Export categories CSV to download medicine-categories.csv. The single header is category_path_json; every row is a JSON array of name segments, for example ["Medicines","Pain relief"]. Names containing slash, comma, quote, newline or a formula-like prefix remain structured names. CSV quoting escapes quotes, and the outer JSON array starts with [, preventing category names from being interpreted as spreadsheet formulas. No branch IDs or source category IDs are exported.

Expand Manage medicine categories / Import category CSV, choose the file, review the paths and confirm. The preview validates names and structure; server validation and the current destination hierarchy determine the final result. At most 500 paths can be submitted, with 1-8 trimmed, nonempty names per path and 80 characters per name. The browser file limit is 2 MB. Only this import route receives a 2 MB JSON body allowance; other existing request limits remain. These limits cover an export of the bounded category master. A header-only export from an empty branch displays Nothing to import and cannot be confirmed.

Import reuses matching names case-insensitively beneath the same parent in the selected branch, preserving destination spelling and IDs. Missing ancestors and leaves are created. Repeated paths are harmless; an already imported file creates zero additional categories. The result reports submitted path count and created node count, which can differ when ancestors are implicit. The entire import commits or rolls back together, including category audit events. The existing 500-category branch limit applies to resulting nodes, not only CSV rows; an existing-path import is still allowed at capacity.

Imports never rename, reparent, delete or merge categories, and never assign or create medicines. Existing medicine classification revisions, prices, batches, movements, purchases, invoices and balances are retained. A renamed or moved source path creates a separate path if it does not match the destination; use the established revision-controlled category editor for deliberate changes. Category CSV transfers current master names, not historical IDs, revisions, audit history or a complete database backup.

## API, audit and consistency

POST /api/categories/import requires catalog-write permission and a valid session/CSRF token. Body: {"items":[{"category_path":["Medicines","Pain relief"]}]}. Success: {"paths":1,"created":2}. Path objects reject unrelated ID/parent fields. An empty API array is rejected; the UI handles a header-only file as a no-op. Categories remain local metadata under existing shared-catalog policies.

POST /api/categories/export requires report permission and a valid session/CSRF token. Success returns {"csv":"..."}. The export uses repeatable-read isolation for its category snapshot and audit. The Medicines export button is available to report roles; the import panel retains owner/manager catalog controls. Cashiers cannot import or export.

Import serializes with existing branch category creation/reparenting and catalog CSV imports using the same transaction-level advisory lock. It resolves current names after acquiring the lock. Concurrent imports of the same missing path create one hierarchy. No schema migration is required. CATEGORY_CREATED remains per new node. CATEGORY_MASTER_IMPORTED records paths, created, NAME_SEGMENTS_JSON format and ALL_CATEGORIES scope; CATEGORY_MASTER_EXPORTED records rows with the same format/scope. Both include actor and selected branch through existing audit controls.

## Verification

Build passed. Six targeted parser/PostgreSQL tests passed across category-master, categories and catalog-csv suites. Coverage includes unused roots and intermediate nodes, special characters, empty master, eight-level bounds, 500-row bounds, branch-local IDs, destination spelling, duplicate/repeated import, concurrent import serialization, preservation of an existing classified medicine, capacity rollback including audits, reuse at capacity and zero financial side effects. Five related browser journeys passed: the new category-master flow, category maintenance, catalog CSV round-trip and both checkout/catalog regressions. The new journey also passed its targeted rerun with a valid import larger than 100 KB. Browser checks cover preview before mutation, invalid/empty path refusal, repeated name reuse, unused-node export, CSRF rejection and cashier API/UI denial. The maximum-size parser test was rerun after adding multibyte and JSON-escaped name coverage; it passed. The final build passed after the file-size and preview-readability adjustments. The final category preview was visually reviewed in a 1366 x 1000 viewport and captured at test-results/phase-16-category-master.png without importing records. Documentation links resolve. Twenty stopped historical test clusters were compressed without deleting records; approximately 0.92 GiB of workstation storage remained. These are targeted checks; the full 41-test / 24-journey suites were not rerun in this phase.

## Handoff and remaining work

Copy category master CSV before importing medicine CSV when unused nodes must also be reproduced. Review the selected destination branch before confirming. Full database backups remain the recovery mechanism. The frozen Phase 5 Windows archive is unchanged; this phase does not create a signed installer or certify deployment.

Historical category reconstruction, unsuspended-cart recovery, purchase invoice tax/discount accounting, opening balances, bank reconciliation, multi-currency and other matrix gaps remain separate work. Physical printer/scanner and off-device recovery checks remain user-deferred; operator acceptance and production approval remain pending. Phase 17 has not started.
