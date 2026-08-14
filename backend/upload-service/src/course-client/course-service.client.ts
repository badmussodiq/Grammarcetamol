import {Injectable, NotFoundException, ServiceUnavailableException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

export interface CourseSummary {
  id: string;
  title: string;
  slug: string;
  status: string;
  price: string;
  currency: string;
}

interface CourseApiResponse {
  success: boolean;
  data?: { course: CourseSummary };
  error?: string;
}

// Same internal-caller convention as payment-service's CourseServiceClient — never goes through
// the gateway, presents as a trusted SUPER_ADMIN caller since course-service has no concept of
// "this is an in-progress upload session" to authorize against otherwise. Used only to validate
// the course exists and to get its title server-side — never trust a client-supplied course name.
const INTERNAL_CALLER_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class CourseServiceClient {
  constructor(private readonly config: ConfigService) {}

  async getCourse(courseId: string): Promise<CourseSummary> {
    const baseUrl = this.config.get<string>('COURSE_SERVICE_URL', 'http://localhost:9002');
    const res = await fetch(`${baseUrl}/api/courses/${courseId}`, {
      headers: {
        'X-User-Id': INTERNAL_CALLER_ID,
        'X-User-Role': 'SUPER_ADMIN',
      },
    });

    if (res.status === 404) {
      throw new NotFoundException(`Course not found: ${courseId}`);
    }
    if (!res.ok) {
      throw new ServiceUnavailableException('course-service request failed');
    }

    const body = (await res.json()) as CourseApiResponse;
    if (!body.success || !body.data) {
      throw new NotFoundException(`Course not found: ${courseId}`);
    }
    return body.data.course;
  }
}
