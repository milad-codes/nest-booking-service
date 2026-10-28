import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  /** Liveness: the process is up and serving requests. */
  @Get('live')
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
