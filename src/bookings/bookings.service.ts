import {
  ConflictException,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DriverException, EntityManager } from '@mikro-orm/postgresql';
import type { AuthUser } from '../auth/auth.decorators.js';
import { newId } from '../common/ids.js';
import { Resource } from '../resources/resource.entity.js';
import { User } from '../users/user.entity.js';
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
  constructor(private readonly em: EntityManager) {}

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
        throw new BookingConflictError();
      }
      throw error;
    }
    return toBookingDto(booking);
  }

  async list(current: AuthUser, query: ListBookingsQuery): Promise<BookingPageDto> {
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

  /** Cancels a booking (frees the slot). Optional If-Match version guards against lost updates. */
  async cancel(current: AuthUser, id: string, expectedVersion?: number): Promise<BookingDto> {
    const booking = await this.findVisible(current, id);
    if (expectedVersion !== undefined && booking.version !== expectedVersion) {
      throw new PreconditionFailedException(`Booking has version ${booking.version}, not ${expectedVersion}`);
    }
    if (booking.status === 'cancelled') return toBookingDto(booking);
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    await this.em.flush();
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
