import {Injectable, ServiceUnavailableException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

interface EnrolledUserIdsResponse {
  success: boolean;
  data?: string[];
  error?: string;
}

// Internal caller sentinel — same convention as payment-service's CourseServiceClient: never
// goes through the gateway, presents as a trusted admin caller since enrollment-service has no
// concept of "an announcement is being published" to authorize against otherwise.
const INTERNAL_CALLER_ID = '00000000-0000-0000-0000-000000000000';

/** Backs Announcements' targetType='courses' recipient fan-out — resolves the distinct set of
 * actively-enrolled userIds across the announcement's target courseIds. */
@Injectable()
export class EnrollmentServiceClient {
  constructor(private readonly config: ConfigService) {}

  async getEnrolledUserIds(courseIds: string[]): Promise<string[]> {
    if (courseIds.length === 0) return [];
    const baseUrl = this.config.get<string>('ENROLLMENT_SERVICE_URL', 'http://localhost:9003');
    const res = await fetch(`${baseUrl}/api/enrollments/course-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': INTERNAL_CALLER_ID,
        'X-User-Role': 'SUPER_ADMIN',
      },
      body: JSON.stringify({ courseIds }),
    });
    if (!res.ok) {
      throw new ServiceUnavailableException('enrollment-service request failed');
    }
    const body = (await res.json()) as EnrolledUserIdsResponse;
    return body.data ?? [];
  }
}
