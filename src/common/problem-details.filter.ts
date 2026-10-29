import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  DriverException,
  NotFoundError,
  OptimisticLockError,
  UniqueConstraintViolationException,
} from '@mikro-orm/postgresql';
import type { Request, Response } from 'express';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: string[];
  [extension: string]: unknown;
}

/** Postgres error codes that are client errors rather than server faults. */
const PG_CONFLICT_CODES: Record<string, string> = {
  '23P01': 'The requested period overlaps an existing booking for this resource',
};

/** Maps any thrown error to an RFC 9457 problem document; unexpected errors are logged and hidden. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const problem = this.toProblem(exception);
    problem.instance = request.originalUrl;
    const requestId = (request as Request & { id?: unknown }).id;
    if (typeof requestId === 'string') problem.requestId = requestId;
    if (problem.status >= 500)
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    response.status(problem.status).type('application/problem+json').json(problem);
  }

  toProblem(exception: unknown): ProblemDetails {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : (body as { message?: unknown }).message;
      const extra = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
      const problem = base(status);
      if (Array.isArray(message)) problem.errors = message.map(String);
      else if (typeof message === 'string' && message !== problem.title) problem.detail = message;
      for (const key of ['code', 'retryAfter'] as const)
        if (extra[key] !== undefined) problem[key] = extra[key];
      return problem;
    }
    if (exception instanceof NotFoundError)
      return { ...base(HttpStatus.NOT_FOUND), detail: 'Resource not found' };
    if (exception instanceof OptimisticLockError) {
      return {
        ...base(HttpStatus.CONFLICT),
        detail: 'The record was changed by another request; reload it and retry',
      };
    }
    if (exception instanceof UniqueConstraintViolationException) {
      return { ...base(HttpStatus.CONFLICT), detail: 'A record with the same unique value already exists' };
    }
    if (exception instanceof DriverException) {
      const code = (exception as DriverException & { code?: string }).code;
      const detail = code ? PG_CONFLICT_CODES[code] : undefined;
      if (detail) return { ...base(HttpStatus.CONFLICT), detail, code };
    }
    return base(HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

function base(status: number): ProblemDetails {
  const title = (HttpStatus[status] ?? 'Error').toString().replace(/_/g, ' ').toLowerCase();
  return { type: 'about:blank', title: title.charAt(0).toUpperCase() + title.slice(1), status };
}
