# Field acceptance procedure - Phase 26

Status: ready for an actual site rehearsal; no field result is supplied by this document. Use the selected branch's Pilot rollout > Field acceptance and handoff. Record PENDING, DEFERRED, FAILED or a named operator ATTESTED declaration. An attestation is a human declaration; the application cannot independently verify a device, physical location or signature.

## Prepare the rehearsal

Identify the branch/site, actual release, operator, witness and training device. Use an isolated training database and clearly marked training pharmacy/receipt footer for financial drills. Do not invent live customer transactions to produce test evidence. Keep the existing live counter, database, SQLite journal and key untouched. Agree RPO/RTO and cashier timing targets before measurements. Identify the current support contact, escalation path and rollback/recovery owner. Export the original pilot checklist and review its profile/catalog/stock/staff/deployment entries; the field handoff export also captures that checklist in the same database snapshot.

## Printer: actual 80 mm device

Record make/model, asset and connection. Check the printer driver and 80 mm browser paper configuration, margins and scaling. Print an original training receipt and its application reprint (at least two copies checked). Inspect pharmacy identity, invoice number, long product names, packs, amounts, change, batch/expiry, footer and duplicate marking. Record legibility and duplicate results with a reference to retained paper/photos. Do not claim automatic cutting, cash drawer or native driver integration from a browser print result. A failed or clipped print is FAILED, with the correction and separate retest retained.

## USB scanner

Record make/model and the confirmed USB interface (HID keyboard or other tested USB integration). Check the intended focus, Enter suffix and keyboard layout. Perform at least three scans, including a leading-zero barcode, a normal barcode and repeat/rapid scanning. Match the exact intended products/quantities and preserve the literal barcode. Record scan count and exact-match count; all must agree before attestation. Unsupported/ambiguous scans are FAILED. Do not assume that a USB connection alone proves HID behavior.

## Outage and once-only replay

On the isolated training deployment, open a cashier shift and explicitly reserve the offline pool while online. Record invoice IDs and starting quantities. Use an approved controlled connectivity/server outage; do not abruptly power off the live production machine. Complete offline training cash checkout, reload/reopen the prepared counter and verify the saved invoice/outbox. Record pending invoices before reconnect. Restore connectivity, synchronize and retry synchronization. Verify each intended invoice posted once, no extra customer cash/invoice appeared, and batch/movement quantities reconcile. Record equal pending/synchronized counts, zero duplicates, zero stock mismatches and reload recovery. Finish the offline session and close/reconcile the training shift. Preserve failure evidence and re-run after correction as a new declaration.

## Off-device recovery and key custody

Copy the encrypted backup to the actual off-device destination under the agreed process. Record a backup ID/checksum and custody procedure reference; never paste keys/passwords into the form, export, screenshots or support messages. Confirm an authorized custodian can access the independent recovery key. Recover on a different approved machine/site into an isolated target; never overwrite the live database for rehearsal. Include the counter-local identity/key and prepared-stock/outbox reconciliation in the recovery plan; a server backup alone does not reconstruct a lost unsynchronized counter journal.

Measure RPO as the time-equivalent data gap between the agreed reference point and the latest reconciled recovered transaction. Measure RTO from declared recovery start until authenticated service and reconciliation are usable, using the agreed scope. Enter integer seconds, using conservative rounding up; do not use zero for unknown/unmeasured values. Compare measured values with the pre-agreed maximums and retain the actual timings/reference transaction IDs. Reconcile invoices, stock, accounts and journals and confirm zero mismatches. Same-machine restore is useful software evidence, not off-device disaster recovery acceptance. Missed targets remain FAILED until a separately evidenced retest succeeds.

## Cashier training

Record the named operator, training session and number of timing samples. Review barcode focus, pack units, FEFO, payments/change, restricted items and supervisor approval, returns and cash closing. Agree the maximum checkout time; record the slowest measured sample in seconds and reference the sample log, rather than picking a favorable average. Verify sale/payment, return/approval and closing reconciliations. Record all outcomes; a missed target or incorrect result is FAILED. Train each assigned operator; separate records/session references retain individual evidence. The latest summary is per drill, so use the complete export/history to inspect every operator, not only its most recent row.

## Owner handoff review

Review the combined exported pilot/field history and the outstanding Phase 25 deployment gate and the completed Phase 24 verification. Record the signed review document reference, named reviewer, observed time, site and release. This records review evidence and does not grant production approval. The application always exports production_approved=false; an external, independently evidenced owner/site production decision still needs all required controls resolved. No green count or ATTESTED state overrides another phase's open requirements.

Download Export field handoff JSON and retain its displayed SHA-256 independently with the signed documents, paper/scanner evidence, recovery log, timing samples and release manifest. The checksum covers the exact returned UTF-8 JSON; it is not a digital signature. Later exports have new generation times and may include new declarations. Do not edit old evidence: record PENDING/FAILED/corrections as a new event. Only a branch OWNER who is an organization administrator can append records after password confirmation; authorized organization administrators can review/export the selected branch. Ordinary cashier accounts cannot access these records.
