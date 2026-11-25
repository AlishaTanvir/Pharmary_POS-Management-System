# Phase 20 - purchase invoice adjustments

Authorized as the next sequential phase after Phase 19. Source: 0.20.0-dev.1. Verification date: 23 November 2026. Status: software complete within the declared allocation/costing policy; field acceptance and production approval remain pending.

## Invoice workflow and supported policy

Direct receiving and receiving against purchase orders now accept invoice-level discount and tax amounts. Enter gross pack costs before these adjustments. The shared preview shows goods subtotal, discount, tax, inventory cost, separate input tax and total supplier payable. Tax amounts come from the operator's supplier invoice; the app does not infer a tax rate, eligibility, exemption or filing requirement.

When tax is nonzero, choose the agreed treatment explicitly: Include tax in inventory cost (CAPITALIZE), or Track separately as input tax (RECOVERABLE). No treatment is silently selected. With no tax, the stored classification is NONE. This is a posting classification selected by the operator, not a determination that tax is legally recoverable.

Discount is allocated across receipt lots proportionally to gross goods value; tax is allocated proportionally to value after discount. Cumulative half-up integer arithmetic in request-line order makes the allocations sum exactly to the entered invoice amounts, including rounding remainders. Zero-value lots receive no allocation. A positive tax with no value after discount is rejected. The same calculation is used by client preview and server validation.

The existing stock model requires whole paisa per base unit. Every adjusted lot cost must divide exactly by its received base quantity. Unsupported fractional-paisa unit costs reject the entire receipt; no rounding expense, fractional stock cost or silent partial receipt is posted. The preview explains the failed line. This phase supports invoice-level proportional allocation with one tax treatment per invoice. Line-specific tax/exemption allocations and mixed recoverability that do not fit this policy require a separately agreed workflow; operators must not force a mismatched bill into this model. These limits remain tracked work rather than a claim of universal tax accounting.

## Posting, stock costs and supplier credit

Supplier payable is goods subtotal minus discount plus tax. For CAPITALIZE, that full amount becomes inventory cost. For RECOVERABLE, inventory receives the discounted goods cost and the separate tax amount is recorded to the purchase-input-tax account. Purchase lines snapshot their gross value, allocated discount, tax and inventory cost; each batch stores the resulting exact whole-paisa base-unit cost. Subsequent FEFO sales, cost of goods sold, valuation, transfers and offline central replay use those existing batch cost snapshots.

Actual order receipts use the same service and policy. Order estimates remain gross planning values; invoice adjustments do not receive extra packs, reopen completed quantities or bypass actual-price variance explanations. Receipt/order mappings, quantity caps, duplicate vendor references, selected-branch validation, atomicity and idempotency remain. Estimated and actual gross pack costs are compared before invoice adjustments.

Supplier credits use the original net inventory cost. For RECOVERABLE invoices they also reverse a proportional part of the original lot's input tax. Tax entitlement is the difference between cumulative rounded portions before and after the returned quantity. Repeated or differently grouped partial returns cannot recover more than the original tax, and a full return recovers it exactly. Stock/reservation/original-quantity checks and invoice locks retain the existing concurrency controls. Compare the computed total with the accepted supplier credit note before confirming. Credits reduce supplier payable; a credit after payment remains money owed to the pharmacy rather than an automatic cash refund.

The supplier-return preview now separates inventory credit, input-tax reversal and total credit. Invoice payments, outstanding balances and aging continue to use payable less payments and credits. The read-only invoice detail shows the posted breakdown and lot allocations. Supplier suggestions use the latest net inventory pack cost. Current supplier/product display names remain live master references; this phase does not add historical master-name reconstruction.

## General ledger and database invariants

Migrations 016 and 017 are additive. Migration 016 adds nullable historical component snapshots, zero defaults for unrecorded adjustments, the 1150 Purchase input tax account, and deferred receipt/credit reconciliation constraints. Migration 017 adds the separate journal-component guard; it was kept additive because the development database had already applied 016. No posted invoices, unit costs, credits or existing journals are backfilled or rewritten.

Explicit operational GL posting records purchases as inventory plus any separate input tax against supplier payable. Supplier credit journals reverse inventory and the credited input tax against payable. Existing journals retain their IDs and are not posted again. Deferred constraints verify new invoice totals against line allocations, inventory value against batch unit cost, credit totals against credit lines, and PURCHASE/SUPPLIER_RETURN journal components against their immutable source records. Balanced but incorrectly classified purchase journals are rejected atomically.

Legacy invoices without captured components retain their original costs and totals. Detail views label missing discount/tax information as Not captured. Legacy receipt and PO retry hashes remain compatible when optional zero adjustments are added or omitted. A changed nonzero adjustment under an existing receipt key is rejected. Older binaries do not provide the new tax workflow; use a compatible application version for further posting after this upgrade. The frozen Phase 5 archive is unchanged.

## API and access

POST /api/purchases/receipts and POST /api/purchase-orders/:id/receive accept optional discount_paisa, tax_paisa and tax_treatment (CAPITALIZE or RECOVERABLE). The amounts are nonnegative integer paisa within the existing amount bounds. The zero/absent case preserves legacy behavior. Existing purchase-write, selected-branch and CSRF controls apply. No posting is performed by the browser preview.

New GET /api/purchases/:id requires purchase-read and selects the current branch. It returns the immutable breakdown, original lot quantities and current descriptive names; foreign invoices return 404 and cashier access is denied. The generated access inventory was updated. Current matrix coverage is 147 declared routes, 134 session routes, 76 write-CSRF checks and 488 denied-role checks. Supplier-return approval still requires the existing write/ledger grants and password sign-off.

## Verification

All 51 backend tests passed after correcting a UUID comparison in the new journal guard. The final additive 016/017 migration sequence then passed six targeted receiving, purchase-order, saved-cart/credit and legacy-upgrade tests. New coverage verifies exact allocation/conservation, explicit tax choice, large totals, rejected fractional costs, legacy replay and migration, net cost snapshots, invoice overpayment refusal, paid-invoice supplier credits, concurrent partial tax returns, adjusted PO quantity tracking, rollback, COGS, input-tax balance, unchanged legacy journals and rejected incorrect GL components.

The final source-inventory/TypeScript/Vite build passed, and all 30 browser journeys passed in the complete suite. This includes both direct/order adjustments, supplier credits, operational finance/reversals, encrypted isolated restore, checkout/returns/ledgers, access controls and real offline outage/reload/replay. The new receipt test first needed its dropdown selectors corrected; the corrected journey passed independently and in the full run. The complete backend suite includes the current source-inventory and isolated API denial matrix. The new browser journey covers both tax treatments through direct/order receipts, posted invoice detail, tax-aware supplier credit, unsupported allocation refusal and cashier boundaries.

Visual review passed for the adjustment preview and saved invoice detail at a 1366 ? 1000 viewport. Local screenshots are retained in test-results/phase-20-adjustment-preview.png and test-results/phase-20-invoice-detail.png. The preview review did not post another receipt.

## Handoff and remaining work

Review entered bill amounts, treatment and lot allocation in the preview before posting. Use View supplier invoice to inspect the saved breakdown; posted amounts cannot be edited. Use the accepted supplier-credit workflow for returned goods. Use a new source transaction and correcting workflow for genuine corrections rather than reusing a posted key with changed amounts.

Opening balances remain Phase 21 in the proposed roadmap. Six proposed packages (21-26) remain after this phase, subject to scope and policy decisions. Fractional unit costs and invoice allocations outside the declared proportional policy remain explicit limitations. Bank reconciliation, historical classification, currency/configuration, deployment, hardware/off-device recovery and operator production approval remain tracked separately. Phase 21 has not started.


## Later extension

On 25 November 2026 the user requested fractional costs and per-line tax support as Phase 24 follow-up work. Migration 022 and the matching app supersede this report's fractional/mixed-treatment limits for new receipts. This Phase 20 report retains its original verification record. See [Purchase costing](PURCHASE-COSTING.md) and [Phase 24](PHASE-24.md) for the current policy and verification.
