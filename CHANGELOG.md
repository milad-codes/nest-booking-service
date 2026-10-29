# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- Concurrent cancellations of one booking returned 500; they now return 200 (idempotent) or 412 with `If-Match` (#9)
- Malformed or forged page cursors returned 500; they now return 400 (#9)
- `If-Match: *` is accepted as "any current version" (#9)

## [0.1.0] — 2026-10-29

### Added

- Registration, login, refresh-token rotation with reuse detection, logout (#5)
- Resources, conflict-free bookings enforced by a PostgreSQL exclusion constraint, idempotency keys,
  keyset pagination, ETag/If-Match on cancel, availability (#6)
- Structured logging with request ids, Prometheus metrics, readiness probe (#7)
- OpenAPI document and Swagger UI, container image, docker compose setup, architecture decision records

[0.1.0]: https://github.com/milad-codes/nest-booking-service/releases/tag/v0.1.0
