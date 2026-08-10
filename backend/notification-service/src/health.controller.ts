import { Controller, Get } from '@nestjs/common';

/** Matches every other service's /actuator/health shape, without pulling in @nestjs/terminus
 * for a single static check. */
@Controller('actuator')
export class HealthController {
  @Get('health')
  health() {
    return { status: 'UP' };
  }
}
