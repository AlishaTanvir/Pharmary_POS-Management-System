# Windows distribution and lifecycle

Phase 5 release candidate: 0.5.0-rc.1. The distribution uses a local Node service and browser UI. It is an unsigned PowerShell installer, not a Tauri wrapper or a signed native executable. Physical printer/scanner and off-device recovery acceptance were explicitly deferred by the user on 18 November 2026; that deferral does not approve production use.

## Build and prerequisites

Run `npm run build`, tests, then `npm run package:windows`. A timestamped directory appears under ignored `releases/`. The allowlist includes compiled server entry points, static browser assets, migrations, production dependencies with their package licenses, operational docs, lifecycle scripts and a SHA-256 manifest. It excludes `.env`, keys, databases, backup archives, test records and generated owner credentials. `THIRD-PARTY.json` records dependency versions/licenses.

The target computer needs separately installed Node.js 24+ and PostgreSQL 18, including `initdb`, `postgres`, `pg_ctl`, `pg_dump` and `pg_restore`. Their runtimes and licenses are provided by their respective installations. No network download occurs during application installation. Verify these prerequisite installers through your software distribution process. The application manifest detects accidental changes; an unsigned manifest is not publisher authentication.

## Install

Copy the release directory to a trusted local location and run its installer in PowerShell. Use separate absolute program/data paths and available loopback ports:

```powershell
.\Install.ps1 -InstallDirectory 'C:\Pharmacy\Program-0.5.0-rc.1' `
  -DataDirectory 'C:\PharmacyData' `
  -PostgresBinDirectory 'C:\Program Files\PostgreSQL\18\bin' `
  -Port 3002 -PostgresPort 55433 -PharmacyName 'Your pharmacy'
```

`BackupBinDirectory` optionally selects matching PostgreSQL dump/restore utilities. Existing program directories are refused. Installation protects the private data directory for the current Windows SID and SYSTEM, generates random database/owner/backup/control secrets locally, and never starts processes automatically. It preserves an existing private `.env` rather than overwriting configuration during side-by-side installation.

Run installed `Start.ps1`. It launches the supervisor hidden. The supervisor initializes/starts its local cluster, runs serialized migrations, and creates only a branch and owner in an empty pharmacy. Profile/tax confirmation stays false. It creates no sample catalog, suppliers, stock, sales or cashier. After successful bootstrap it removes the bootstrap password from `.env`. Initial credentials remain in protected `initial-owner-credentials.txt`; change the owner password, move credentials into approved custody and remove that initial file through your normal secure handling process.

Open `http://127.0.0.1:3002`. `/health` reports local database availability. Administration exposes release/recovery checks; detailed startup and structured request logs are in private `application.log`. Logs omit passwords, request bodies and query strings. Configure log retention/rotation and a supervised launch policy for the deployment; the supplied launcher is not a Windows Service or unattended login task.

## Stop, upgrade and rollback

Use installed `Stop.ps1`. It reads the private control token locally, requests graceful API shutdown, and lets the supervisor stop its owned PostgreSQL process. Wait for private `supervisor.lock` to disappear. A live lock refuses another supervisor. A stale lock is checked against its process before recovery; do not remove one merely because startup is slow. An already running database not started by that supervisor is not forcibly stopped.

Before upgrading, finish/synchronize prepared counters, restore-verify a backup, stop writers and stop the installed service. Install the reviewed release into a new program directory using the same data directory. Existing secrets, SQLite journal/key and PostgreSQL data stay in place. Start the new release and reconcile sample invoices, balances and roles. The installer does not perform a live financial cutover or an automatic database downgrade.

For rollback, stop the new release and use an earlier binary only after verifying compatibility with the current schema and policy. Never run a version that bypasses a newly configured approval policy. Never delete migration rows or financial history. A schema-incompatible rollback needs an independently reviewed backup/recovery plan; it is not solved by switching folders. Retain both program directories for review.

The standalone `npm run db:bootstrap` command supports externally managed PostgreSQL after migrations, using private `PHARMACY_NAME`, `BOOTSTRAP_OWNER_USERNAME`, and `BOOTSTRAP_OWNER_PASSWORD` variables. It rejects a nonempty pharmacy. `db:seed` remains demonstration-only.

## Acceptance evidence and boundaries

The isolated installed-package check initialized one owner/branch and zero medicines, suppliers or sales, removed the bootstrap secret, verified an encrypted backup restore with zero invoice/stock/journal/transfer mismatches, and stopped application/database gracefully. Acceptance data remains under ignored `.release-test/`; it is never shipped. See PHASE-5.md for final build/load/regression results and the retained release artifact.

This test used the current workstation and separately installed runtimes. It does not establish Windows 10/11 hardware coverage, code signing, TLS deployment, off-machine recovery, operator training, least-privilege production database setup, or unattended service supervision. Those deployment controls remain tracked acceptance items.

## Phase 25 candidate integrity and schema boundary

The source now generates manifest schema pharmacy-release/v2. `npm run package:windows` first builds the current source, then self-verifies the exact release inventory, required files/assets, migration hashes and policy. Run `npm run verify:release -- <candidate-directory>` to repeat the check. Install, Start and the supervisor verify before starting the application; a modified, extra, missing or linked program file is refused. Installed programs may contain their separate data-location.txt pointer. Protect that pointer and the private directory independently. A copied manifest or unsigned hash is not a publisher signature; the current candidate remains unsigned and requires trusted delivery.

The guarded migrator refuses applied migration names unknown to the release and out-of-order histories. This is a refusal boundary, not a database downgrade or proof that an earlier policy is safe. Old frozen releases have not been retrofitted. Never use deletion of migration rows as a rollback procedure. Prepare a verified compatible version or an independently reviewed recovery cutover instead.

For checkout-side qualification on Windows use `npm run test:acceptance` (fresh private cluster and fixture) and `npm run qualify:installed -- <candidate-directory>` (fresh protected program/data, clean owner-only bootstrap, encrypted restore and same-candidate side-by-side restart). Both helpers retain private test data under ignored workspace paths and stop owned processes. They must not be pointed at production data. The second helper uses available ports 3005/55527 and refuses occupied ports. See [Phase 25](PHASE-25.md) for exact evidence and external acceptance gaps. Manual launch remains the supported candidate topology; no unattended service or scheduled startup is installed.

The 25 November local Phase 25 candidate passed 60 backend tests, 35 Chromium journeys, separate Firefox smoke, clean installed bootstrap, encrypted restore and same-candidate side-by-side preservation/shutdown, including conflicting inherited configuration. These are local candidate results; the frozen Phase 5 distribution is unchanged. See PHASE-25.md for the retained candidate and external gates.


## Fractional-cost schema compatibility

Source version 0.26.0-dev.2 requires migrations through 022 for fractional purchase costs and per-line tax. This source update does not replace the previously frozen release candidates. Build/package a matching candidate before installation and retain an encrypted pre-upgrade backup. Existing guarded older candidates refuse the newer schema; never remove schema history to force a downgrade. Migration 022 preserves historical financial fields and leaves their new snapshots null. See PURCHASE-COSTING.md for the current value model and Phase 24 for software evidence; signing and target-host recovery qualification remain open.


## Current deployment qualification checklist

The matching 0.26.0-dev.2 candidate contains 22 migrations and 1,750 verified files. Follow [Deployment qualification](DEPLOYMENT-QUALIFICATION.md) in the source documentation for the exact candidate path, repeatable commands and target-environment evidence still required. The packaged documentation remains the immutable snapshot from packaging time; the current PHASE-25.md records subsequent installed results. An unsigned local candidate does not close signing, hosted CI or target-machine gates.
