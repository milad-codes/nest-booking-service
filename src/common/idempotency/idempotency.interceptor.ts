import {
  BadRequestException,
  type CallHandler,
  ConflictException,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Response } from 'express';
import { catchError, concatMap, from, type Observable, of, throwError } from 'rxjs';
import type { AuthenticatedRequest } from '../../auth/auth.decorators.js';
import { sha256Hex } from '../ids.js';
import { stableStringify } from '../stable-json.js';
import { IdempotencyService } from './idempotency.service.js';

const KEY_PATTERN = /^[A-Za-z0-9._:-]{1,255}$/;

/**
 * Implements the `Idempotency-Key` request header for unsafe methods: the first successful response
 * is stored and replayed for retries with the same key and payload. Requests without the header pass through.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly store: IdempotencyService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const key = request.header('idempotency-key');
    if (key === undefined) return next.handle();
    if (!KEY_PATTERN.test(key))
      throw new BadRequestException('Idempotency-Key must be 1-255 characters of [A-Za-z0-9._:-]');
    if (!request.user) throw new BadRequestException('Idempotency-Key requires an authenticated request');

    const route = (request.route as { path?: string } | undefined)?.path ?? request.path;
    const hash = sha256Hex(`${request.method} ${route}\n${stableStringify(request.body)}`);
    const decision = await this.store.begin(request.user.id, key, hash);

    switch (decision.kind) {
      case 'mismatch':
        throw new UnprocessableEntityException('Idempotency-Key was already used with a different request');
      case 'in-progress':
        throw new ConflictException('A request with this Idempotency-Key is still being processed');
      case 'replay':
        response.status(decision.statusCode).setHeader('Idempotent-Replayed', 'true');
        return of(decision.body);
      case 'new':
        return next.handle().pipe(
          concatMap((body) =>
            from(this.store.complete(decision.id, response.statusCode, body).then(() => body)),
          ),
          catchError((error: unknown) =>
            from(this.store.release(decision.id)).pipe(concatMap(() => throwError(() => error))),
          ),
        );
    }
  }
}
