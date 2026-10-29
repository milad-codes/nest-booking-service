import { Controller, Get, Header, Headers, Inject, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../auth/auth.decorators.js';
import type { Env } from '../config/env.js';
import { Metrics } from './metrics.service.js';

const sameSecret = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/** Prometheus scrape endpoint. Protected by a static bearer token when METRICS_TOKEN is set. */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: Metrics,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async scrape(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const token = this.config.get('METRICS_TOKEN', { infer: true });
    if (token && !sameSecret(authorization ?? '', `Bearer ${token}`))
      throw new UnauthorizedException('Invalid metrics token');
    res.type(this.metrics.registry.contentType);
    return this.metrics.registry.metrics();
  }
}
