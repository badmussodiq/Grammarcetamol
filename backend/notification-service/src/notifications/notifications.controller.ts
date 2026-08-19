import {Controller, Delete, Get, MessageEvent, Param, Patch, Query, Sse} from '@nestjs/common';
import {map, Observable} from 'rxjs';
import {CurrentUser, type CurrentUserPayload, requireAuthenticated} from '@/common/current-user.decorator';
import {ApiResponse} from '@/common/api-response';
import {NotificationsService} from './notifications.service';

/** The in-app notification inbox — always scoped to the authenticated caller's own userId,
 * never a client-supplied one. */
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /**
   * Server-Sent Events — Task 40's own flagged risk: confirmed live (curl -N through the
   * gateway) that Spring Cloud Gateway's Netty-based reactive proxy streams this cleanly
   * without buffering the whole response before forwarding it. If that ever regresses, the
   * documented fallback is client-side polling of GET /unread-count — Task 42's frontend
   * client builds that in regardless of whether SSE works, not as an afterthought.
   */
  @Sse('stream')
  stream(@CurrentUser() user: CurrentUserPayload): Observable<MessageEvent> {
    requireAuthenticated(user);
    return this.notifications.streamFor(user.id as string).pipe(
      map((event) => ({ data: event.notification }) as MessageEvent),
    );
  }

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
