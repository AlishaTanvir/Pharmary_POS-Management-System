# Phase 18 - cashier keyboard access and dialog focus

Authorized as the next sequential phase after Phase 17. Source: 0.18.0-dev.1. Verification date: 23 November 2026. Status: software complete; field acceptance and production approval remain pending.

## Keyboard workflow

This phase implements the remaining proposed cashier keymap in SRS section 8.2. In online Point of sale, F2 focuses medicine search, F4 focuses the first cart quantity, F6 focuses Customer account, F8 focuses Discount and F9 opens payment review for a nonempty cart. Discount limits and supervisor requirements remain server-enforced; focusing the field grants no additional permission. F9 does not post an invoice. The operator must explicitly confirm payment.

Shortcuts are inactive while checkout is busy, a recovery decision blocks the basket, another workspace dialog is open, or the user lacks sales access. Modified function keys, held-key repeat and composition events are left alone. Existing barcode Enter handling still adds a single eligible match and returns focus to scanning. The new Keyboard shortcuts button opens a readable guide with the applicable context and Fn-key caveat.

Ctrl+P (or Command+P) within an open saved receipt invokes the same action as Print receipt. Reprinting retains the existing receipt-reprint audit request before browser printing. The handler blocks an additional receipt print request while an operation is busy. Outside that receipt context, browser printing keeps its normal behavior. Physical printing, driver/cutter/drawer behavior and final device key conflicts remain user-deferred acceptance work.

## Dialog focus and navigation

Shared workspace dialogs now have names linked to their visible titles and expose busy state. Opening a form focuses its first usable field; payment review focuses the first amount; receipts focus Print receipt; the shortcut guide focuses Close dialog. Native modal dialogs make the background inert; an explicit Tab/Shift+Tab boundary handler keeps keyboard focus within the usable dialog controls. Payment-to-receipt transitions set a fresh focus target without dismissing the modal.

Escape and Close dialog dismiss an idle dialog through the same controlled state. Escape is prevented during a pending operation, and the form controls are disabled until it finishes. Focus stays on the dialog title while controls are unavailable, then returns to the relevant control. Closing returns focus to the remembered opener or prior editing field. If that element is gone or unavailable, focus falls back to medicine search or the workspace landmark. Scanner search rerenders do not refocus unrelated fields.

A keyboard-visible Skip to main content link bypasses navigation without changing the app's hash route. The active navigation link exposes its current-page state. Shortcut targets expose aria-keyshortcuts. Visible focus styling now includes textarea and summary controls, along with links, buttons, inputs, selects and explicit focus targets.

## Readability and scope of the audit

Cashier product/quantity/customer/discount labels and explanatory text use a darker foreground, and new guide text and controls use readable font sizes. The selected normal-text/status color pairs are checked against a 4.5:1 contrast target; the focus outline is checked against a 3:1 white-background target. These are bounded palette checks, not certification of every rendered state. Receipt content sizing and financial data are retained.

This is a scoped cashier/shared-dialog accessibility increment. A complete screen-reader, touch, zoom/reflow, cross-browser and all-page contrast audit remains open. Browser/OS-reserved keys and hardware Fn layouts still require user testing under the SRS's final-keymap condition. The prepared offline counter has its own workflow and is outside this phase's key bindings.

## Implementation and validation

No database migration or posting-service changes are required. The existing role, session, CSRF, recovery and checkout approval rules remain. The shared receipt action is reused rather than creating another invoice or print endpoint. The application/backup source version is 0.18.0-dev.1; the frozen Phase 5 Windows archive is unchanged.

Build passed. Three targeted automated checks passed for shortcut context/modifier/IME/repeat safety, receipt-only print behavior and the bounded contrast palette. Nine related browser journeys passed across targeted runs after the functional fixes: both new keyboard journeys and seven checkout, saved-cart, recovery and security regressions. Initial runs exposed the customer label association and a modal boundary-focus issue; both were corrected and the affected journeys passed. The final guide-spacing change was verified by build and visual preview. The full 46-test / 28-journey suites were not rerun in this phase. Final layout was reviewed at 1366 x 768 and 1920 x 1080, with the full guide visible at the smaller size after a spacing adjustment. Rendered guide paragraph/header/cell contrasts measured approximately 5.63:1, 5.48:1 and 7.35:1; the scan field showed a 3 px solid focus outline. Artifacts are test-results/phase-18-keyboard-guide.png, phase-18-keyboard-guide-wide.png, phase-18-search-focus.png and phase-18-accessibility.json. Previewing created no financial postings. Documentation links resolve. Approximately 0.54 GiB of workstation space remained during the final review. New browser coverage includes keyboard search/add/quantity/customer/discount/payment, zero posting before confirmation, focus entry and return, modal Tab wrapping, busy Escape protection, one sale/stock deduction, receipt print/reprint and refusal to print after a denied reprint audit, skip navigation, the keyboard guide, cashier permissions and recovery gating.

## Handoff and remaining work

Open Keyboard shortcuts in Point of sale for the implemented guide. If a function key is handled by the keyboard or OS, use the labeled control and record the conflict during operator acceptance. Receipt printing remains available through its visible button as well as the shortcut.

The matrix still tracks full accessibility/device acceptance, purchase invoice discount/tax accounting, opening balances, bank reconciliation, historical category reconstruction, multi-currency and deployment controls as separate work. Physical printer/scanner and off-device recovery remain user-deferred. Operator acceptance and production approval remain pending. Phase 19 has not started.
