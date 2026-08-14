import {Controller, Delete, Get, Param, Patch, Query} from '@nestjs/common';
import {CurrentUser, type CurrentUserPayload, requireAuthenticated} from '../common/current-user.decorator';
import {ApiResponse} from '../common/api-response';
import {NotificationsService} from './notifications.service';

/** The in-app notification inbox — always scoped to the authenticated caller's own userId,
 * never a client-supplied one. No SSE stream endpoint here (that's Phase 4/v2 work, see
 * PLAN.md Task 39) — the frontend polls/refetches instead. */
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('type') type?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    requireAuthenticated(user);
    const result = await this.notifications.listForUser(
      user.id as string,
      { type, unreadOnly: unreadOnly === 'true' },
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
    return ApiResponse.success(result);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const count = await this.notifications.unreadCount(user.id as string);
    return ApiResponse.success({ count });
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    await this.notifications.markAllRead(user.id as string);
    return ApiResponse.success(null);
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    await this.notifications.markRead(id, user.id as string);
    return ApiResponse.success(null);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    await this.notifications.remove(id, user.id as string);
    return ApiResponse.success(null);
  }
}
