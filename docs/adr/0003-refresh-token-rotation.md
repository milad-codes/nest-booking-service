# 0003 — Refresh token rotation with reuse detection

**Status:** accepted · 2026-10-28

## Context

Short-lived access tokens (15 min) need a long-lived credential to renew them. A stolen long-lived refresh token is the
main session-hijacking risk.

## Decision

- Refresh tokens are opaque 256-bit random values; only their SHA-256 hash is stored.
- Every refresh is a rotation: the presented token is revoked, a new one is issued in the same _family_.
- Presenting a token that was already rotated or revoked is treated as theft: every token of the family is revoked,
  and that revocation is committed before the `401` is returned.
- The token row is read with `SELECT … FOR UPDATE`, so two concurrent refreshes with the same token cannot both succeed.
- Logout revokes the family and is idempotent.

## Consequences

- An attacker and the legitimate client cannot both keep using a session: the first reuse ends it for both.
- Clients must store the newest refresh token after every refresh; a client that loses a response must log in again.
- Login timing does not reveal whether an email exists (unknown emails are verified against a dummy Argon2 hash).
