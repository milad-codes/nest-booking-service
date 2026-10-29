import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { type AuthUser, CurrentUser } from '../auth/auth.decorators.js';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor.js';
import { BookingDto, BookingPageDto, CreateBookingDto, ListBookingsQuery } from './bookings.dto.js';
import { BookingsService } from './bookings.service.js';

const etag = (b: BookingDto): string => `"${b.version}"`;

function parseIfMatch(header: string | undefined): number | undefined {
  if (header === undefined) return undefined;
  const match = /^(?:W\/)?"?(\d+)"?$/.exec(header.trim());
  if (!match?.[1]) throw new BadRequestException('If-Match must be a version ETag such as "3"');
  return Number(match[1]);
}

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Retries with the same key replay the first response',
  })
  @ApiCreatedResponse({ type: BookingDto })
  @ApiConflictResponse({ description: 'Overlaps an existing booking (problem+json, code BOOKING_OVERLAP)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto): Promise<BookingDto> {
    return this.bookings.create(user, dto);
  }

  @Get()
  @ApiOkResponse({ type: BookingPageDto })
  list(@CurrentUser() user: AuthUser, @Query() query: ListBookingsQuery): Promise<BookingPageDto> {
    return this.bookings.list(user, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: BookingDto })
  async get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<BookingDto> {
    const booking = await this.bookings.get(user, id);
    res.setHeader('ETag', etag(booking));
    return booking;
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: 'If-Match', required: false, description: 'Version ETag from GET; 412 if it changed' })
  @ApiOkResponse({ type: BookingDto })
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<BookingDto> {
    const booking = await this.bookings.cancel(user, id, parseIfMatch(ifMatch));
    res.setHeader('ETag', etag(booking));
    return booking;
  }
}
