# Phase 15 - category-aware catalog CSV

Authorized as the next sequential increment after Phase 14. Source: 0.15.0-dev.1. Verification date: 21 November 2026. Status: software complete; field acceptance and production approval remain pending.

## CSV format and workflow

Catalog export adds category_path_json to the established columns. Its value is a JSON array of category-name segments, for example ["Medicines","Pain relief"]. Arrays avoid ambiguity when an individual name contains a slash, comma, quote or other separator. An empty array means Uncategorized. The existing units_json column retains pack conversions and prices.

CSV import accepts that optional column and displays the category path in preview. A blank cell or [] imports Uncategorized; omitting the column retains the legacy unclassified import behavior. Names must be nonempty after trimming, no longer than 80 characters, with no more than eight levels. Both the browser parser and server validate the classification.

On confirmation, the selected branch reuses existing categories by case-insensitive sibling name under the same parent, retaining the target's existing spelling. Missing ancestors/children are created and audited. Categories are resolved by their names, not copied IDs, so another branch receives its own category identities and assignments. Medicines, units and any created categories commit together. A late failure rolls all of them and their audit events back.

This remains a create-only medicine import. Existing SKUs/barcodes are rejected rather than updated, and previously inactive exported records import as new active records in a fresh destination. Review that established activation behavior before copying a catalog. The active export column is informational; it is not a request to alter existing status. The UI limit remains 100 medicines and a CSV file below 90 KB; export covers the complete catalog, so larger exports must be split into validated batches with their header retained.

Only paths assigned to exported medicines are represented. Unused categories are not standalone catalog rows and are not recreated by this CSV. Database backups retain the complete category master, including unused nodes and history. This CSV is not a backup/restore, opening stock transfer or financial migration. It creates no batches, movements, supplier debt or invoices.

## Data, access and consistency

No schema migration is needed. Category reads add a name-segment array alongside the existing display path. The import service uses the existing branch category lock to resolve/create paths; the existing eight-level and 500-category limits apply. Existing category permissions, shared-catalog import policy, selected branch and CSRF controls remain. Import requires catalog-write; export retains report permission. Cashiers cannot import or export.

Export uses repeatable-read isolation for a consistent medicine/unit/category view and retains formula-safe CSV escaping. Structured category arrays preserve names such as =Root or Child / with comma without treating them as formulas or splitting on separators. Existing spreadsheet protection on ordinary text fields remains; the category feature does not change those fields' established encoding.

CATALOG_EXPORTED records row count, NAME_SEGMENTS_JSON format and ASSIGNED_PATHS scope. MEDICINE_IMPORTED records the requested category path and assigned branch ID, while newly created nodes retain CATEGORY_CREATED events. Existing categories and medicine history are never renamed or overwritten by import. If a response is lost, inspect the catalog before resubmitting; duplicate rejection is the existing protection, not a new import retry-key protocol.

The frozen Phase 5 Windows archive is unchanged. No new packaged release, production installation or regulatory claim is implied.

## Verification

Validation on 21 November 2026: production build passed and all 39 automated tests passed. The full 23-journey browser run passed 21 journeys; after restoring the existing daily-sales CSV route and synchronizing the medicine-history search selector, both affected journeys passed their targeted rerun. An intermediate rerun encountered connection refusal before local startup completed; the final rerun used the ready API. All 23 browser journeys are therefore verified across the full run and targeted reruns. The category CSV dialog was visually reviewed at a 1366 ? 768 viewport. Retained local test clusters were compressed without deleting records; roughly 1 GiB of workstation storage remained during verification. New coverage includes legacy/empty cells, separator/formula-like category names, client/server bounds, branch-local identity, case-insensitive reuse, pack-unit preservation, inactive-export/new-active behavior, duplicate refusal, complete rollback after reaching category capacity, export audit metadata and no financial side effects. The browser journey covers preview, missing category creation, exported-path decoding, re-import with new identities, category reuse and cashier denial. Existing catalog price-edit regression remains in the full suite.

## Handoff and remaining work

Export catalog CSV from Medicines. Retain category_path_json and units_json when preparing import batches. Select the destination branch, open Import CSV, review names/prices/category paths, then confirm. Use new SKUs/barcodes when intentionally creating copies in the same branch. Omitted or empty category paths create Uncategorized medicines.

Unused-category master CSV, historical report classification, purchase invoice tax/discount metadata, opening balances, bank reconciliation and the other matrix gaps remain separate work. Printer/scanner and off-device recovery checks remain user-deferred; operator acceptance and production approval remain pending. Phase 16 has not started.
