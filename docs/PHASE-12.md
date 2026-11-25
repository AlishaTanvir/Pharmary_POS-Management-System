# Phase 12 - branch medicine categories

Authorized as the next sequential software increment after Phase 11. Source: 0.12.0-dev.1. Verification date: 20 November 2026. Status: this software increment is complete.

## Workflow

Medicines now provides a branch category hierarchy and catalog category filter. Owners/managers can create categories, rename/reparent an existing category with a reason, and assign or clear a medicine's category with a reason. Category paths display parent/child names. Each branch supports up to 500 categories and eight levels. Sibling names are unique without case distinctions. Categories cannot be moved under themselves or their descendants, including concurrent reparent attempts.

The catalog filter includes all descendants of a selected parent. Uncategorized selects only products without an assignment; All categories removes the category restriction. Category filtering combines with the existing search, active/inactive selection and 100-product pagination. Category names are displayed beside catalog identity. To classify a product, search/page the current catalog and choose it in Manage medicine categories. Clear the catalog category filter to find a product assigned elsewhere.

Category edits and assignments use independent revisions to reject stale edits. After an uncertain response or stale-edit refusal, refresh the Medicines page and review the current category/assignment before resubmitting. These are metadata edits, not financial transactions; no automatic retry key is introduced. Editing a general medicine record preserves its classification. Changes retain unit conversions/prices, stock, invoices, settlements and journals.

Categories are branch-local organization, including for centrally published products; they do not change shared product identity or publish classifications to other branches. Existing products start Uncategorized. There is no category deletion, merging, bulk assignment or automatic import classification in this increment. Category hierarchy and assignments are included in database backups, but the established catalog CSV format does not round-trip them.

## Data and controls

Migration 013 adds medicine_categories, its branch/parent/name constraints, and medicine category ID/revision fields. Composite foreign keys prohibit cross-branch parents and assignments. Category writes serialize on a branch advisory lock, validate the complete resulting tree and commit with the activity audit. Medicine assignments lock their medicine row and validate the current classification revision. Stale changes, foreign identities and invalid parents are rejected atomically.

GET /api/categories requires catalog-read permission and returns current branch paths. Category create/edit and PUT /api/medicines/:id/category require catalog-write permission (owner/manager). Cashiers can read/filter categories but cannot change them. The existing GET /api/medicines response gains category fields and accepts a category UUID or UNCATEGORIZED; omitted/blank category preserves legacy behavior. Recursive descendant selection is branch-scoped. Existing authentication, selected-branch authorization and CSRF controls apply.

The branch-local hierarchy represents current classification; it is not reconstructed historical classification. Count sheets continue using their existing location/form/product filters, and operational report category inputs retain their existing form/action meaning. Applying the new hierarchy to counts/reports and capturing historical category snapshots remain separate work. This increment closes the missing master hierarchy while keeping those integration gaps explicit.

Apply ordered migrations before running current source. Migration 013 is applied to the retained demo database. The frozen Phase 5 Windows archive is unchanged; no new packaged or production release is implied. Review older binary compatibility before using an upgraded database.

## Verification

The production build passed. All 33 automated tests and all 20 browser journeys passed in their full runs (approximately 117 seconds and 3.4 minutes respectively). The final toolbar wrapping adjustment was rebuilt and visually reviewed at 1366 x 768; the ephemeral capture is test-results/phase-12-categories.png. Local Markdown document links resolve. About 2.1 GiB of disk space remained free at verification. Temporary demo services were stopped at handoff. New isolated PostgreSQL coverage checks hierarchy bounds, duplicate siblings, foreign parents/assignments, cycle and concurrent reparent rejection, stale metadata edits, assignment clearing, unchanged prices/stock/debt and audited successful changes. The browser journey checks creation, assignment, parent descendant filtering, Uncategorized exclusion, cycle refusal and cashier write denial.

## Handoff

Open Medicines and expand Manage medicine categories. Create parent/child categories, search for a medicine, choose it under Assign a medicine, select its category and save with a reason. Use Catalog category to browse a branch or its descendants. Select Edit category to rename/reparent with a reason.

Physical printer/scanner and off-device recovery checks remain user-deferred. Operator acceptance and production approval remain pending. Phase 13 has not started.
