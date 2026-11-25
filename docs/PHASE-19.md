# Phase 19 - API access inventory and security regression review

Authorized as the next sequential phase after Phase 18. Source: 0.19.0-dev.1. Verification date: 23 November 2026. Status: software complete; field acceptance and production approval remain pending.

## Scope

This phase addresses the outstanding sensitive-endpoint inventory and access regression gap. It adds a generated inventory of declared Express HTTP routes, a build check against source drift, isolated HTTP denial tests and an organization-administrator review/export in Administration. It does not certify every business authorization path or the security of a deployed workstation.

The user also requested a remaining-phase count. [The proposed roadmap](REMAINING-ROADMAP.md) groups tracked work into eight packages, phases 19-26 including this phase; seven remain if this phase completes. The original SRS defines phases 0-4, so this is a new planning estimate rather than a previously fixed total.

## Inventory and build controls

The scanner in scripts/api-access.ts uses the installed TypeScript parser to inspect server route registrations and actual router mounts. It records method/path, authentication boundary, declared permissions, allowed branch roles, organization-administrator requirements, explicit confirmation middleware, source location and conditional routes. The source fingerprint includes the route-bearing files, scanner, role map, local boundary helper and resulting inventory. The confirmation_middleware flag records an explicit confirm middleware only; inline password checks remain in their route/service controls. The generated module is used by the running application and is bundled with the release; it contains route metadata, not credentials or runtime records.

The scanner rejects duplicate exact method/path registrations, dynamic route definitions, unmapped router mounts, unreviewed middleware, middleware placed after a handler, central mounts before session authentication and central endpoints without a declared permission or reviewed self-service boundary. Inherited administrator gates for users, backups and pilot routes are included. Self-service authentication/branch routes and customer-selection role rules are explicitly classified. Local status/PIN entry, protected local sessions, device-secret sync, minimal health/login and the optional private control route have distinct boundaries.

The build now runs npm run check:access before TypeScript/Vite. After reviewing intended route changes, run npm run access:generate and inspect the generated diff. A newly generated inventory is not, by itself, proof that the runtime implementation enforces it; the HTTP matrix supplies independent denial evidence. The existing CI build invokes the check automatically; hosted CI execution is still separate evidence.

An unreachable duplicate GET /api/reports/daily registration was removed from index.ts. The earlier production router remains the active implementation with the existing daily-net-sales/returns behavior.

## Runtime hardening and administrator workflow

Local counter Host/Origin validation now rejects malformed authorities and origins, non-loopback hosts, protocol/authority mismatches and missing local write headers with a controlled 403. Valid normalized loopback requests remain supported. This avoids URL-parser exceptions turning invalid requests into 500 responses. Device sync rejects a missing/malformed bearer secret before validating the event payload; device authentication and replay validation remain in the existing sync service.

In Administration, organization administrators can expand API access review, filter by path/method/permission or authentication boundary, page through 25 endpoints at a time and download the review JSON. Both review endpoints require organization-administrator status. Export requires the normal session CSRF token and records API_ACCESS_INVENTORY_EXPORTED with route count and source fingerprint. The report does not claim that running tests or deployment controls have been approved. The UI does not execute tests or expose credentials.

No schema migration or financial posting changes are required. The frozen Phase 5 archive remains unchanged.

## Verification

The source-inventory/TypeScript/Vite build passed on 23 November 2026. All three targeted automated tests passed: inventory drift/mutation and line-ending stability, local-boundary validation, and the isolated HTTP matrix. The manifest contains 146 declared routes, including 133 session routes. The matrix verified 133 anonymous session-route denials (plus implicit HEAD on GET), 76 central write-CSRF checks and 486 denied-role checks. Evidence tied to the current source fingerprint is retained at .local/phase19-api-access-evidence.json. Six browser journeys passed across the full run and the corrected review-screen rerun: administrator review/export and private-access denial, both checkout/catalog regressions, real offline outage/reload/reconnect, idle locking, and the security-header/input/approval regression. The filter label association was corrected before its passing rerun. The full 49-test / 29-journey suites were not rerun in this phase. The final administrator screen was visually reviewed at 1366 x 900; test-results/phase-19-access-review.png captures the filtered private endpoints. The preview created no financial postings. Documentation links resolve. Final UI readability styling is verified by build and visual preview. The matrix uses its own retained PostgreSQL cluster and isolated SQLite path, with synthetic sessions for all seven branch roles and an organization administrator. It checks anonymous requests (including implicit HEAD for GET routes), missing CSRF on declared central writes and every denied role derived from the reviewed inventory. Additional checks cover local-session denial, malformed local headers/origin, missing device credentials, private inventory/export access and zero sales, purchases, movements, journals or balance entries created by the matrix.

These checks exercise authentication, CSRF and declared role boundaries. They do not exhaust all allowed-role object ownership, supervisor-password, concurrency, attachment, query, deployment or attack scenarios. Existing branch/object, financial and offline tests remain relevant. The browser smoke check confirmed 403 for a private control request without its token. Valid-token shutdown was not exercised; the isolated test app intentionally does not register that conditional route. Public login/PIN authentication retains existing dedicated tests.

## Handoff and remaining work

Use API access review and its export during staff/access and release reviews. Review source inventory changes alongside code, then rerun the targeted matrix when route guards change. A passing generated inventory cannot replace penetration testing or host/deployment review.

Full deployment security, all allowed-role object access paths, external CI/runtime coverage, broader accessibility and physical/operator recovery acceptance remain open. The existing user-deferred hardware/off-device checks remain visible. Phase 20 has not started. See the roadmap for the proposed seven packages after this phase.
