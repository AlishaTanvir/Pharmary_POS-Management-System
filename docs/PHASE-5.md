# Phase 5 — production readiness and baseline gap closure

User-authorized extension on 17 November 2026. The original SRS defines phases 0–4; this phase is an explicit addendum, not a change to its historical baseline.

Status: software handoff complete (0.5.0-rc.1); printer/off-device field acceptance explicitly deferred by the user for progression. Production approval remains pending. Earlier phase reports describe engineering snapshots, not production approval. REQUIREMENTS-MATRIX.md is the current traceability record. A requirement is never marked verified solely because a document, screen or proposed test exists.

## Ordered work

1. Reconcile the SRS, implementation, historical phase notes and acceptance evidence.
2. Close remaining transactional/UI gaps: profile/receipt branding, pricing and approval policy, suspended carts, full catalog access/export, invoice filters, supplier returns/credit, account terms, expense evidence and operational reports.
3. Harden sessions, input/error handling, health/observability, backup readiness and deployment configuration; add targeted security/transaction regressions.
4. Build a reviewable Windows distribution/installer with separated program/data files, clean bootstrap, startup/shutdown, upgrade/rollback and no embedded secrets/demo data.
5. Run software regression, isolated representative load and release-package checks. Record actual measurements and limits.
6. Validate actual 80 mm printer/USB scanner, off-device backup destination, recovery timing, site configuration and operator sign-off when the required hardware/access/details are available.

## External acceptance items

- Printer width and USB scanner preference are confirmed. Printer model, driver/interface and physical test availability still need evidence.
- Off-device destination, storage access, independent key custody and an off-machine recovery drill cannot be inferred from local encrypted snapshots.
- Store legal/tax/registration details and rollout applicability are stakeholder inputs. The user selected export-only regulator integration; live FBR/POS transmission is not part of this phase.
- Production hosting/network/TLS access, code-signing credentials, Windows 10/11 hardware coverage and stakeholder UAT must be recorded rather than fabricated.

## Exit criteria

The baseline matrix must identify implemented/verified, hardware-dependent, operator-dependent, deferred/optional and open requirements. Required software changes need meaningful transaction/security/browser checks. Release archives must exclude credentials, keys, databases and test records. Installation must preserve existing data and make no silent restore/cutover. Production approval remains pending until the external checks have real evidence and responsible sign-off.


## First delivery ? 18 November 2026

Documentation audit completed: [the matrix](REQUIREMENTS-MATRIX.md) covers every numbered FR/NFR/AT and the additional narrative workflows. The SRS has an additive implementation note; historical phase reports link to current status. [Operations](OPERATIONS.md) describes daily use, device acceptance, recovery and deployment gates. No open requirement has been relabeled complete merely to close a document gap.

Implemented in migration 006 and the first readiness increment:

- Cashier/branch-scoped suspended carts with idempotent save, a 20-cart limit, repeatable retrieval at current prices, explicit removal and checkout cleanup. Retrieval requires an empty UI cart; checkout still validates live stock/permissions/credit. No stock is reserved.
- Online sale notes, printed on the receipt. Unsuspended online cart recovery remains open.
- Profile logo and registration/tax identifier editing with owner password confirmation. PNG/JPEG size/signature checks reject remote URLs and SVG. New online invoices snapshot branding; newly prepared offline grants carry their profile through synchronization. Immutable historical invoices are not backfilled.
- Inclusive Pakistan-local sales date filters and invoice pagination with the existing own-invoice restriction for cashiers. Invalid calendar dates and reversed ranges are rejected.
- Explicit 400/413 responses for malformed/oversized JSON and an optional static asset directory setting.

Verification: production build and all 20 automated tests passed, including a real PostgreSQL saved-cart/idempotency/ownership/stock/snapshot check. The new browser journey passed after correcting the sale-notes label association: reload/reprice, cashier isolation, notes, checkout cleanup, date validation and immutable receipt branding. Full browser regression: all 9 journeys passed (approximately 1.5 minutes), including branch/finance, outage/reconnect and encrypted isolated-restore coverage. Migration 006 was applied to the retained demo database. Markdown file links were checked successfully. Test transactions and restore-verification databases are retained; these are fictional acceptance records, not live pharmacy data.

At the first delivery, approval policy, catalog/export, supplier-credit/reporting and deployment qualification were still open. The subsequent implementation and evidence below supersede that engineering snapshot.


## Completion increment - 18 November 2026

Migration 007 and the completion services close the planned software increment:

- Configurable native/cashier discount limits and optional prescription-reference policy; delegated supervisor approval is branch-scoped, requires another authorized user, binds the basket/current prices/current policy, expires in five minutes and is consumed in the same sale transaction. Failed approval attempts are throttled and forbidden operations are audited.
- Complete paginated catalog search, exact-barcode selection, inactive navigation/reactivation, audited CSV export and optional pack-unit JSON import with preview/validation. POS batch availability shows physical/reserved/sellable quantities, expiry and blocked status.
- Supplier accepted-credit workflow against remaining original receipt batches, with physical/reserved/original-quantity limits, immutable negative movement, payable reduction, settlement limits and balanced GL projection. Paid invoices may become supplier credit balances; no cash refund is invented. Returned customer stock and transferred-in stock are excluded from this first supplier-credit workflow.
- Future-invoice supplier/customer terms and stored due dates, due-date aging, immutable expense evidence with authenticated download, and operational sales/valuation/expiry/movement/velocity/exception reports with filters, audited CSV and browser print/save-to-PDF. Historical valuation classifies current lifecycle status explicitly; filtered invoice totals are not mislabeled as product-attributed revenue.
- Passive GET requests no longer renew session inactivity. Activity renews database/cookie together; idle lock clears prior drafts and prevents stale responses crossing sessions. CSP, structured request logs, health/readiness checks, operator print-issue logging and bounded input errors support operational review.
- Clean production bootstrap and a manifest-checked unsigned Windows distribution with separate private data, generated local secrets, preserved existing configuration, guarded startup and graceful shutdown. Node 24+ and PostgreSQL 18 are explicit separate prerequisites. See WINDOWS-RELEASE.md and ADR-001-WINDOWS-RUNTIME.md.

Capacity evidence: isolated run `ffbd75b6-0f03-4fc6-a2ed-42b1d3412342`, 18 November 2026. The fixture contained 20,000 products and 1,000,000 original sale lines. Five concurrent till sessions posted 100 sales and retried them; final count was 1,000,100 lines. Search p95 was 24 ms and sale-post p95 96 ms during concurrent work. Stock mismatches: 0; invoice mismatches: 0. Baseline fixture creation took 282 seconds. Evidence is retained in ignored `test-results/load-ffbd75b6-0f03-4fc6-a2ed-42b1d3412342.json`. This is a workstation loopback/backend qualification, not full UI, physical peripheral or production load certification. An earlier fixture with invalid generated UUIDs failed API validation; it was corrected and is not counted as a passing run.

Installed-package evidence: workspace-only side-by-side installation preserved existing private configuration, initialized exactly one branch/owner and no demonstration catalog/suppliers/sales, removed the bootstrap password from the runtime environment file, completed encrypted isolated restore with all four mismatch counts zero, and stopped API/owned PostgreSQL gracefully. Private evidence remains in `.release-test/acceptance.json`. No credentials or test databases are distributed.

## User-directed field-check deferral

On 18 November 2026 the user answered: **LEAVE THIS CONTINUE WITH NEXT PASE** when asked for the physical printer model and off-device backup destination. Those checks are explicitly deferred for progression; they are not marked verified. Production approval, physical peripheral compatibility and off-machine RPO/RTO acceptance remain pending. The next phase is pilot rollout preparation, without deploying externally or inventing operator sign-off. Final frozen-release test/package results and the transition are recorded after execution.


The final security regression found and corrected an immediate re-login race: late responses from an old session could cancel the new login. Session generations now advance on both lock and successful authentication, and the lock is one-shot. The browser-clock test verifies actual UI lock and clean cashier re-login. CSV regression also verifies exported pack conversions/prices are preserved through validated import.


## Frozen software handoff

Final production build passed. All 21 automated tests and all 13 browser journeys passed in the final complete runs. The successful capacity and installed-package evidence above complete the engineering checks for this increment. The isolated approval/security browser accounts avoid retaining rate-limit state between reruns; real limits remain enabled. Markdown links were checked.

The unsigned review artifact is `releases/pharmacy-pos-0.5.0-rc.1-windows.zip`, with compiled entry points, static assets, migration 007, production dependencies, operational documentation and per-file manifest. A separately installed Node/PostgreSQL runtime is required. External field controls remain deferred/unverified, not production-approved. Phase 6 starts only after this frozen handoff and addresses pilot rollout preparation. Remaining narrative/optional SRS enhancements stay visible in REQUIREMENTS-MATRIX.md.


Frozen archive SHA-256: `7ed3a65db310ad85a92a79375b2dad8af134f1f96e0dd12137e109123e3950a1` (4,624,711 bytes). A checksum sidecar accompanies the ZIP. The final manifest was installed into a fresh program directory with the existing isolated private data; clean-data, bootstrap-secret removal, seven migrations and encrypted restore checks passed again. Duplicate launch preserved the original supervisor lock; controlled shutdown completed. Phase 6 source changes are outside this frozen archive.
