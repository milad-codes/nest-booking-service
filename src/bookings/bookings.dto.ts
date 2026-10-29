import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import type { BookingStatus } from './booking.entity.js';

export class CreateBookingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  resourceId: string;

  @ApiProperty({ example: '2030-01-07T09:00:00Z', description: 'Inclusive start (ISO 8601 with offset)' })
  @IsISO8601({ strict: true })
  startsAt: string;

  @ApiProperty({ example: '2030-01-07T10:00:00Z', description: 'Exclusive end' })
  @IsISO8601({ strict: true })
  endsAt: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListBookingsQuery {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ description: 'Opaque cursor from a previous page (nextCursor)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  cursor?: string;

  @ApiPropertyOptional({ enum: ['mine', 'all'], default: 'mine', description: '"all" is for admins' })
  @IsOptional()
  @IsIn(['mine', 'all'])
  scope: 'mine' | 'all' = 'mine';
}

export class BookingDto {
  @ApiProperty() id: string;
  @ApiProperty() resourceId: string;
  @ApiProperty() userId: string;
  @ApiProperty() startsAt: Date;
  @ApiProperty() endsAt: Date;
  @ApiProperty({ enum: ['confirmed', 'cancelled'] }) status: BookingStatus;
  @ApiPropertyOptional({ nullable: true }) note: string | null;
  @ApiProperty() createdAt: Date;
  @ApiPropertyOptional({ nullable: true }) cancelledAt: Date | null;
  @ApiProperty({ description: 'Optimistic-concurrency version, also sent as ETag' }) version: number;
}

export class BookingPageDto {
  @ApiProperty({ type: [BookingDto] }) items: BookingDto[];
  @ApiPropertyOptional({ nullable: true }) nextCursor: string | null;
}
