import {ForbiddenException} from '@nestjs/common';
import {NotificationsController} from '@/notifications/notifications.controller';
import type {CurrentUserPayload} from '@/common/current-user.decorator';

function user(id: string | null, roles: string[] = []): CurrentUserPayload {
  return { id, roles, isAuthenticated: () => id !== null, isAdminOrModerator: () => roles.some((r) => ['SUPER_ADMIN', 'MODERATOR'].includes(r)) };
}

describe('NotificationsController', () => {
  let notifications: {
    listForUser: jest.Mock;
    unreadCount: jest.Mock;
    markAllRead: jest.Mock;
    markRead: jest.Mock;
    remove: jest.Mock;
  };
  let controller: NotificationsController;

  beforeEach(() => {
    notifications = {
      listForUser: jest.fn(),
      unreadCount: jest.fn(),
      markAllRead: jest.fn(),
      markRead: jest.fn(),
      remove: jest.fn(),
    };
    controller = new NotificationsController(notifications as any);
  });

  it('list scopes to the authenticated caller and rejects anonymous callers', async () => {
    notifications.listForUser.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });

    await controller.list(user('user-1'), undefined, undefined, undefined, undefined);
    expect(notifications.listForUser).toHaveBeenCalledWith('user-1', expect.any(Object), 1, 20);

    await expect(controller.list(user(null), undefined, undefined, undefined, undefined)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('unreadCount returns the count for the authenticated caller', async () => {
    notifications.unreadCount.mockResolvedValue(3);

    const result = await controller.unreadCount(user('user-1'));

    expect(result.data).toEqual({ count: 3 });
    expect(notifications.unreadCount).toHaveBeenCalledWith('user-1');
  });

  it('markRead delegates with the caller\'s own userId, never a client-supplied one', async () => {
    await controller.markRead('notif-1', user('user-1'));

    expect(notifications.markRead).toHaveBeenCalledWith('notif-1', 'user-1');
  });

  it('markAllRead is scoped to the authenticated caller', async () => {
    await controller.markAllRead(user('user-1'));

    expect(notifications.markAllRead).toHaveBeenCalledWith('user-1');
  });

  it('remove rejects anonymous callers before touching the service', async () => {
    await expect(controller.remove('notif-1', user(null))).rejects.toBeInstanceOf(ForbiddenException);
    expect(notifications.remove).not.toHaveBeenCalled();
  });
});
