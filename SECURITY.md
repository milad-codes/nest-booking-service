# Security

## Reporting a problem

Please report suspected vulnerabilities privately through GitHub: **Security → Report a vulnerability** in this
repository. Don't open a public issue for them. This is a personal project, so there is no guaranteed response time,
but I read every report.

## Before you deploy it

- **Secrets:** generate `JWT_ACCESS_SECRET` randomly (for example `openssl rand -base64 48`) and keep it out of the
  repository. Changing it invalidates outstanding access tokens; clients recover by refreshing.
- **First admin:** the account registered with `BOOTSTRAP_ADMIN_EMAIL` becomes an admin. Register that address
  yourself before the service is reachable, or leave the variable unset.
- **TLS:** the service speaks plain HTTP. Put it behind a reverse proxy or load balancer that terminates TLS.
- **Metrics:** set `METRICS_TOKEN` or keep `/metrics` on a private network.
- **Rate limiting:** the built-in limit is per process. Apply a shared limit at the proxy if you run several
  instances.

## What the service stores and logs

- Passwords as Argon2id hashes and refresh tokens as SHA-256 hashes. Plain tokens are never stored.
- Idempotency records, including the response body of the booking they belong to, for 24 hours.
- Request logs as JSON. Authorization headers, cookies, passwords and refresh tokens are redacted.

## Scope

This repository is a portfolio project that I maintain myself. It has not had an external security review.
