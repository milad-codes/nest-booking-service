import { defineEntity, p } from '@mikro-orm/postgresql';
import { Resource } from '../resources/resource.entity.js';
import { User } from '../users/user.entity.js';

export const BOOKING_STATUSES = ['confirmed', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/**
 * A booking covers the half-open period [startsAt, endsAt). Overlaps between confirmed bookings of the
 * same resource are rejected by the database itself (exclusion constraint), not by application checks.
 */
const BookingSchema = defineEntity({
  name: 'Booking',
  tableName: 'bookings',
  properties: {
    id: p.uuid().primary(),
    resource: () => p.manyToOne(Resource),
    user: () => p.manyToOne(User).deleteRule('cascade'),
    startsAt: p.datetime(),
    endsAt: p.datetime(),
    status: p.enum(BOOKING_STATUSES).default('confirmed'),
    note: p.text().nullable(),
    createdAt: p.datetime().onCreate(() => new Date()),
    cancelledAt: p.datetime().nullable(),
    version: p.integer().version(),
  },
});

export class Booking extends BookingSchema.class {}
BookingSchema.setClass(Booking);
