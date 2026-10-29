import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Booking } from '../bookings/booking.entity.js';
import { newId } from '../common/ids.js';
import { Resource } from './resource.entity.js';
import type { BusyIntervalDto, CreateResourceDto, ResourceDto, UpdateResourceDto } from './resources.dto.js';

const MAX_AVAILABILITY_RANGE_DAYS = 31;

export const toResourceDto = (r: Resource): ResourceDto => ({
  id: r.id,
  name: r.name,
  description: r.description ?? null,
  active: r.active,
  createdAt: r.createdAt,
});

@Injectable()
export class ResourcesService {
  constructor(private readonly em: EntityManager) {}

  async list(includeInactive: boolean): Promise<ResourceDto[]> {
    const resources = await this.em.find(Resource, includeInactive ? {} : { active: true }, {
      orderBy: { name: 'asc' },
    });
    return resources.map(toResourceDto);
  }

  async create(dto: CreateResourceDto): Promise<ResourceDto> {
    const resource = this.em.create(Resource, {
      id: newId(),
      name: dto.name,
      description: dto.description ?? null,
    });
    await this.em.flush();
    return toResourceDto(resource);
  }

  async update(id: string, dto: UpdateResourceDto): Promise<ResourceDto> {
    const resource = await this.em.findOne(Resource, id);
    if (!resource) throw new NotFoundException('Resource not found');
    // only fields present in the request; class-validator DTOs carry undefined for omitted optionals
    const patch = Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined));
    this.em.assign(resource, patch);
    await this.em.flush();
    return toResourceDto(resource);
  }

  /** Busy intervals of confirmed bookings overlapping [from, to); served by the exclusion constraint's GiST index. */
  async availability(id: string, from: Date, to: Date): Promise<BusyIntervalDto[]> {
    if (to <= from) throw new BadRequestException('to must be after from');
    if (to.getTime() - from.getTime() > MAX_AVAILABILITY_RANGE_DAYS * 86_400_000) {
      throw new BadRequestException(`range is limited to ${MAX_AVAILABILITY_RANGE_DAYS} days`);
    }
    if (!(await this.em.count(Resource, { id }))) throw new NotFoundException('Resource not found');
    const bookings = await this.em.find(
      Booking,
      { resource: id, status: 'confirmed', startsAt: { $lt: to }, endsAt: { $gt: from } },
      { orderBy: { startsAt: 'asc' }, fields: ['startsAt', 'endsAt'] },
    );
    return bookings.map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt }));
  }
}
