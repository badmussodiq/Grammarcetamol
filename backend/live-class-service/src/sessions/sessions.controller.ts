import {Controller, Post, Param} from '@nestjs/common';
import {ApiResponse} from '@/common/api-response';
import {CurrentUser, CurrentUserPayload, requireAuthenticated} from '@/common/current-user.decorator';
import {SessionsService} from './sessions.service';

@Controller('api/sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post(':id/start')
  async start(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    await this.sessionsService.start(id, user.id as string);
    return ApiResponse.success(null);
  }

  @Post(':id/end')
  async end(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    await this.sessionsService.end(id, user.id as string);
    return ApiResponse.success(null);
  }
}
