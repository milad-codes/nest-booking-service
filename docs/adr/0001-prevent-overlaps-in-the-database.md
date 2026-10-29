# 0001 — Prevent overlapping bookings in the database

**Status:** accepted · 2026-10-28

## Context

Two requests for overlapping periods of the same resource can arrive at the same time. An application-level
check (`SELECT … WHERE overlaps`, then `INSERT`) has a race window: both checks see no conflict and both inserts succeed.
Closing the window in the application needs either a lock per resource (serialises all bookings of a resource,
including non-overlapping ones) or `SERIALIZABLE` transactions with retries.

## Decision

Enforce the invariant in PostgreSQL with an exclusion constraint:

```sql
constraint bookings_no_overlap exclude using gist (
  resource_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
) where (status = 'confirmed')
```

- Periods are half-open (`[)`), so back-to-back bookings (10:00–11:00 and 11:00–12:00) are allowed.
- The partial predicate removes cancelled bookings from the constraint, so cancelling frees the slot.
- `btree_gist` lets one GiST index combine equality on `resource_id` with range overlap. The same index serves the
  availability query.
- The service inserts without a pre-check and maps SQLSTATE `23P01` to `409` with `code: BOOKING_OVERLAP`.

## Consequences

- Correct under any concurrency and for writes that bypass the API (scripts, admin SQL).
- Non-overlapping bookings of the same resource do not block each other.
- The rule lives in a migration, so it must be documented (this ADR) and covered by tests: an e2e test fires
  10 concurrent requests for one slot and expects exactly one `201`.
- Requires the `btree_gist` extension. It ships with PostgreSQL as a contrib module; check that your managed provider allows it before deploying.
