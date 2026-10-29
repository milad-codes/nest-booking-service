import { Global, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { Env } from '../config/env.js';
import { HttpMetricsMiddleware } from './http-metrics.middleware.js';
import { pinoHttpOptions } from './logging.js';
import { MetricsController } from './metrics.controller.js';
import { Metrics } from './metrics.service.js';

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: pinoHttpOptions({
          LOG_LEVEL: config.get('LOG_LEVEL', { infer: true }),
          NODE_ENV: config.get('NODE_ENV', { infer: true }),
        }),
      }),
    }),
  ],
  controllers: [MetricsController],
  providers: [Metrics],
  exports: [Metrics],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpMetricsMiddleware).forRoutes('*path');
  }
}
