# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Changed

- README: rewrite the install section to lead with the official `dsh plugin --profile web add <path>` method and correct the manual/Desktop example (removed a non-existent `dshmarket` bundle; the web profile template ships only `@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-web-app`).
- README: add a dedicated "Configuration" section and a "Development" section with the runnable scripts.
- `package.json`: add `check`, `test`, `test:guard`, and `test:smoke` scripts.
- `tests/balance-guard.mjs`: turn the guard test into an offline, assertion-based suite by stubbing `fetch`, so it runs without a real API key or network.
- `client/client.js`: guard the last-known-data ref write behind the cancellation flag to avoid a late, stale response overwriting the freshest balance.

### Added

- `CHANGELOG.md` (this file).
- `.github/workflows/ci.yml`: run syntax checks and the offline guard test on Node 20.
- `.github/ISSUE_TEMPLATE/bug_report.yml`: minimal issue template.

## [0.1.0]

Initial release.
