import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { Metrics } from './metrics.service.js';

/**
 * Records latency per route *template* (e.g. /bookings/:id) once the response is finished, so ids never
 * become label values. Unmatched paths share one label to keep cardinality bounded.
 */
@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: Metrics) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (req.path === '/metrics') return next();
    const stop = this.metrics.httpDuration.startTimer();
    res.once('finish', () => {
      const routePath = (req.route as { path?: unknown } | undefined)?.path;
      // NestJS answers unknown paths from a catch-all wildcard route; this API defines no wildcard routes itself
      const matched = typeof routePath === 'string' && !routePath.includes('*');
      const route = matched ? `${req.baseUrl}${routePath}` : 'unmatched';
      stop({ method: req.method, route, status_code: String(res.statusCode) });
    });
    next();
  }
}
