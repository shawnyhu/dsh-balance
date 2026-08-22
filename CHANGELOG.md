# Changelog

All notable changes to this project are documented in this file.

## [0.1.0] - 2026-08-22

### Added

- dsh-balance plugin: a 42px row at the bottom of the DSH sidebar showing the DeepSeek API account balance (click to refresh, double-click to open the usage page, auto-refresh after each finished turn and every 30 minutes).
- Loopback-only, same-origin `GET /dsh-balance` route on the host half; the API key never reaches the browser.
- Bilingual (zh / en) client localization and a live re-render on locale switch.
- Tests: an offline, assertion-based guard suite (`tests/balance-guard.mjs`) and a real-API smoke suite (`tests/balance-smoke.mjs`).
- `README.md`, `LICENSE`, `CHANGELOG.md`, `.github/workflows/ci.yml` (syntax check + offline guard tests on Node 20/22), and `.github/ISSUE_TEMPLATE/bug_report.yml`.

### Changed

- README install section rewritten: `dsh plugin --profile web add <path>` is now the primary, cross-platform method with the manual/Desktop example corrected (removed a non-existent `dshmarket` bundle; the web profile template ships only `@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-web-app`).
- README: added dedicated "Configuration" and "Development" sections.
- `package.json`: added `check`, `test`, `test:guard`, and `test:smoke` scripts.

### Fixed

- `client/client.js`: guard the last-known-data ref write behind the cancellation flag so a late, stale response cannot overwrite the freshest balance.

### Security

- Request guard rejects non-loopback peers, forwarded headers, and cross-origin `Origin`; provider error text is redacted before being returned.
