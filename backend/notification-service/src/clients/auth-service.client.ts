import {Injectable, ServiceUnavailableException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

export interface InternalUser {
  id: string;
  email: string;
  fullName: string | null;
}

interface InternalUserResponse {
  success: boolean;
  data?: InternalUser;
  error?: string;
}

interface InternalUserListResponse {
  success: boolean;
  data?: InternalUser[];
  error?: string;
}

/** Hits auth-service's internal-only /api/internal/users/students — never routed through the
 * gateway, same convention as every other InternalUserController caller in this codebase
 * (payment-service's/live-class-service's own AuthServiceClient). Backs Announcements'
 * targetType='all' recipient fan-out. */
@Injectable()
export class AuthServiceClient {
  constructor(private readonly config: ConfigService) {}

  async listActiveStudents(): Promise<InternalUser[]> {
    const baseUrl = this.config.get<string>('AUTH_SERVICE_URL', 'http://localhost:9001');
    const res = await fetch(`${baseUrl}/api/internal/users/students`);
    if (!res.ok) {
      throw new ServiceUnavailableException('auth-service request failed');
    }
    const body = (await res.json()) as InternalUserListResponse;
    return body.data ?? [];
  }

  /** Resolves one user's email/name — used to enrich course-targeted announcement recipients,
   * where enrollment-service only hands back bare userIds. N individual lookups is an accepted
   * simplification here (no bulk-by-ids endpoint exists) — announcement audiences targeting a
   * handful of courses are not expected to be huge. */
  async getUser(userId: string): Promise<InternalUser | null> {
    const baseUrl = this.config.get<string>('AUTH_SERVICE_URL', 'http://localhost:9001');
    const res = await fetch(`${baseUrl}/api/internal/users/${userId}`);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new ServiceUnavailableException('auth-service request failed');
    }
    const body = (await res.json()) as InternalUserResponse;
    return body.data ?? null;
  }
}
