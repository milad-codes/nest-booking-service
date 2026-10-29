import { randomUUID } from 'node:crypto';
import { Cursor } from '@mikro-orm/core';
import { isBookingCursor } from '../../src/bookings/booking-cursor.js';

describe('isBookingCursor', () => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

  it('accepts the cursors MikroORM produces for (startsAt, id)', () => {
    expect(isBookingCursor(Cursor.encode([new Date('2030-01-07T09:00:00Z'), randomUUID()]))).toBe(true);
  });

  it.each([
    ['garbage', 'not-a-cursor'],
    ['an object', encode({ startsAt: '2030-01-07T09:00:00Z' })],
    ['one value', encode(['2030-01-07T09:00:00Z'])],
    ['an invalid date', encode(['yesterday', randomUUID()])],
    ['an invalid id', encode(['2030-01-07T09:00:00Z', '1 OR 1=1'])],
    ['extra values', encode(['2030-01-07T09:00:00Z', randomUUID(), 'x'])],
  ])('rejects %s', (_label, cursor) => {
    expect(isBookingCursor(cursor)).toBe(false);
  });
});
