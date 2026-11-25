# ADR 001: Local Node service and browser distribution

Date: 18 November 2026. Status: implemented release-candidate approach; native desktop shell remains optional future work.

The existing application uses React, Express, PostgreSQL and a counter-local SQLite journal. The installed Windows workflow retains those tested transaction and replay paths rather than introducing a new process/runtime boundary during financial hardening.

The distribution compiles server entry points, ships static assets and production JavaScript dependencies, and supplies PowerShell install/start/stop scripts. Node.js 24+ and PostgreSQL 18 are explicit, separately installed prerequisites. Program files and protected private data are separate, supporting side-by-side program installation without copying secrets or demo data into the release.

Consequences: the UI opens in a browser and printing uses the browser's print system. The installer is unsigned; prerequisite runtime compatibility, physical printing, unattended startup, TLS/hosting and operator rollout remain acceptance tasks. There is no claim of an existing Tauri wrapper, native printer-driver integration, automatic cutting, cash drawer integration or signed executable.

A future desktop shell must preserve database authority, idempotent checkout, counter-local journal/key identity and controlled stock reservations. It needs its own Windows/runtime/printer/crash/upgrade tests before replacing this supported local topology.
