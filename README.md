> Current status: Phase 5 software is frozen at 0.5.0-rc.1. Phase 23 historical-classification software is complete within its documented recorded-history scope (0.23.0-dev.1); see [Phase 23](docs/PHASE-23.md). Phase 6 operator acceptance remains pending. The user deferred printer/off-device field checks for progression. Production approval remains pending. See [requirements and gaps](docs/REQUIREMENTS-MATRIX.md), [Phase 5](docs/PHASE-5.md), and [operations](docs/OPERATIONS.md). Historical phase reports are engineering snapshots, not production approval.

# Pharmacy POS

Implements docs/Pharmacy_POS_SRS.md in sequential phases. Current source: **Phase 26 field acceptance preparation (0.26.0-dev.1)**; frozen readiness release: **0.5.0-rc.1**, built on the Phase 1/2 operational controls and Phase 3 offline counter. All four implementation phases now have working software; production rollout requirements are tracked separately. See docs/PHASE-1.md for inherited rollout requirements and docs/PHASE-4.md for expansion scope and docs/PHASE-3.md for offline operation/recovery.

## Local preview - Windows

Requires Node.js 24 (tested with 24.21.0).

1. npm install
2. npm run build
3. npm run local - creates the development PostgreSQL database, applies all ordered migrations, seeds demo accounts/catalog when empty, and serves http://127.0.0.1:3001.
4. Sign in as owner using ADMIN_PASSWORD from .env; cashier uses CASHIER_PASSWORD. Random credentials and the encryption key stay in the ignored .env. Keep this file private.
5. Configure pharmacy details/tax in Administration. Open your shift in Cash management, receive supplier stock, then use Point of sale.

The retained development database contains fictional acceptance-test records. It is not an actual pharmacy's inventory. Fresh seeding creates a fictional catalog and supplier without stock or sales; receiving establishes the movement trail.

Do not open dist/index.html directly: the app requires its API. For live UI development, run npm run dev with npm run server separately against a configured PostgreSQL database.

## Phase 2 workflows

- Returns: find an original invoice, select remaining quantities, enter reason/refund instrument and re-authenticate as owner/manager/pharmacist. Return stock enters quarantine. Restricted products require owner/pharmacist permission.
- Cash management: open a float; new sales and cash postings attach to the user's open shift. Close with counted cash, explanation for any variance and password sign-off. Historical Phase 1 sales retain their original records without retroactive shift assignment.
- Account ledgers: create approved customer credit limits; select the customer in POS for partial/full credit. Allocate customer collections and supplier payments to individual outstanding invoices. Returns reduce debt before paying a refund.
- Stock counts: submit a snapshot/count/reason; another owner/manager approves it. Changed stock requires a new count. All adjustments create movements and audit records.
- Expiry alerts: review 90/60/30-day windows. Authorized users quarantine, recall, release or dispose of stock with a reason and password. Expired stock cannot be released for sale.
- Activity audit: search actor, action or record ID, review details and page through immutable history.
- Backups & recovery: create/download encrypted snapshots, configure the schedule and verify a restore into a separate database without overwriting live transactions.

## Backup setup

The PostgreSQL server package does not bundle dump/restore utilities. On this workstation they are installed under .tools/pgsql/bin. To reproduce on Windows, run:

    powershell -File scripts/install-pg-tools.ps1

Other hosts need matching PostgreSQL client utilities in PATH, or explicit PG_DUMP_PATH / PG_RESTORE_PATH. The installer downloads the official EDB distribution; downloaded files and source/checksum metadata remain in ignored .tools/.

npm run local creates a random BACKUP_KEY if absent. Keep a secure recovery copy separately from this computer and the archives. Configure BACKUP_DIRECTORY to verified off-machine storage; set BACKUP_OFF_DEVICE=true only after checking it. Default backups/ is local and does not provide disaster recovery on machine loss.

Automatic maintenance runs at startup and once a minute while the API process runs. Default backup interval is 24 hours. A supervised server must remain running for unattended backups. Restore verification requires database-creation permission and retains a separately named verification database for inspection. Production should use a dedicated recovery identity; ordinary runtime database access should not be superuser access. See docs/PHASE-2.md before incident cutover.

## External PostgreSQL

Copy .env.example to .env; configure DATABASE_URL, strong seed passwords, BACKUP_KEY and utility paths. For a demonstration database, create the target database, then run npm run db:migrate, npm run db:seed, npm run build, and npm run server. db:seed creates fictional demo data and must not initialize a live pharmacy. For an empty production database use npm run db:bootstrap with private PHARMACY_NAME, BOOTSTRAP_OWNER_USERNAME and BOOTSTRAP_OWNER_PASSWORD variables; it creates no demo data. Production requires TLS, COOKIE_SECURE=true, appropriate database permissions, off-device recovery and operational sign-off.

## Verification

- npm test: 63 tests, including real PostgreSQL atomicity/concurrency/returns/ledgers/count/shift checks, rounding, unit conversion and authenticated backup encryption.
- npm run build: strict TypeScript checks and the production browser bundle.
- Install Chromium with `npx playwright install chromium`, provide the PostgreSQL backup utilities described in [Phase 25](docs/PHASE-25.md), then run `npm run test:acceptance`: 37 browser journeys in an independently created private database/cluster. The runner generates test account/key material and stops its owned services. See the phase reports for measured Chromium/Firefox coverage; the PKR follow-up passed its focused policy/API/browser checks. Direct `npm run test:e2e` still targets the configured API; use the isolated runner for acceptance.

Hardware preference: 80 mm thermal printer and USB HID scanner. F2 focuses barcode search, F4 quantity and F9 payment review. Browser Print/PDF supports 58/80 mm receipts; reprints are marked DUPLICATE. Physical device compatibility, ESC/POS cutting/drawer support, An unsigned Windows installer and isolated backend load checks are available; physical device coverage, deployment controls and production UAT remain pending. Card/wallet tenders record external terminal payments; the app does not initiate a charge.

## Phase 3 - offline counter

1. Keep the local Node counter service running on the Windows counter; the website and SQLite API are served from loopback. A disconnected remotely hosted page without this service is not the supported topology.
2. While online, sign in, open a shift, choose Offline counter, reserve a bounded stock pool, choose an 8+ character local PIN and confirm the online password. Default authorization is eight hours, at most twelve.
3. Unlock the prepared counter. Cash sales of unrestricted prepared medicines can be finalized while PostgreSQL is unreachable. The login page also links directly to the prepared counter.
4. Saved invoices, exact batch allocations, pool deductions and outbox entries commit together in local SQLite. The same key can retry safely. Local invoices & sync shows PENDING, SYNCED or CONFLICT.
5. Reconnect and synchronize, then finish the offline session before closing the original online shift. Unused quantities are released only after the local journal has no pending/conflict records.
6. Authorized users inspect prepared stock and conflicts in Sync review. Do not re-enter a pending invoice as a new sale or erase its journal to hide a conflict.

Local data: .local/counter.sqlite and its WAL/SHM files; payload key: .local/counter.sqlite.key. Both are ignored by Git. Central database backups cannot recover sales that have never synchronized; protect the local journal/key independently. Do not clone a prepared journal onto another counter. See docs/PHASE-3.md for recovery, authorization limits, clock/recall behavior and the acceptance evidence. OFFLINE_DB_PATH selects a fixed protected local data location before preparation.

The offline browser acceptance test deliberately stops/restarts the development PostgreSQL cluster on its configured port. It requires the local demo topology and must never be pointed at a live production pharmacy.

## Phase 4 - branch network and finance

- Organization owners create outlets in Branch network, assign branch roles and switch through the header selector after closing any open shift. The selected branch determines API scope and effective role.
- Adopt/publish approved medicine identities in Shared catalog. Products share canonical identity/pack conversions while existing branch selling prices are preserved.
- Stock transfers dispatch unreserved eligible stock, then require a separate destination receipt/inspection. Batch, expiry, unit cost and movement trace are preserved; complete receipts are supported.
- General ledger offers balanced journals, explicit idempotent operational-period posting, reversals, as-of trial balances and audited CSV export. Manual ledger entries do not alter a POS drawer, sale or stock count. Accountant review/opening-balance policy is required.
- Supplier suggestions use actual branch sale/receipt history and a visible cover-days formula. They do not place orders or claim live supplier pricing.
- Integration center is an internal adapter/export workflow only, as requested. Files are checksummed and marked NOT_SUBMITTED. No FBR endpoint, fiscal QR/ID or acknowledgement is fabricated.
- Snapshots include expansion records; restore verification also checks journal balance and transfer consistency. Organization-wide snapshots and employee administration require organization-administrator status.

Apply migrations via npm run local for the demo or npm run db:migrate for a managed installation. Existing OWNER accounts migrate to organization administrators; per-branch employee grants are explicit. New branch tax/profile settings must be confirmed independently. See docs/PHASE-4.md before deployment or interpreting the ledger as completed statutory accounts.


## Phase 5 first delivery

POS supports explicit suspended carts (up to 20 per cashier/branch), reload at current prices, sale notes, and review before checkout. New receipts retain their original pharmacy profile/logo/identifiers. Sales history adds local date filtering and paging. Old invoices without branding snapshots use the current profile. Saved carts do not reserve stock, and unsuspended online carts are not automatically recovered. See the operations runbook for limits.


## Windows release candidate

Build with `npm run build`, verify with `npm test` / `npm run test:e2e`, then prepare a distribution with `npm run package:windows`. See [Windows lifecycle](docs/WINDOWS-RELEASE.md), [runtime decision](docs/ADR-001-WINDOWS-RUNTIME.md), and [API controls](docs/API-CONTROLS.md). The unsigned installer requires separately installed Node.js 24+ and PostgreSQL 18, preserves private data/configuration across side-by-side program installs, and creates no demo data. `npm run db:bootstrap` is the empty-production-database initialization path. `npm run test:load` creates a separate retained million-line fixture; it never targets the live/demo database.

The user explicitly deferred physical printer/scanner and off-device recovery field acceptance on 18 November 2026 and requested progression. Those production controls remain pending; see Phase 5 and the current requirements matrix.


## Phase 6 first increment

Organization administrators can open **Pilot rollout**, inspect factual branch setup counts, append password-confirmed evidence/declarations/deferrals, and export an audited checklist. History is immutable. Project field-check deferrals are shown separately from branch attestations; this screen never grants production approval.


## Phase 7 management visibility

Overview includes net-sales trends, period totals, daily table/CSV and recent invoices. Medicines includes a paginated, date-filtered physical stock history with role-based cost visibility. Read [Phase 7](docs/PHASE-7.md) for posting-date semantics and limits. No financial schema or posting policy changed.


## Phase 8 physical counting

Stock counts now provides filtered per-batch count sheets, blind entry/printing, supervisor comparison and configurable owner escalation. Every adjustment still requires a different approver. New movement snapshots detect stock activity even when the quantity returns to its old value; older pending counts without these snapshots need a recount. Offline reservations must be finished before counting. See [Phase 8](docs/PHASE-8.md) for workflow, API compatibility and display limits.


## Phase 9 purchase orders

Purchases supports internal orders, partial receiving across lots/invoices, outstanding quantities and password-confirmed remainder cancellation. Order creation posts no stock or debt; actual receiving uses the established atomic purchase/payable workflow. Internal JSON export sends nothing to suppliers. See [Phase 9](docs/PHASE-9.md) for permissions, retry behavior and remaining scope.


## Phase 10 supplier directory

Purchases provides paginated search by supplier name/contact/identifier and expanded contact/address details. Owners/managers edit with a reason and revision check. New terms affect future receipts; existing invoice due dates and balances remain fixed. See [Phase 10](docs/PHASE-10.md).

## Phase 11 activity audit

Activity audit combines text search with inclusive Pakistan-local dates, exact action and historical actor filters. Branch permissions and immutable history are retained. See [Phase 11](docs/PHASE-11.md).

## Phase 12 medicine categories

Medicines supports branch parent/child categories, audited revision-controlled assignment and catalog filtering that includes descendants. Stock, prices and historical postings are retained. Phase 13 adds count-sheet hierarchy integration; Phase 14 adds current-category operational report filtering; Phase 15 adds CSV round-trip for assigned category paths; Phase 16 adds a separate complete category master CSV; historical report classification remains separate work. See [Phase 12](docs/PHASE-12.md).

## Phase 13 category count sheets

Stock counts supports category/descendant and Uncategorized filters with immutable category paths captured on each sheet. Later classification changes leave existing sheets intact; blind printing and all approval controls remain. See [Phase 13](docs/PHASE-13.md).

## Phase 14 category reports

Operational reports combines current category/descendant filtering with its existing form/action filters. CSV rows retain scope/basis metadata. Sales results remain whole matching invoices; audit exceptions rejects medicine-category scope. See [Phase 14](docs/PHASE-14.md).

## Phase 15 category CSV

Catalog CSV adds category_path_json as an array of category names. Import previews classification, reuses matching branch categories and atomically creates missing ancestors with new medicines. Existing create-only, active-record and 100-row import rules remain. Phase 16 supplies unused nodes through a separate category master CSV; database backups retain complete history. See [Phase 15](docs/PHASE-15.md).

## Phase 16 complete category master CSV

Export categories CSV includes unused categories and intermediate nodes. Under Manage medicine categories, Import category CSV previews and atomically creates missing paths while reusing existing branch names. It retains medicines and stock. See [Phase 16](docs/PHASE-16.md).

## Phase 17 online cart recovery

Online carts save automatically after a short pause. Wait for the recovery status to confirm saving; a same-tab reload offers recovery at current prices or discard. Draft contents stay on the server; session storage holds only a scoped reference. Posted checkout detection prevents offering an already-posted basket for recovery. See [Phase 17](docs/PHASE-17.md) for expiry, authentication and storage limits.

## Phase 18 keyboard access

Online checkout supports F2 search, F4 first quantity, F6 customer, F8 discount and F9 payment review. Ctrl+P in a saved receipt uses the audited print action. Shared dialogs provide named focus entry/return and busy Escape protection. Use Keyboard shortcuts in Point of sale. See [Phase 18](docs/PHASE-18.md) for the bounded accessibility audit and device acceptance limits.

## Phase 19 API access review

Administration includes an organization-private access inventory and audited JSON export. The build checks the generated inventory against source. Targeted HTTP tests exercise session, CSRF and denied-role boundaries; deployment and deeper business-path review remain separate. See [Phase 19](docs/PHASE-19.md) and the [proposed remaining roadmap](docs/REMAINING-ROADMAP.md).

## Phase 20 purchase invoice adjustments

Direct and order receipts capture invoice discounts and tax, with explicit inventory/input-tax treatment and exact whole-paisa cost allocation. Supplier credits reverse the corresponding inventory and input tax; operational journals reconcile to the source breakdown. Use View supplier invoice for posted detail. See [Phase 20](docs/PHASE-20.md) for allocation limits and migration/legacy behavior.

## Phase 21 controlled opening balances

Account ledgers accept separately evidenced customer/supplier debt and credits, with allocated settlement, immutable unpaid-remainder corrections, combined aging and credit-limit enforcement. Opening sources post matching GL entries immediately; branch reconciliation exposes unposted operational/manual differences. See [Phase 21](docs/PHASE-21.md) for date, cash, correction, import and acceptance limits.

## Phase 22 bank reconciliation

Bank reconciliation imports normalized signed-PKR statements, matches original bank book entries, carries outstanding items and controls statement-only fee/interest/clearing journals. Immutable checksummed closing evidence freezes prior bank dates. No bank connection or transfer is initiated. See [Phase 22](docs/PHASE-22.md) for the one-bank/baseline/file-format limits, access controls and actual verification status.

## Phase 23 recorded historical classification

Operational reports retain current classification by default and add an explicit captured as-of basis for category trees, assignments, medicine activity/forms and batch lifecycle. Legacy periods remain Unknown; quantities and classification share the selected cutoff. AS_OF CSV separates METADATA and DATA records. See [Phase 23](docs/PHASE-23.md) for time/evidence semantics, verification and limits.

### Phase 24 software complete within accepted scope

Receipt and offline preparation medicine search/pagination and scalable customer selection are implemented and verified (build, 57 backend tests, all 34 browser journeys covered across the broad run and focused rerun). PKR-only scope and automatic FEFO are accepted; migration 022 adds fractional purchase costs and per-line tax. See [Phase 24](docs/PHASE-24.md). Phase 24 is complete within that accepted scope; Phases 25/26 retain external acceptance work.

## Phase 25 local release qualification

Versioned Windows package verification runs during packaging, installation and startup; migration startup refuses unknown/newer or non-prefix schema history. `npm run test:acceptance` creates an independent private cluster and random test credentials. `npm run qualify:installed -- <candidate-directory>` rehearses clean bootstrap, encrypted restore, same-candidate side-by-side installation and graceful shutdown. Windows CI includes Chromium acceptance, Firefox smoke, installed qualification and verified unsigned packaging. Locally, the build, 60 backend tests, 35 Chromium journeys, Firefox smoke and installed bootstrap/restore/configuration-preservation/shutdown checks passed. See [Phase 25](docs/PHASE-25.md) for measured results and limits. Signing, hosted CI execution, target deployment/rollback controls and field acceptance remain open. Phase 24 PKR-only scope and automatic FEFO are accepted; migration 022 adds fractional purchase costs and per-line tax.

## Phase 26 field acceptance preparation

Pilot rollout now records structured field drill measurements and immutable operator declarations, with a combined pilot/field handoff JSON and audited checksum. Printer/scanner, outage replay, off-device RPO/RTO, cashier training and owner review remain human field work; the app never grants production approval. Follow [the field procedure](docs/FIELD-ACCEPTANCE.md), [uncompleted handoff template](docs/FIELD-HANDOFF-TEMPLATE.md) and [Phase 26](docs/PHASE-26.md). Phase 25 external qualification remains separate. Build and all 62 backend checks passed; all 36 browser journeys have passing coverage across the broad run and focused reruns. Test commands now check local free space before creating retained qualification fixtures.

### Accepted operating currency

The user confirmed PKR-only scope on 25 November 2026. Administration shows PKR (fixed); profile and new-branch configuration reject other currencies. Existing/historical amounts retain their paisa scale. Currency switching and FX are deferred; the later fractional/per-line costing implementation is documented below. See [Phase 24](docs/PHASE-24.md).

### Accepted automatic FEFO scope

The user confirmed mandatory automatic earliest-expiry-first allocation on 25 November 2026. Existing online and prepared-offline eligibility/expiry rules remain enforced; manual overrides are deferred. Historical allocations are unchanged. The later fractional/per-line costing implementation closes the remaining Phase 24 item.


### Fractional purchase costs and per-line tax

Version 0.26.0-dev.2 and migration 022 support selected-pack costs with four decimal places in PKR and exact fractional base-unit cost ratios. Direct and order receipts support per-line discounts and capitalized, recoverable or exempt tax, entered as an amount or percentage. Sales, returns, transfers, offline reservations, valuation and journals preserve exact lot value in whole paisa; historical financial records are not revalued. See [Purchase costing](docs/PURCHASE-COSTING.md) for calculation order, credit policy, API fields and upgrade details, and [Phase 24](docs/PHASE-24.md) for verification.


Final follow-up verification: production build, all 66 backend tests and all 38 Chromium journeys passed. The retained local database was upgraded through 022 after encrypted backup and isolated restore verification; original financial fields and balances were preserved. Phase 24 is complete within its accepted scope; only Phase 25 external qualification and Phase 26 actual field acceptance remain open.


### Phase 25 current Windows candidate

The current 0.26.0-dev.2 Windows candidate passed 1,750-file/22-migration verification and isolated installed bootstrap, encrypted restore (all mismatch counts zero), configuration precedence, side-by-side preservation and graceful shutdown. The existing pharmacy database was untouched. See [Phase 25](docs/PHASE-25.md) for the candidate/evidence and [Deployment qualification](docs/DEPLOYMENT-QUALIFICATION.md) for remaining target, signing, hosted CI and recovery requirements. Phase 25 external gates and Phase 26 actual field acceptance remain open.
