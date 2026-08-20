import {Controller, Get} from '@nestjs/common';

/** Matches every other service's /actuator/health shape. */
@Controller('actuator')
export class HealthController {
  @Get('health')
  health() {
    return { status: 'UP' };
  }
}
