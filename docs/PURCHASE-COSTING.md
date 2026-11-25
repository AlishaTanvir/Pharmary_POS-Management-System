# Fractional purchase costs and per-line tax

Added at the user's request on 25 November 2026 as the remaining Phase 24 purchase-costing work. Migration `022_fractional_purchase_costs.sql` is required with the matching application. Currency remains PKR, and checkout keeps mandatory automatic FEFO.

## Receiving goods

Both direct receipts and purchase-order receipts accept selected-pack costs with up to four decimal places in PKR, for example `1.0050`. Orders retain the same precision in their estimate and compare the exact actual price when requiring a variance reason. Quantities remain whole selected packs and normalize to whole base units.

Choose **Invoice-level tax** for the existing proportional invoice policy, or **Per-line tax and treatment** to enter each lot's discount and tax separately. For each line, choose included in inventory, separate input tax, or exempt/no tax. Taxable lines accept a whole-paisa amount or a percentage with two decimal places, up to 100%. Exempt lines carry zero tax. These are operator-entered classifications; the app does not determine legal tax eligibility or supply tax rates.

Calculation order:

1. Multiply the exact pack price by pack quantity, then round the extended gross line amount half-up to paisa.
2. Subtract each line discount. Allocate any additional invoice discount proportionally over those discounted line amounts, using cumulative half-up rounding so allocated portions sum exactly.
3. In per-line mode, calculate percentage tax on each line after both discounts and round half-up to paisa, or retain its entered tax amount. In invoice mode, allocate invoice tax proportionally over net lines. The two modes cannot be combined in one receipt.
4. Add capitalized tax to inventory; record recoverable tax separately. Supplier payable equals inventory plus separate input tax. Mixed treatment is retained on the invoice and its lines.

Posted invoice detail shows the four-decimal pack price, line tax classification/rate, and exact receipt cost basis as a ratio of paisa to base units. Total discounts include both line and invoice discounts. Posted monetary components are immutable; credits and payments remain separate transactions.

## Inventory valuation

Payments, invoice extensions, supplier balances and journals remain integer paisa. Fractional base-unit costs are represented by an exact receipt value/quantity ratio and a remaining lot book value, rather than rounded to one integer unit price. For example, a 100-paisa lot of three units has a `100/3` paisa receipt basis.

Each stock consumption takes a half-up rounded proportion of the available residual book value. The final units take the entire remaining value. Some individual unit allocations can be zero paisa; subsequent units absorb the remainder. Allocation order can change which movement receives a rounding paisa, while the sum always equals the original lot value. Reports sum immutable movement values rather than multiplying a rounded unit reference by quantity. The displayed receipt basis is the original ratio, not a promise that every later unit receives the same rounded cost.

Offline reservations receive their own proportion of quantity and value. Online sales and transfers consume only the unreserved portion. Central synchronization consumes the reservation's remaining value; device snapshots contain no supplier costs. Finishing a session releases unused reservations without changing physical stock or lot value. Existing offline event formats remain compatible.

Customer returns reverse cumulative portions of the original sale allocation cost into quarantine. Supplier credits remove the returned quantity's share of the currently free lot book value, and cumulatively reverse recoverable tax from the original receipt line; they cannot consume reserved stock. This is the supported book-value credit policy, not a separate negotiation/price-variance workflow. Transfers preserve the dispatched exact value at the destination. Count reductions/writeoffs remove proportional remaining value; count increases use the current lot ratio, or the original basis when replenishing an empty lot. These values feed operational journals and profit reports.

## API and historical compatibility

Existing clients can still send integer `unit_cost_paisa`. Alternatively send `unit_cost_pkr` as a decimal string with up to four decimal places; do not send both. Per-line mode uses root `tax_mode: "PER_LINE"`, optional root `discount_paisa`, and line `discount_paisa`, `tax_treatment`, and either `tax_paisa` or `tax_bps` (100 basis points = 1%). Invoice-level tax/treatment cannot accompany per-line mode. Exempt lines may omit the zero tax amount. Cashiers cannot read purchase detail or quote cost metadata.

Migration 022 adds nullable snapshots and value fields. It does not backfill or revalue historical purchases, allocations or journals. Old batches continue using their recorded integer unit cost; old retries retain their intent hashes. New receipts retain valuation version `RESIDUAL_V1`. Existing legacy reports use recorded movement cost snapshots, with the established receipt-cost fallback where those snapshots were absent. No historical tax classification is invented.

Take and retain an encrypted backup before upgrading. The matching app requires the new schema; older guarded release candidates refuse this newer schema. Restore verification additionally checks modern lot values against signed movement values, reservation coverage and sale allocation totals. It restores to a separate database and never overwrites live transactions. This feature does not complete external deployment or physical field acceptance.
