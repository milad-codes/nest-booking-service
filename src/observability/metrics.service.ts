import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

/** Owns a private registry (not prom-client's global one), so several app instances never collide. */
@Injectable()
export class Metrics {
  readonly registry = new Registry();

  readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration by method, route template and status code',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  readonly bookingsCreated = new Counter({
    name: 'bookings_created_total',
    help: 'Bookings created',
    registers: [this.registry],
  });

  readonly bookingConflicts = new Counter({
    name: 'booking_conflicts_total',
    help: 'Booking requests rejected because the period overlaps an existing booking',
    registers: [this.registry],
  });

  readonly idempotentReplays = new Counter({
    name: 'idempotent_replays_total',
    help: 'Requests answered from a stored Idempotency-Key response',
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }
}
