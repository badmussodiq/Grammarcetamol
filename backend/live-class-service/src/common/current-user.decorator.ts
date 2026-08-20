import {createParamDecorator, ExecutionContext, ForbiddenException} from '@nestjs/common';
import type {Request} from 'express';

/** Mirrors payment-service's/notification-service's CurrentUser decorator exactly. There is no
 * separate "instructor" role anywhere in this platform (confirmed: auth-service's RoleName enum
 * is SUPER_ADMIN/STUDENT/MODERATOR/CUSTOMER_SUPPORT only, and admin-frontend.md lists
 * "Instructor Management" as Future/unbuilt) — same precedent course-service already set for
 * `instructorId`: any SUPER_ADMIN/MODERATOR can create a class and becomes its instructorId,
 * it's an audit-trail field, not a foreign key into a real instructor entity. */
export interface CurrentUserPayload {
  id: string | null;
  roles: string[];
  isAuthenticated(): boolean;
  isAdminOrModerator(): boolean;
}

function buildCurrentUser(id: string | null, roles: string[]): CurrentUserPayload {
  return {
    id,
    roles,
    isAuthenticated: () => id !== null,
    isAdminOrModerator: () => roles.includes('SUPER_ADMIN') || roles.includes('MODERATOR'),
  };
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const userId = request.headers['x-user-id'];
  const roleHeader = request.headers['x-user-role'];

  if (!userId || Array.isArray(userId)) {
    return buildCurrentUser(null, []);
  }

  const roles = roleHeader
    ? String(Array.isArray(roleHeader) ? roleHeader[0] : roleHeader)
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean)
    : [];

  return buildCurrentUser(userId, roles);
});

export function requireAuthenticated(user: CurrentUserPayload): void {
  if (!user.isAuthenticated()) {
    throw new ForbiddenException('Authentication required');
  }
}

export function requireAdminOrModerator(user: CurrentUserPayload): void {
  requireAuthenticated(user);
  if (!user.isAdminOrModerator()) {
    throw new ForbiddenException('Only super admins or moderators can perform this action');
  }
}
