import {Body, Controller, Patch, Post, Param} from '@nestjs/common';
import {ApiResponse} from '@/common/api-response';
import {CurrentUser, CurrentUserPayload, requireAuthenticated} from '@/common/current-user.decorator';
import {RescheduleSessionDto} from './dto/reschedule-session.dto';
import {toPublicSession} from './session.types';
import {SessionsService} from './sessions.service';

@Controller('api/sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post(':id/start')
  async start(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    await this.sessionsService.start(id, user.id as string, user.isAdminOrModerator());
    return ApiResponse.success(null);
  }

  @Post(':id/end')
  async end(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    await this.sessionsService.end(id, user.id as string, user.isAdminOrModerator());
    return ApiResponse.success(null);
  }

  @Patch(':id')
  async reschedule(@Param('id') id: string, @Body() dto: RescheduleSessionDto, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const session = await this.sessionsService.reschedule(
      id,
      user.id as string,
      user.isAdminOrModerator(),
      new Date(dto.startTime),
      new Date(dto.endTime),
    );
    return ApiResponse.success(toPublicSession(session));
  }
}
