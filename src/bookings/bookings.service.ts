import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DriverException, EntityManager, OptimisticLockError } from '@mikro-orm/postgresql';
import type { AuthUser } from '../auth/auth.decorators.js';
import { newId } from '../common/ids.js';
import { Resource } from '../resources/resource.entity.js';
import { Metrics } from '../observability/metrics.service.js';
import { User } from '../users/user.entity.js';
import { isBookingCursor } from './booking-cursor.js';
import { Booking } from './booking.entity.js';
import { periodViolations } from './booking-period.js';
import type { BookingDto, BookingPageDto, CreateBookingDto, ListBookingsQuery } from './bookings.dto.js';

const EXCLUSION_VIOLATION = '23P01';

export const toBookingDto = (b: Booking): BookingDto => ({
  id: b.id,
  resourceId: b.resource.id,
  userId: b.user.id,
  startsAt: b.startsAt,
  endsAt: b.endsAt,
  status: b.status,
  note: b.note ?? null,
  createdAt: b.createdAt,
  cancelledAt: b.cancelledAt ?? null,
  version: b.version,
});

const versionChanged = (actual: number, expected: number) =>
  new PreconditionFailedException(`Booking has version ${actual}, not ${expected}`);

export class BookingConflictError extends ConflictException {
  constructor() {
    super({
      message: 'The requested period overlaps an existing booking for this resource',
      code: 'BOOKING_OVERLAP',
    });
  }
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly em: EntityManager,
    private readonly metrics: Metrics,
  ) {}

  /**
   * No "check then insert": the INSERT itself is the check. The exclusion constraint makes PostgreSQL
   * serialize overlapping inserts, so concurrent requests for the same slot yield exactly one booking.
   */
  async create(current: AuthUser, dto: CreateBookingDto, now = new Date()): Promise<BookingDto> {
    const period = { startsAt: new Date(dto.startsAt), endsAt: new Date(dto.endsAt) };
    const violations = periodViolations(period, now);
    if (violations.length) throw new UnprocessableEntityException(violations);

    const resource = await this.em.findOne(Resource, { id: dto.resourceId, active: true });
    if (!resource) throw new NotFoundException('Resource not found or inactive');

    const booking = this.em.create(Booking, {
      id: newId(),
      resource,
      user: this.em.getReference(User, current.id),
      ...period,
      note: dto.note ?? null,
    });
    try {
      await this.em.flush();
    } catch (error) {
      if (
        error instanceof DriverException &&
        (error as DriverException & { code?: string }).code === EXCLUSION_VIOLATION
      ) {
        this.metrics.bookingConflicts.inc();
        throw new BookingConflictError();
      }
      throw error;
    }
    this.metrics.bookingsCreated.inc();
    return toBookingDto(booking);
  }

  async list(current: AuthUser, query: ListBookingsQuery): Promise<BookingPageDto> {
    if (query.cursor !== undefined && !isBookingCursor(query.cursor)) {
      throw new BadRequestException('cursor is not valid; pass nextCursor from a previous page unchanged');
    }
    const everyone = query.scope === 'all' && current.role === 'admin';
    const page = await this.em.findByCursor(Booking, {
      where: everyone ? {} : { user: current.id },
      orderBy: { startsAt: 'asc', id: 'asc' },
      first: query.limit,
      after: query.cursor,
      includeCount: false,
    });
    return {
      items: page.items.map(toBookingDto),
      nextCursor: page.hasNextPage ? (page.endCursor ?? null) : null,
    };
  }

  async get(current: AuthUser, id: string): Promise<BookingDto> {
    return toBookingDto(await this.findVisible(current, id));
  }

  /**
   * Cancels a booking (frees the slot). Cancelling twice is not an error. An optional If-Match version guards
   * against lost updates: when two requests race, the database version check decides and the loser gets 412.
   */
  async cancel(current: AuthUser, id: string, expectedVersion?: number): Promise<BookingDto> {
    const booking = await this.findVisible(current, id);
    if (expectedVersion !== undefined && booking.version !== expectedVersion) {
      throw versionChanged(booking.version, expectedVersion);
    }
    if (booking.status === 'cancelled') return toBookingDto(booking);
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    try {
      await this.em.flush();
    } catch (error) {
      if (!(error instanceof OptimisticLockError)) throw error;
      // Another request changed the booking between our read and our write: answer from the current row.
      this.em.clear();
      const latest = await this.findVisible(current, id);
      if (expectedVersion !== undefined) throw versionChanged(latest.version, expectedVersion);
      if (latest.status === 'cancelled') return toBookingDto(latest);
      throw new ConflictException('The booking changed while it was being cancelled; retry the request');
    }
    return toBookingDto(booking);
  }

  /** Owners and admins see a booking; everyone else gets 404 so ids don't leak. */
  private async findVisible(current: AuthUser, id: string): Promise<Booking> {
    const booking = await this.em.findOne(
      Booking,
      current.role === 'admin' ? { id } : { id, user: current.id },
    );
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }
}
