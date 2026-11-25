# Phase 3 — offline hardening

> Historical phase snapshot. Later-phase status and unresolved baseline requirements are maintained in [REQUIREMENTS-MATRIX.md](REQUIREMENTS-MATRIX.md) and [PHASE-5.md](PHASE-5.md). Statements about future phases below describe the situation when this report was written.
Authorized by the user on 17 November 2026. Phase 4 expansion remains unstarted. Hardware/installer, real pharmacy data, off-machine backups and operational UAT requirements carried forward from earlier phases are not certified by this delivery.

## Supported deployment

The Windows counter runs the Node.js application locally, bound to loopback, with the website and a local SQLite journal served from the same local service. PostgreSQL remains the authoritative database, reachable on the store LAN or a secured private connection. If that database/connection is unavailable, the local counter service and its SQLite store continue serving prepared checkout. No direct public PostgreSQL exposure is required or recommended.

This is not a promise that a remotely hosted browser page will run without its host, or that billing continues after the counter's own local service or disk fails. A browser-only service-worker/IndexedDB fallback is not substituted for the required SQLite journal. Native Windows installer/Tauri packaging remains a separate outstanding rollout artifact. Runtime tested: Node.js 24.21.0, with node:sqlite. CI now selects Node 24.

Each counter has its own local service, journal and key; central stock pools are separate. Do not clone an active journal/grant onto another computer. Multiple browser tabs sharing one counter journal use the same atomic SQLite stock balances. A new or unprepared device cannot start disconnected checkout.

## Delivered behavior

- Online preparation re-authenticates the signed-in cashier, requires an open shift and confirmed tax profile, selects unrestricted medicines, and reserves quantities by eligible FEFO batch. Each preparation is bounded to 100 medicines and 100,000 base units per medicine; full-catalog scalability is not claimed.
- A reservation immediately reduces available stock for ordinary online checkout and other counter preparations. Physical inventory retains the full on-hand count and displays the reserved quantity separately.
- Each grant captures permitted medicines/units, price/tax snapshots, batch/expiry, pharmacy receipt details, branch/cashier/shift, unique device identity and an authorization deadline. Default window: eight hours; maximum: twelve.
- The local store encrypts sensitive configuration and sale payloads using AES-256-GCM. Device credentials and the offline PIN verifier are encrypted; the central online password/session cookie is not cached. SQLite metadata (IDs, statuses, attempts and timestamps) is not whole-file encrypted. Protect the data folder/key with OS access controls and device encryption.
- Local access uses a separate HttpOnly/SameSite cookie and an eight-character-minimum PIN. Five failed attempts lock unlocking for fifteen minutes. Sessions expire after thirty minutes of inactivity; passive status polling does not renew them. User mutations renew the local session.
- Offline checkout supports full cash tender/change, frozen approved prices/tax, configured units, local FEFO, available reserved quantities and local-date expiry checks. Restricted medicines, price overrides/discounts, customer credit, card/wallet payment, refunds, purchases and shift closing require the online workflows.
- `BEGIN IMMEDIATE`, WAL and synchronous FULL protect one atomic write of immutable invoice, stock-pool deduction and durable outbox entry. Receipt rendering/printing happens after commit. Retry with the same input/key returns the original invoice; changed input with a reused key is rejected.
- Offline invoice IDs use a branch/counter prefix plus the event UUID; the same invoice number is preserved centrally. Batch allocations and price snapshots survive synchronization. Printed reprints are marked DUPLICATE.
- A preparation interrupted before the central commit remains STAGED and cannot sell. Recover preparation checks central confirmation before activating; a rolled-back preparation can be safely marked finished and prepared again.
- Background synchronization runs every fifteen seconds while the local service runs, with exponential backoff up to five minutes after transport failure. Manual synchronization can retry immediately. Durable statuses are PENDING, SYNCED and CONFLICT, with attempt counts and corrective messages.
- Synchronization authenticates the counter credential, rechecks the user's branch/access, original shift, grant time, approved price/tax/receipt and exact batch reservations. Sale/line/payment/allocation/movement/audit and sync acknowledgement commit together in PostgreSQL.
- A lost acknowledgement is safe: replay returns the existing accepted result without another invoice or stock deduction. Reusing an event ID with different contents is rejected.
- Blocked/recalled/expired/changed stock, revoked access and inconsistent receipts are held as immutable conflicts for manager review. There is no silent financial rewrite, automatic restocking or automatic grant release.
- Reserved stock remains held after an authorization expires because unsynchronized physical sales may still exist. A shift cannot close while its offline grant remains active.
- Finish offline session seals local posting before central release, requires all local invoices to be synchronized with no conflicts, and releases only unused pool quantities. A failed finish stays sealed and can be retried after reconnect.
- Sync review lists branch-scoped device reservations and conflict reasons for authorized report/audit users. Conflict review is explicit; this version does not invent an automatic resolution for an already completed physical sale.

## Operating procedure

1. Start the service with `npm run local` for the demo, or `npm run server` with configured authoritative PostgreSQL access on a deployed counter. Open http://127.0.0.1:3001.
2. Sign in, open a shift, then choose Offline counter and Prepare offline stock. Allocate only the stock intended for this counter, choose the duration and a local PIN, and confirm with the online password.
3. Unlock the prepared counter. During an outage, the login page also offers Open prepared offline counter; a new central login is not required to use the bounded grant.
4. Scan/search, select units/quantity, review payment and confirm cash. A saved offline receipt is a durable local transaction even before synchronization. Check Local invoices & sync to distinguish pending, accepted and conflict states.
5. On reconnect, synchronize. Never re-enter a saved offline invoice as a new online sale. Check the original invoice UUID/status instead.
6. Finish the offline session when every invoice is synchronized. Unused stock is released and the original online shift can close. Lock the finished counter before preparing the next session.
7. For a conflict, keep the journal and pool intact. An authorized manager must reconcile the physical sale, product status and refund/stock obligations using the original event and audit history. Do not delete the outbox, change event IDs or manually release held quantities to hide the issue.

## Local files and recovery

- Default journal: `.local/counter.sqlite`, with its SQLite WAL/SHM files while running.
- Payload key: `.local/counter.sqlite.key`; this is separate from BACKUP_KEY. Losing this key makes the encrypted local payloads unrecoverable.
- Set OFFLINE_DB_PATH before deployment to choose a fixed protected local data location. Do not change it after preparation without a controlled migration; the old grant and unsynchronized stock remain real obligations.
- Central PostgreSQL backups include reservations, accepted invoices and conflict receipts but cannot recover transactions that have never synchronized. Protect the counter data/key independently. Stop the counter service cleanly before an administrator copies the whole local folder, including any WAL, and store keys separately under the recovery policy.
- After a process crash, reopen the same local database/key. SQLite recovers committed WAL records; uncommitted cart/posting writes roll back. Check pending invoices and reconnect before releasing stock.
- Clock rollback beyond the stored tolerance blocks new posting. Authorization and expiry depend on the counter's clock; OS time/device integrity must be controlled. A disconnected device cannot learn about a newly issued central recall immediately. Reconnect frequently; replay rejects changed/blocked stock for explicit review, rather than pretending offline data stayed current.

## Acceptance evidence

The automated suite verifies local FEFO/unit/tax/authorization boundaries, atomic rollback, idempotent local retry, encrypted payload storage, passive-poll session behavior, reopen recovery and abrupt process exit with an unclosed SQLite WAL. A real PostgreSQL test verifies two non-overlapping counter pools, online stock exclusion, frozen approved pricing, lost-ACK replay, identifier/payload rejection, interrupted preparation, recalled-stock conflict retention and shift-close safeguards.

The browser outage drill actually stops PostgreSQL, completes and prints/reviews the local sale, reloads the website while the database is still stopped, verifies the durable pending record and local retry, restarts PostgreSQL on its configured port, synchronizes the original invoice once and releases unused stock. Phase 1/2 regression and encrypted restore journeys run alongside it.

Final verified results are recorded below. These are demo acceptance results, not Windows hardware certification, production load/capacity claims or a security penetration test.

## Verified results — 17 November 2026

- Production TypeScript/Vite build: passed.
- Automated suite: 16 passed, 0 failed, including real PostgreSQL reservation/replay/conflict tests and an abrupt SQLite-process-exit recovery test.
- Browser suite: 6 passed, 0 failed, including the real database outage/reload/reconnect drill and the complete Phase 1/2 operational and encrypted restore regressions.
- The outage drill completed a local cash invoice while PostgreSQL was stopped, reloaded the app with the same queued invoice, retried without a second local posting, restarted PostgreSQL, created exactly one central invoice with the same UUID/number, and released only the unused stock pool.
- Final browser checks include rejection of an invalid local Host header. Automated checks verify that passive local status reads do not renew the idle session.
- Screenshot review covered the counter/outbox and synchronized-session screen. Artifacts are under ignored test-results/.
- An initial reconnect harness used PostgreSQL's default port and inherited process pipes. The harness was corrected to use the configured port and detached control-process handling. The retained test invoice was synchronized and its unused pool released; no financial records were deleted to recover the test. The full corrected suite passed afterward.
- The latest demo preparation was finished after synchronization. Its acceptance-test PIN is intentionally not published. Sign in online and prepare a new counter session with your own PIN; accepted test receipts remain in central sales history.

Phase 4 was not started. Actual Windows service/installer delivery, physical scanner/printer and outage UAT, OS/disk/key protection and recovery testing on representative production data remain rollout requirements.
