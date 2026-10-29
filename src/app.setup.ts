import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ProblemDetailsFilter } from './common/problem-details.filter.js';
import { setupOpenApi } from './openapi.js';

/** Global HTTP behaviour shared by main.ts and the e2e tests, so tests exercise the real pipeline. */
export function configureApp(app: INestApplication): INestApplication {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ProblemDetailsFilter());
  setupOpenApi(app);
  app.enableShutdownHooks();
  return app;
}
