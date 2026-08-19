import {Controller, Delete, Get, Param} from '@nestjs/common';
import {ApiResponse} from '@/common/api-response';
import {CurrentUser, CurrentUserPayload, requireAuthenticated} from '@/common/current-user.decorator';
import {EnrollmentsService} from './enrollments.service';

// Deliberately nested under api/classes rather than api/enrollments — course-enrollment-service
// already owns a broader /api/enrollments/** gateway route (registered first) that would
// otherwise silently swallow this one, a real collision found building Task 41 — see
// RouteConfig.java's own comment on the live-class-service route for the full story.
@Controller('api/classes/enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get('mine')
  async mine(@CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const result = await this.enrollmentsService.listMine(user.id as string);
    return ApiResponse.success(result);
  }

  @Delete(':id')
  async cancel(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const enrollment = await this.enrollmentsService.cancel(id, user.id as string);
    return ApiResponse.success(enrollment);
  }
}
