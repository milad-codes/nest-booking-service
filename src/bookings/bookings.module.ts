import { Module } from '@nestjs/common';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor.js';
import { IdempotencyService } from '../common/idempotency/idempotency.service.js';
import { ResourcesController } from '../resources/resources.controller.js';
import { ResourcesService } from '../resources/resources.service.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';

@Module({
  controllers: [ResourcesController, BookingsController],
  providers: [ResourcesService, BookingsService, IdempotencyService, IdempotencyInterceptor],
})
export class BookingsModule {}
