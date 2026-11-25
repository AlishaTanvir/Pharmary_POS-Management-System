# Phase 1 — MVP implementation

> Historical phase snapshot. Later-phase status and unresolved baseline requirements are maintained in [REQUIREMENTS-MATRIX.md](REQUIREMENTS-MATRIX.md) and [PHASE-5.md](PHASE-5.md). Statements about future phases below describe the situation when this report was written.
The user authorized Phase 1 after reviewing Phase 0. Hardware inventory, legal/tax validation and real sample catalog remain deployment decisions. They do not imply approval of unverified operational settings.

Implemented: React/TypeScript browser client; Node/Express/TypeScript API; PostgreSQL migration; branch-scoped authenticated sessions; bcrypt password hashes; CSRF checks; role permissions; owner user creation/password reset; pharmacy profile with re-authentication; catalog creation and per-product pack units/prices; suppliers; multi-line batch receiving with stock movements and supplier payable; FEFO; expiry/status/restricted-product blocking; server quote; discounts by role; cash/card/wallet/split tender; unique invoices; transactional stock/sale/payment posting; idempotency conflict detection; receipt/reprint; searchable own-sales restriction for cashier; daily reporting and stock/expiry visibility. Financial history has database triggers prohibiting update/delete.

Amounts use integer paisa with validated bounds and explicit half-up tax rounding. Database amounts are bigint. Quantities normalize to integer base units. Pack cost must divide exactly into whole-paisa base cost; the UI/API rejects incompatible pack costs rather than silently rounding valuation.

The dev seed contains fictional medicines and a supplier, but no stock or sales. Receiving establishes the complete movement trail. Profile/tax confirmation is mandatory before checkout. Restricted products require owner/pharmacist checkout, rather than an unimplemented clinical approval bypass.

## Acceptance evidence and limits

- Automated domain tests: conversion, multi-batch FEFO, expired/blocked stock, monetary rounding, discount bounds, mixed tender, role grants.
- Real PostgreSQL test: atomic receipt/stock/payable, receipt retry, concurrent identical sale retry, last-stock race, invalid receipt rollback, forced failure before commit, append-only history, branch boundary, unauthorized discount, movement/stock reconciliation.
- Browser E2E: login, profile configuration, box receiving, strip sale, cash/change receipt, resulting stock, daily report and backend cashier denial.
- Production build performs strict TypeScript checking.
- Physical scanner/printer validation, ESC/POS cutting/drawer integration and Windows Tauri installer remain outstanding. Browser Print/PDF supports 58/80 mm layout; compatibility must be checked on real devices.
- No real external card payment is initiated. Card/wallet tender records approved external terminal collections.
- Do not treat MVP as production sign-off. Restore, security review, hardware/UAT and realistic load tests remain required.

## Remaining Phase 1 work before exit approval

Catalog editing/price maintenance and backend soft-deactivation are implemented; complete configurable price/discount policies, richer multi-field date filters, invoice branding/logo, hardware adapter/Windows packaging and final hardware/UAT evidence remain before declaring every SRS requirement satisfied. Restricted-product checkout is blocked for unauthorized roles; a delegated pharmacist sign-off workflow remains to be designed with the responsible pharmacist. Validated CSV catalog import with preview and row errors is implemented, as are audited CSV daily exports and Print/PDF reports. Session renewal and owner password resets exist; employee and medicine soft-deactivation screens are implemented; roles use fixed deny-by-default grants rather than a custom role-permission editor.

Phase 2 returns, closing, ledger-management screens, advanced audit review, automated alerts and backup/restore are unstarted. The Phase 1 movement/payable/audit foundations do not count as those complete modules. Phase 3 offline and Phase 4 expansion remain unstarted.

## Verified on 17 November 2026

- Production TypeScript/Vite build: passed.
- Domain, CSV and real PostgreSQL tests: 9 passed, 0 failed.
- Playwright end-to-end receiving ? barcode search ? two-strip sale ? receipt/change ? 20-tablet stock deduction ? reports ? cashier API denial: passed.
- Dependency audit after patched validation-library upgrade: 0 reported vulnerabilities.
- Browser testing found and fixed purchase-data loading and short-viewport sidebar access issues.
- Windows local PostgreSQL shutdown now uses pg_ctl fast shutdown to avoid leaving orphan workers.
- Local demo contains clearly fictional test transactions from browser verification. No production pharmacy data was imported.

Phase 1 has a working online core; it is not signed off as a complete production release. Remaining requirements above are not silently treated as passed.

Hardware preference confirmed by user: 80 mm thermal printer and USB barcode scanner. Receipt width defaults to 80 mm; USB HID/keyboard scanning is the supported browser path. Specific printer model/cutter/drawer compatibility and physical acceptance remain unverified.

Final browser checks: 2 passed, 0 failed. The second journey verifies CSV preview/import, catalog price changes, medicine soft-deactivation, audited CSV download, re-authenticated user creation and employee deactivation. Final production build passed after these changes.


Later change: migration 022 and the matching application supersede the original pack-cost divisibility restriction for new receipts. Four-decimal PKR pack prices, fractional base-unit cost ratios and per-line tax are documented in PURCHASE-COSTING.md; earlier verification here remains historical.
