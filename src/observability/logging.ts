import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Options } from 'pino-http';
import type { Env } from '../config/env.js';

export const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

/** Reuses a caller-supplied request id only if it is short and harmless; otherwise generates one. */
export function sanitizeRequestId(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
}

/** Values that must never reach logs, even if a future serializer starts logging bodies. */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.refreshToken',
  'accessToken',
  'refreshToken',
];

const QUIET_PATHS = ['/health/', '/metrics'];

export function pinoHttpOptions(env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>): Options {
  return {
    level: env.LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: '[Redacted]' },
    genReqId: (req: IncomingMessage, res: ServerResponse) => {
      const id = sanitizeRequestId(req.headers[REQUEST_ID_HEADER]);
      res.setHeader(REQUEST_ID_HEADER, id);
      return id;
    },
    customProps: () => ({ service: 'nest-booking-service' }),
    autoLogging: { ignore: (req: IncomingMessage) => QUIET_PATHS.some((p) => req.url?.startsWith(p)) },
    quietReqLogger: true,
    ...(env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
      : {}),
  };
}
