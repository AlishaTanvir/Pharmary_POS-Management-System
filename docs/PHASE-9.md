# Phase 9 - purchase orders and partial receiving

Authorized as the next sequential software increment after Phase 8. Source: 0.9.0-dev.1. Verification date: 20 November 2026. Status: this software increment is complete.

## Workflow

Purchases now supports internal purchase orders with a branch supplier, optional expected delivery date, notes and up to 100 unique medicine/unit lines. Each line captures the current product name, pack name, conversion, ordered packs and estimated cost. Creating an order changes neither stock nor supplier payable. Orders are immutable planning records; correct an unreceived plan by cancelling its remainder and creating a new order.

Receive each actual supplier invoice against its order. One invoice can contain several lots for the same ordered line, each with its own batch code and expiry. Actual quantities cannot exceed the remaining ordered packs, including concurrent receipts. Changed pack costs require an explanation and must divide into whole paisa per base unit. Inactive products, invalid conversions and expired stock remain subject to the existing receiving controls.

Each successful receipt uses the existing atomic purchase, batch, movement, supplier payable and audit transaction. Immutable links connect the actual invoice lines to their original order lines. Orders show ordered, received, outstanding and cancelled quantities, posted invoice references and cost explanations. Supplier returns do not reopen ordered quantities. Existing settlement and operational journal posting continue through their established workflows; an order itself is not a journal posting.

An owner or manager can cancel an outstanding remainder after password confirmation and a reason. Cancellation preserves received stock, supplier invoices and payable. Fully received orders have no cancellable remainder. Identical receipt retries return the same posted invoice, including after cancellation; changed requests using the same key are rejected. A direct-receipt key cannot be reused to attach an unrelated invoice to an order.

The internal JSON export records an audit event and explicitly identifies that no supplier transmission occurred. No supplier email, external procurement API, regulator submission or live payment is initiated. Orders do not reserve stock or promise supplier delivery. There is no order editing, approval hierarchy or automated supplier dispatch in this increment.

## Data and access

Migration 010 adds immutable order headers/lines, actual receipt links, receipt request records and remainder closures. Branch/key/input idempotency protects creation and receiving; row locks serialize receiving against cancellation. Order quantities and financial totals are bounded, and aggregate purchase totals now reject unsafe integer precision in both order and direct receiving.

Selected-branch purchase-read permission covers list/detail/export. Purchase-write permission covers creation and receiving. Cancellation additionally requires inventory-approval permission and password confirmation. Cashiers cannot read or post orders. Clerks can create/receive but cannot cancel. Accountants and auditors retain purchase-read access without write access. Existing CSRF/session controls apply.

Apply ordered migrations before starting the updated API. The retained demo database has migration 010 applied. The frozen Phase 5 Windows archive remains unchanged; these source changes are not a newly packaged or installed release. Do not run an older binary against an upgraded database without checking schema and workflow compatibility.

## Verification and limits

The production build and all 27 automated tests passed. New isolated PostgreSQL coverage verifies nonposting creation, immutable snapshots/history, branch isolation, multiple lots, partial/full receipts, changed replay refusal, concurrent quantity caps, cancellation, replay after closure, direct-key reuse refusal, safe aggregate totals, stock reconciliation and balanced operational journals. The dedicated browser journey passed creation, two-lot partial receipt, supplier debt, internal export, cashier refusal, cancellation and final stock reconciliation. All 17 browser journeys are verified: 16 passed in the full run, and the remaining checkout journey passed on a targeted rerun after making its Pack quantity selector exact to distinguish it from Ordered pack quantity. No application control or assertion was weakened. The purchase-order screen was visually reviewed at a 1366 x 768 viewport; the ephemeral screenshot is test-results/phase-9-orders.png. Local Markdown document links resolve.

The baseline SRS remains intact. This increment addresses the optional purchase-order narrative in section 6; purchase invoice discount/tax metadata, expanded supplier master details, opening balances and other matrix gaps remain open. Physical 80 mm printer/USB scanner checks and off-device recovery acceptance remain deferred by the user. Production approval and operator acceptance remain pending. Phase 10 has not started.

## Handoff

Open Purchases, expand Create internal purchase order, select the supplier and stage the product/unit quantities and estimated pack costs. Create the order, then use Receive against order for each real invoice and its lots. Review outstanding quantities before the next receipt. Use Cancel outstanding quantities only for packs the supplier will not deliver; received invoices remain available for normal settlement and supplier returns.

