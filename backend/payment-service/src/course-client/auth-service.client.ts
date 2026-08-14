import {Injectable, NotFoundException, ServiceUnavailableException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

export interface UserContact {
  id: string;
  email: string;
  fullName: string | null;
}

interface UserApiResponse {
  success: boolean;
  data?: UserContact;
  error?: string;
}

// Hits auth-service's /api/internal/users/{id} — unauthenticated but never routed through the
// gateway (see InternalUserController in auth-service), so it's reachable only from other
// backend services. No X-User-Id/X-User-Role headers needed here, unlike CourseServiceClient.
@Injectable()
export class AuthServiceClient {
  constructor(private readonly config: ConfigService) {}

  async getUser(userId: string): Promise<UserContact> {
    const baseUrl = this.config.get<string>('AUTH_SERVICE_URL', 'http://localhost:9001');
    const res = await fetch(`${baseUrl}/api/internal/users/${userId}`);

    if (res.status === 404) {
      throw new NotFoundException(`User not found: ${userId}`);
    }
    if (!res.ok) {
      throw new ServiceUnavailableException('auth-service request failed');
    }

    const body = (await res.json()) as UserApiResponse;
    if (!body.success || !body.data) {
      throw new NotFoundException(`User not found: ${userId}`);
    }
    return body.data;
  }
}
