import { isUUID } from 'class-validator';

/**
 * Page cursors are opaque to clients, but MikroORM builds them from the sort key (startsAt, id) as base64url JSON.
 * Checking the shape up front turns a tampered or truncated cursor into a 400 instead of a database error.
 */
export function isBookingCursor(cursor: string): boolean {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return false;
  }
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'string' &&
    !Number.isNaN(Date.parse(value[0])) &&
    typeof value[1] === 'string' &&
    isUUID(value[1])
  );
}
