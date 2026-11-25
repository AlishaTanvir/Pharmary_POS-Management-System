# Phase 26 - Field acceptance and production handoff

Initiated 25 November 2026 at the user's request, before returning to unfinished Phase 24/25 items. Source: 0.26.0-dev.1. Status: field-evidence tooling and handoff preparation verified; actual device, off-device recovery, training and owner acceptance remain pending. No new phase is invented and no production approval is implied.

## Implemented preparation

Pilot rollout now has a separate structured field section for actual 80 mm printer/reprint, USB scanner fidelity, outage/reload/once-only replay, off-device recovery/custody/RPO/RTO, cashier training/timing and owner handoff review. Nothing is pre-attested. PENDING, DEFERRED, FAILED and ATTESTED preserve their distinct meanings. The old pilot checklist and project deferrals remain separate and do not manufacture a branch result.

Migration 021 adds append-only branch-scoped field events with an increasing sequence, captured recorder ID/name, declared operator/time/site/release, measurements and evidence references. Repeated identical requests return the same event; a changed payload cannot reuse its key. Recording requires organization-administrator and branch-OWNER authority plus password confirmation. All routes retain session/CSRF protection. Unknown measurement keys/types, future observation times, missing attestation evidence, failed boolean checks, too few samples, mismatched counts, nonzero reconciliation errors and exceeded declared recovery/training targets refuse ATTESTED. Failed results may be retained as FAILED, without forcing operators to invent passing data.

The repeatable-read handoff snapshot includes the original pilot checklist/setup facts and complete field history for that branch. Export returns exact JSON bytes and their audited SHA-256. Hashes are integrity references, not publisher/operator signatures. All exports always state production_approved=false; even all six ATTESTED declarations or an owner review cannot close the outstanding Phase 24/25 gates or grant production use. A later declaration changes the current summary without changing earlier evidence. Existing posting permissions continue to govern checkout; actual production access/cutover remains an external owner/deployment control. One summary row per drill does not substitute for reviewing every trained operator's session in full history.

Use [the field procedure](FIELD-ACCEPTANCE.md) and [uncompleted handoff template](FIELD-HANDOFF-TEMPLATE.md). They specify real-device samples, controlled isolated financial drills, off-device/key-custody evidence, measured integer-second RPO/RTO and training targets, support/escalation and signed owner review. No passwords or key material belong in these records.

## Verification and storage finding

The final production build and all 62 backend tests passed. The new field-domain/database checks include a fictional complete attestation and confirm that neither it nor all six declarations grant production approval. The broad backend run encountered an actual workstation capacity failure while creating retained test databases. This is not a product acceptance pass. Original application data and retained financial/test evidence were not deleted. Disposable downloaded Firefox/cache archives were removed, and stopped historical test fixture directories were compressed reversibly to reclaim space. The test commands now check available storage before starting (3 GiB for retained backend fixtures and full browser acceptance; 1 GiB for a named focused browser run). These are conservative local qualification budgets, not certified production disk requirements. Capacity recovery exceeded 5 GiB; the final build passed and all 62 backend tests passed in a clean rerun. The broad browser rerun passed 34/36 journeys. The field journey used an exact label selector that did not resolve its visible named combobox; this was corrected to its accessible role/name. The supplier journey encountered a temporary missing index page during a concurrent preview rebuild. After the build stabilized, the complete field, existing pilot and supplier journeys passed 3/3 in a fresh isolated run (26.5 seconds). All 36 distinct journeys therefore have passing coverage across that broad run and focused rerun; this is not a clean single-run 36/36 claim. A presentation-only refinement expands the evidence box and ensures readable field table/status text; its focused field check passed 1/1 (8.6 seconds) and desktop/mobile previews were reviewed. The final plain-language gate-label field journey also passed 1/1 (9.3 seconds); its desktop/390-pixel previews passed visual review. All owned API, PostgreSQL and compression processes completed and stopped. Migration 021 was applied to the retained local database and the owned server stopped; no field declarations or financial postings were created there. The final build uses 57 modules with index-2qWpvhVI.js and index-B8XUfXIu.css. Route inventory is 163 declared routes, 150 session routes, 88 CSRF checks and 566 denied-role checks.

## Remaining acceptance

Actual printer/scanner models and observations, physical paper/barcode samples, off-machine restoration and custody, measured RPO/RTO and cashier sessions, site support arrangements, and external owner production approval remain pending. Historical user deferrals remain recorded; no software test is presented as a field result. Phase 24 decisions and Phase 25 external release/deployment qualification remain open and will be handled separately at the user's request.


## Retained handoff evidence

The 34/36 broad result is retained in .local/phase26-broad-browser-evidence.json; the successful 3/3 field/pilot/supplier rerun is in .local/phase26-focused-browser-evidence.json. The final field presentation run is retained separately in .local/phase26-final-browser-evidence.json. Screenshot paths are test-results/phase-26-field-desktop.png and test-results/phase-26-field-narrow.png. Every automated field declaration is explicitly fictional and lives in an independently named test database. The retained application database received only additive migration 021, with no fabricated field records or financial postings.

Cold-fixture compression preserves logical file contents and directory names; the application database and frozen releases were excluded. Disposable browser/download cache can be recreated; extracted backup tools and checksum provenance were retained. The operation recovered over 6 GiB of usable space after tests, and the new storage preflights prevent starting below the declared local test budgets. Earlier storage-interrupted runs and the two browser rerun causes are not hidden or counted as clean acceptance passes.

## Subsequent scope update: PKR accepted

On 25 November the user accepted PKR-only scope. Currency switching and FX are deferred; the handoff Phase 24 gate now names only the still-open optional FEFO/purchase-costing workflows. No branch operator attestation or production approval is inferred from this project decision. See PHASE-24.md.

## Subsequent scope update: automatic FEFO accepted

The user accepted mandatory automatic FEFO and deferred manual overrides on 25 November. The Phase 24 handoff gate now names only purchase-costing scope. No physical field attestation or production approval follows from this scope decision.


## Phase 24 follow-up

The user accepted PKR-only and mandatory automatic FEFO, then requested fractional costs and per-line tax. Migration 022 and version 0.26.0-dev.2 implement the costing extension. The current handoff no longer lists a Phase 24 decision gate; Phase 25 external deployment qualification and all actual Phase 26 device/operator acceptance requirements remain open. Earlier verification records in this report describe the gates at their own checkpoints. See PHASE-24.md and PURCHASE-COSTING.md.
