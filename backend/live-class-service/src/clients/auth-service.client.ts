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

// Identical to payment-service's AuthServiceClient — hits auth-service's internal, ungated
// /api/internal/users/{id}, never routed through the gateway.
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
