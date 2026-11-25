# Operator and release readiness runbook

Current delivery is a local development/demo application. Production rollout remains gated by [the requirements matrix](REQUIREMENTS-MATRIX.md) and [Phase 5](PHASE-5.md).

## Daily use

1. Confirm the active branch, pharmacy profile/tax policy and user role. Open your shift with the actual opening float.
2. Search/scan, select the configured unit and quantity, then review payment. Use an approved customer for credit. Card/wallet entries record payments from a separate terminal.
3. To pause a sale, enter a short cart label and select **Suspend cart**. This saves to the central database, scoped to your cashier and branch. It does not reserve stock. Do not put sensitive patient information in labels or notes.
4. Load a saved cart into an empty cart. Prices refresh; checkout revalidates current stock, eligibility, permissions and customer credit. Saved carts remain until explicitly removed or a successful checkout cleans up the loaded saved cart. Loading itself is repeatable after a network interruption. Review before payment.
5. A committed sale remains saved even if printing fails. Find it in Sales history, filter by dates or invoice/product/cashier text, and reprint with DUPLICATE. New invoice branding is a snapshot; older invoices without snapshots use the current profile.
6. Close the shift with actual counted cash and a reason for any variance. Finish offline reservations before closing their source shift.

An unsuspended online cart is not automatically recovered after a browser crash. Suspension needs a working central connection. Prepared offline counter checkout is a separate cash-only workflow with its own local durable journal.

## Hardware acceptance — pending

Preference: 80 mm thermal printer and USB scanner. The workstation inventory found virtual printers only; no physical thermal printer/scanner acceptance is recorded.

Record printer make/model, interface/driver, Windows version, paper width, margins, legible logo/identifiers, long medicine names, multi-batch receipt and duplicate print. Disconnect it during a completed sale, verify persistence, reconnect and print the original invoice as DUPLICATE. Browser print does not certify automatic cutting or cash drawer control.

Record scanner model and USB HID mode. Scan known and unknown barcodes, leading zeros, repeated scans, Enter suffix and F2 focus after closing dialogs. Record actual operator scan-to-cash timing against an agreed target.

## Backup and recovery — operator action required

Configure a verified off-device `BACKUP_DIRECTORY`. Set `BACKUP_OFF_DEVICE=true` only after inspecting actual storage/copies; the flag alone is not evidence. Keep `BACKUP_KEY` independently secured, separate from archives and the counter computer. Never paste `.env` or keys into support logs.

Run an encrypted backup from the organization-administrator recovery screen, verify restoration into a separate database, reconcile sample invoice/payment/stock/journal/transfer records, and record start/end times. Local unsynchronized SQLite invoices are outside a central PostgreSQL backup: reconcile or safely preserve that counter's database and key under a separate recovery plan. Never overwrite a live database or delete an outbox to resolve a conflict.

RPO ≤24 hours and RTO ≤4 hours are proposed baseline targets awaiting owner confirmation and a timed off-machine drill. A same-machine successful restore does not establish those targets.

## Deployment and upgrade gates

`npm run local` can seed fictional demonstration data when empty. Do not use that seed as production bootstrap. A clean production bootstrap and unsigned Windows installer/lifecycle scripts are now available; see WINDOWS-RELEASE.md. Node 24+/PostgreSQL 18 are separate prerequisites. The supplied launcher is not a Windows Service. Do not claim the browser application is already a signed desktop package.

Before any production migration: create and restore-verify an encrypted backup, reconcile/finish offline devices, stop writers, record schema/app versions, run versioned migrations in a maintenance window, then verify sample balances and role boundaries. Keep app binaries and private data separate. Never roll back by deleting migration rows or financial history; assess schema compatibility and use a reviewed recovery/cutover plan. Use the release installer with separate program/data paths; side-by-side installation preserves private configuration. Schema-incompatible rollback is not automatic.

Production hosting must establish TLS, restricted database access, process supervision, monitoring and independent backup/key custody. Export-only integration remains selected; no live regulator submission is configured. Record responsible owner, pharmacist, administrator and acceptance date for all field checks before production approval.


On 18 November 2026 the user explicitly requested progression without the printer/off-device destination checks. Their acceptance remains unverified. See PHASE-5.md for the software handoff and the next phase for pilot preparation; no production sign-off is inferred from this deferral.


## Pilot rollout preparation

Organization administrators can open Pilot rollout to inspect factual branch setup counts and record evidence. An organization administrator with branch OWNER permission must confirm the owner password to append a declaration. PENDING, DEFERRED and operator ATTESTED entries remain in immutable history. Export the checklist for review. Do not enter secret credentials or patient details into evidence. A declaration is not application certification or automatic production authorization. See PHASE-6.md for the first increment and remaining pilot work.


## Physical count sheets

Finish and synchronize offline reservations, then choose a low-activity counting window. In Stock counts, filter a sheet by location, medicine form or product and count each captured batch in base units. Blind print/entry omits expected figures; it is not a restriction on other authorized inventory screens. Enter explicit zero for an empty batch and record a reason. A different supervisor reviews the count. Variances at/above a configured nonzero base-unit threshold require an owner.

A sheet captures existing batches only and reserves no stock. If stock activity changes, create a fresh sheet and recount the affected batch. Older pending counts without movement snapshots cannot be approved. Printed/saved sheets and submitted-line progress do not constitute approval or whole-store reconciliation. See PHASE-8.md for detailed limits.

## Purchase orders

In Purchases, create an internal order with supplier, product/unit packs and estimated cost. No stock or payable is posted until receiving an actual invoice. Receive each invoice separately, splitting lots by batch/expiry as needed. Explain changes in pack cost. After an uncertain response, retry the unchanged receipt; refresh before starting a new invoice. Owner/manager cancellation closes outstanding packs only, preserving received invoices and debt. Supplier returns do not reopen ordered quantities. Internal JSON exports do not send orders to a supplier. See PHASE-9.md.

## Supplier contact maintenance

In Purchases, search Supplier directory by name, contact, phone, email or identifier. Owners/managers open Edit supplier, update details/future payment terms and save with a reason. On stale-edit refusal or an uncertain response, reload the directory and review the current record before retrying. Changes do not amend existing invoice due dates or debt. Add supplier accepts contact/address details; identifiers are operator-entered and do not certify registration. See PHASE-10.md.

## Audit filtering

Use Activity audit to combine text with dates, exact action and actor identity. Dates are inclusive in Asia/Karachi; either boundary may be blank. Options include historical inactive users and system events from this branch. Expand event details for the original audit payload. Invalid ranges clear displayed results. Refresh reloads current activity/options; clear filters returns to all branch events. New activity can shift offset pages, so refresh/refilter when investigating. See PHASE-11.md.

## Medicine category maintenance

In Medicines, expand Manage medicine categories to create parent/child names or edit/reparent with a reason. Use catalog search/paging to choose a medicine for assignment. Parent catalog filters include descendants; Uncategorized finds unassigned products. Clear the filter to move a product from another category. On stale edits or uncertain responses, refresh and review current metadata. Existing counts/reports retain their form/location/product filters. See PHASE-12.md.

## Category physical counts

In Stock counts, choose Count category to count a category and its descendants, or Uncategorized. Combine with existing filters to keep sheets within 500 batches. Saved category labels and membership stay as captured; use a new sheet for a changed classification scope. Old sheets show that category was not captured. Refresh count filters loads current category names. Physical quantities still need a separate authorized approver. See PHASE-13.md.

## Category operational reporting

In Daily reports / Operational reports, set Report category independently from Medicine form / audit action. Parent categories include descendants. Scope uses current catalog membership even for earlier dates; read the report notice. Sales rows remain whole matching invoices, so category reports cannot be added as category-attributed revenue. CSV records scope/basis; print uses the same notice. Category scope is unavailable for audit exceptions. See PHASE-14.md.

## Category catalog CSV

Keep category_path_json and units_json when copying exported catalog rows. The category cell is a JSON array of names, not a slash-separated string. Import preview shows the assigned path; missing branch ancestors are created with the medicines. Batch imports remain up to 100 rows and create new active products only, with duplicate SKU/barcode refusal. Empty/missing paths mean Uncategorized. Unused category masters are retained by database backups, not medicine CSV rows. See PHASE-15.md.

## Complete category master CSV

Use Medicines / Export categories CSV to retain unused categories as well as assigned ones. In the destination branch, expand Manage medicine categories / Import category CSV, review the paths and confirm. Matching paths retain destination names; missing ancestors are created atomically. A header-only file has nothing to import. Import category master before medicine CSV when copying unused nodes too. This additive workflow does not rename/move/remove nodes or assign medicines, and does not replace database recovery. See PHASE-16.md.

## Unsuspended online cart recovery

Wait for Recovery draft saved in Point of sale before reloading. A same-tab reload under the same cashier/branch offers recovery at current prices or discard; checkout stays disabled until resolved. Review stock, discounts and tenders again. Failed saves are visible and can be retried. If a sale already posted, use Open posted invoice or Sales history. Session expiry/sign-out/idle lock forget browser references; drafts expire after 24 hours. Browser storage restrictions or lost tab references require the explicit Suspend cart workflow for later retrieval. Prepared offline checkout is separate. See PHASE-17.md.

## Cashier keyboard guide

In online Point of sale, open Keyboard shortcuts for F2 search, F4 first quantity, F6 customer, F8 discount and F9 payment review. Use Escape to close an idle workspace dialog. During a pending operation, wait for completion. Ctrl+P in an open saved receipt uses Print receipt and its reprint audit; elsewhere browser printing is unchanged. Test Fn/OS conflicts on the actual workstation. See PHASE-18.md.

## API access review and remaining roadmap

Organization administrators can expand API access review in Administration, filter or page the declared routes and export the complete inventory. Table filters do not limit the export. Review it with staff grants and release evidence; it is not a deployment approval. Developers run npm run access:generate after reviewing intended route changes, then build/test; check:access runs in the build. The remaining phases are planning packages, not a pre-existing fixed total; see PHASE-19.md and REMAINING-ROADMAP.md.

## Purchase invoice adjustments

Enter gross pack costs, invoice discount and invoice tax when receiving directly or against an order. Choose the agreed treatment for nonzero tax and review inventory cost versus supplier payable. Migration 022 adds four-decimal PKR pack costs, exact fractional base-unit valuation and explicit per-line discounts/tax amounts or percentage rates. Select Purchase tax mode, classify each taxable/exempt lot and review the preview; tax rates/exemptions are never inferred. See [Purchase costing](PURCHASE-COSTING.md) for rounding, returns, offline value reservations and upgrade behavior. The supported policy apportions invoice amounts proportionally, so confirm it matches the bill and accepted supplier credit. Inspect posted lots with View supplier invoice. Input-tax reversals are shown separately on supplier credits. Historical unrecorded components remain Not captured. Apply migrations through 022 with the matching app; retain the established backup/upgrade process. See PHASE-20.md.

## Controlled account openings

Use Account ledgers > selected account > Record opening balance for evidenced amounts absent from existing invoices/manual opening journals. Choose debt versus credit, original due date and effective posting date; review and sign off. Settle opening allocates real funds to that source; cash needs your open shift and today. Correct remainder cancels only the reviewed unpaid import error, retaining real settlements; replacements are separate entries. Reconcile openings and full control-account differences before sign-off. Sources post GL immediately, while ordinary operations still require explicit GL posting. Retain independent statements. See PHASE-21.md for supported scope, restore checks and limits.

## Bank statement reconciliation

Use Bank reconciliation for account 1030 in PKR. Confirm the first starting balance and resolve earlier outstanding items independently. Normalize bank text to date,reference,description,amount_pkr; inflows are positive and outflows negative. Review preview totals and source evidence, match original book entries, and investigate unmatched statement items. Post only evidenced fees/interest/clearing adjustments. Review closing, explain every carried book item and export the exact saved JSON/checksum. Closing freezes prior bank dates; use later correcting entries and the next contiguous statement for future clearing. No external transfer is made. See PHASE-22.md for permissions, correction/cancellation rules and supported limits.

## Recorded historical classifications

In Operational reports choose Current catalog and lifecycle for the existing view or Captured as-of classification for recorded history. Set the through-date and optional Pakistan time, then select a category observed at that cutoff or Unknown before capture. Review capture start, unknown counts and lifecycle/expiry labels. Do not treat Unknown as Uncategorized or interpret the query as exact historical commit/physical visibility. AS_OF CSV has one METADATA row before its DATA records; totals apply only to DATA. Export reuses the displayed cutoff with unchanged filters and updates the table to the exported response. Save files independently when fixed evidence is required. Existing count snapshots/audits remain available but are not assumed to form complete missing history. See PHASE-23.md.

## Release integrity and guarded startup

For the Phase 25 candidate, run `npm run verify:release -- <candidate-directory>` before transferring through the approved delivery process. Install and Start check the full v2 inventory; the supervisor rechecks before loading private configuration. Unexpected files, altered assets and symbolic links are refused. Only the installed data-location.txt pointer is an allowed extra; protect it and the data ACL independently. A hash/unsigned manifest is not publisher authentication.

A newer/unknown migration name or a non-prefix applied history refuses migration startup. Keep the live data intact and use a reviewed compatible release/recovery plan; never remove migration rows to bypass this boundary. Existing frozen binaries are not retrofitted. Production rollback and off-device recovery still need their own cutover evidence. Local verification helpers retain private disposable test fixtures under ignored paths, never in the distribution. See PHASE-25.md and WINDOWS-RELEASE.md.

## Field declarations and handoff

In Pilot rollout > Field acceptance and handoff choose the actual drill, state, operator/time, site/release and measurements. Use FAILED when a target/check misses and keep the original evidence before recording a retest. An organization administrator acting as branch OWNER confirms a password to append a record. Blank/PENDING/DEFERRED evidence is not a pass; ATTESTED is an operator declaration. Keep passwords/keys and customer data out of evidence. Export the combined pilot/field JSON and retain its exact SHA-256 with the signed paper/recovery/training references. An owner review records review evidence, not production permission; other phase gates remain open. Follow FIELD-ACCEPTANCE.md and FIELD-HANDOFF-TEMPLATE.md for actual field work.


## Completing deployment qualification

Use DEPLOYMENT-QUALIFICATION.md for the current immutable candidate, exact verification commands and outstanding target/signing/CI/monitoring/recovery evidence. Installed qualification now records the actual migration inventory, runtime/OS and manifest checksum and checks storage before creating retained fixtures. It does not target live data, install unattended startup or establish external production approval.
