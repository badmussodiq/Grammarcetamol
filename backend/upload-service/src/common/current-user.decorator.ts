import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

/** Mirrors shared-java's CurrentUser record — id is null and roles is empty for anonymous
 * requests (there is no anonymous/public route on this service, but the shape stays consistent
 * with the rest of the stack rather than throwing at header-parse time). */
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
