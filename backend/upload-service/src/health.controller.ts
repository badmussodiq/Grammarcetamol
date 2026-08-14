import {Controller, Get} from '@nestjs/common';

/** Matches the Java services' /actuator/health shape for a consistent house convention, without
 * pulling in @nestjs/terminus for a single static check. */
@Controller('actuator')
export class HealthController {
  @Get('health')
  health() {
    return { status: 'UP' };
  }
}
