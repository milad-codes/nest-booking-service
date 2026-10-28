import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { EntityManager } from '@mikro-orm/postgresql';
import { Public } from '../auth/auth.decorators.js';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly em: EntityManager) {}

  /** Liveness: the process is up and serving requests. Never touches dependencies. */
  @Get('live')
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness: dependencies needed to serve traffic are reachable. */
  @Get('ready')
  @ApiOkResponse({ schema: { example: { status: 'ok', database: 'up' } } })
  @ApiServiceUnavailableResponse()
  async ready(): Promise<{ status: 'ok'; database: 'up' }> {
    try {
      await this.em.fork().execute('select 1');
      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
}
