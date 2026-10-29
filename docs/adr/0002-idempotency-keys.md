# 0002 — Idempotency keys for creating bookings

**Status:** accepted · 2026-10-28

## Context

Mobile clients retry when a response is lost. Without protection a retry creates a second booking (or, with the
overlap constraint, a confusing `409` for the user's own booking).

## Decision

Support the `Idempotency-Key` header on `POST /bookings`, scoped per user:

1. Reserve the key with an `INSERT` into `idempotency_keys` (unique `(user_id, key)`). The unique constraint is the
   lock: of two concurrent requests with the same key, one inserts and the other sees the existing row.
2. Store a SHA-256 hash of method, route template and the request body (keys sorted), so a reused key with a
   different body is detected (`422`).
3. On success store status code and body; later requests with the same key and body get the stored response with
   `Idempotent-Replayed: true`. While the first request is still running, a duplicate gets `409`.
4. On failure delete the reservation, so the client can correct the request and retry with the same key.
5. Records expire after 24 hours.

The store uses a forked `EntityManager`, so a failed reservation never leaves state in the request's unit of work.

## Consequences

- Retries are safe without client-side deduplication.
- Only successful responses are replayed; errors are re-evaluated on retry (deliberate: a `409` may disappear after a cancellation).
- Expired rows are purged lazily on reuse; a periodic purge job is still to do.
