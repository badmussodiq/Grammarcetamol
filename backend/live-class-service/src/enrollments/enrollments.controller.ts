import {Controller, Delete, Param} from '@nestjs/common';
import {ApiResponse} from '@/common/api-response';
import {CurrentUser, CurrentUserPayload, requireAuthenticated} from '@/common/current-user.decorator';
import {EnrollmentsService} from './enrollments.service';

@Controller('api/enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Delete(':id')
  async cancel(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    requireAuthenticated(user);
    const enrollment = await this.enrollmentsService.cancel(id, user.id as string);
    return ApiResponse.success(enrollment);
  }
}
