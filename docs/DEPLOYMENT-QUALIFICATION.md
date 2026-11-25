# Phase 25 deployment qualification

Current source: `0.26.0-dev.2`, migrations through `022_fractional_purchase_costs.sql`. This checklist separates repeatable local candidate evidence from evidence that must come from the intended deployment. Completing this file does not grant production approval.

## Current candidate

The matching unsigned candidate is retained at `releases/pharmacy-pos-0.26.0-dev.2-2026-11-25T15-05-23-873Z`. Its v2 manifest verifies 1,750 files and 22 migration hashes. Source build, 66 backend tests and 38 Chromium journeys passed before packaging. See PHASE-25.md for the installed qualification result and evidence reference. Do not edit the packaged files after verification; prepare a new candidate for source changes.

To repeat package verification from the checkout:

```powershell
npm run verify:release -- releases/pharmacy-pos-0.26.0-dev.2-2026-11-25T15-05-23-873Z
```

The isolated installed rehearsal is:

```powershell
npm run qualify:installed -- releases/pharmacy-pos-0.26.0-dev.2-2026-11-25T15-05-23-873Z
```

This creates new private test program/data directories, requires free ports 3005/55527 and at least 1 GiB free space, and retains its fixtures. It must not target the pharmacy's live data directory. The resulting summary records the actual OS/runtime, package manifest checksum, applied migration list, clean bootstrap counts, isolated restore checks, configuration preservation and graceful shutdown. Private credentials and database files are excluded from distribution.

## Inputs and evidence still needed

| Gate | Required input / concrete exit evidence | Current boundary |
|---|---|---|
| Deployment topology | Confirm one Windows computer or multiple computers; identify target OS, machine and intended program/data paths. | The supplied application and database bind to loopback; the installed candidate is manually launched. No LAN or public endpoint has been qualified. |
| Publisher identity and trusted delivery | Identify certificate/signing process and distribution custodian; retain signature verification and the delivered candidate checksum. Alternatively record an explicit reviewed scope decision about unsigned distribution. | Current candidate is unsigned. Hash verification does not authenticate its publisher. |
| Hosted CI | Supply the intended repository and permission to run the existing workflow; retain the successful run URL, commit and credential-free artifacts. | `.github/workflows/checks.yml` exists; local tests do not prove a hosted run. No repository was supplied. |
| Launch and recovery policy | Identify the operator or unattended service account, start/stop/restart procedure and failure alert owner; rehearse them on the target. | No Windows service or scheduled task has been installed. |
| Host access and transport | Record target access restrictions, firewall/endpoint policy and applicable TLS/cookie configuration; verify the actual chosen topology. | Existing loopback operation is tested. Remote access requires additional configuration and qualification. |
| Database privileges and private storage | Provide the target database administrator and runtime-role plan; verify restricted grants, private data ACLs and backup/key custody. | The local installer manages a private PostgreSQL cluster using its generated administration account. A least-privilege production role has not been qualified. |
| Monitoring and logs | Record health monitoring, log retention/rotation, disk-space checks and the responsible responder; demonstrate an alert and retained evidence. | Health and private request/startup logs exist; target monitoring and retention are unconfigured. |
| Runtime/browser/accessibility coverage | Identify intended Windows, runtime, browser and assistive-technology combinations, then retain results on those combinations. | Local source/installed evidence covers the recorded workstation. Earlier Firefox smoke is historical evidence for its earlier candidate. |
| Rollback/recovery | Identify the prior compatible release, off-device backup/key location, target RPO/RTO and stop-writers/cutover owner; rehearse recovery in isolation. | Same-candidate side-by-side preservation is tested. Older guarded candidates refuse migration 022; switching folders does not undo the schema. Never remove migration history. |

Record the actual target, operator, observation time, candidate checksum, result and evidence location for each completed gate. Keep passwords, private keys and patient/customer data out of these records. Failed or deferred gates remain open. External signing, repository operations, machine configuration and cutover are performed only within the user's supplied deployment scope.

Printer/scanner checks, measured off-device recovery, cashier training and owner/site acceptance remain Phase 26. Follow FIELD-ACCEPTANCE.md after deployment qualification; software tests cannot substitute for those observations.
