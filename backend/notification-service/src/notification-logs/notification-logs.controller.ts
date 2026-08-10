import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser, requireAdminOrModerator, type CurrentUserPayload } from '../common/current-user.decorator';
import { ApiResponse } from '../common/api-response';
import { NotificationLogsService } from './notification-logs.service';

@Controller('api/notification-logs')
export class NotificationLogsController {
  constructor(private readonly logs: NotificationLogsService) {}

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('service') service?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    requireAdminOrModerator(user);
    const result = await this.logs.list({ service, status }, page ? Number(page) : 1, limit ? Number(limit) : 20);
    return ApiResponse.success(result);
  }
}
